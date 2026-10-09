-- =====================================================
-- Sistem Pelaporan Kebersihan — Skema + RLS + Storage
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. TABEL ------------------------------------------------
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'umum' check (role in ('umum','admin','ob')),
  created_at  timestamptz not null default now()
);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  location         text not null,
  description      text not null,
  photo_before_url text not null,
  status           text not null default 'PENDING'
                   check (status in ('PENDING','APPROVED','IN_PROGRESS','COMPLETED','REJECTED')),
  assigned_ob_id   uuid references auth.users(id) on delete set null, -- = profiles.user_id milik OB
  photo_after_url  text,
  ob_notes         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index reports_user_idx   on public.reports(user_id);
create index reports_ob_idx     on public.reports(assigned_ob_id);
create index reports_status_idx on public.reports(status);

-- 2. TRIGGER ----------------------------------------------
-- updated_at otomatis
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger reports_touch before update on public.reports
for each row execute function public.touch_updated_at();

-- Profil otomatis saat user mendaftar. Role SELALU 'umum' (tidak bisa dipilih dari client).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'umum');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- 3. HELPER ROLE (security definer agar tidak rekursif di RLS) ----
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- 4. RLS ----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.reports  enable row level security;

-- profiles: lihat diri sendiri; admin lihat semua. Tidak ada policy UPDATE/INSERT
-- untuk client -> role hanya bisa diubah admin lewat SQL/Dashboard (anti eskalasi).
create policy "profiles_select_own"   on public.profiles for select using (user_id = auth.uid());
create policy "profiles_select_admin" on public.profiles for select using (public.current_role_name() = 'admin');

-- reports: SELECT
create policy "reports_select_own"   on public.reports for select using (user_id = auth.uid());
create policy "reports_select_admin" on public.reports for select using (public.current_role_name() = 'admin');
create policy "reports_select_ob"    on public.reports for select
  using (public.current_role_name() = 'ob' and assigned_ob_id = auth.uid());

-- reports: INSERT (umum; status wajib PENDING)
create policy "reports_insert_umum" on public.reports for insert
  with check (user_id = auth.uid() and status = 'PENDING' and assigned_ob_id is null
              and public.current_role_name() = 'umum');

-- reports: UPDATE admin (approve/assign/reject)
create policy "reports_update_admin" on public.reports for update
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

-- reports: UPDATE OB (hanya tugas miliknya, hanya IN_PROGRESS -> COMPLETED)
create policy "reports_update_ob" on public.reports for update
  using (public.current_role_name() = 'ob' and assigned_ob_id = auth.uid() and status = 'IN_PROGRESS')
  with check (assigned_ob_id = auth.uid() and status = 'COMPLETED');

-- 5. STORAGE ------------------------------------------------
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

-- Upload hanya ke folder milik sendiri: <uid>/<file>
create policy "photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_read" on storage.objects for select using (bucket_id = 'report-photos');

-- 6. REALTIME (notifikasi laporan baru untuk admin) ---------
alter publication supabase_realtime add table public.reports;

-- 7. CONTOH: jadikan user tertentu admin / OB (jalankan manual setelah user mendaftar)
-- update public.profiles set role = 'admin' where user_id = (select id from auth.users where email = 'admin@contoh.com');
-- update public.profiles set role = 'ob'    where user_id = (select id from auth.users where email = 'ob1@contoh.com');
