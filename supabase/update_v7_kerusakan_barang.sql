-- =====================================================
-- UPDATE V7 — Pelaporan Kerusakan Barang (OB -> Admin)
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
create table if not exists public.asset_damage_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  reporter_name text,
  item          text not null,
  location      text not null,
  description   text not null,
  photo_url     text not null,
  status        text not null default 'BARU' check (status in ('BARU','DIPROSES','SELESAI','DITOLAK')),
  admin_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists asset_damage_created_idx on public.asset_damage_reports(created_at desc);

drop trigger if exists asset_damage_touch on public.asset_damage_reports;
create trigger asset_damage_touch before update on public.asset_damage_reports
  for each row execute function public.touch_updated_at();

alter table public.asset_damage_reports enable row level security;

-- OB membuat laporan dan melihat laporan miliknya
create policy "damage_insert_ob" on public.asset_damage_reports for insert
  with check (public.current_role_name() = 'ob' and auth.uid() = user_id);
create policy "damage_select_own" on public.asset_damage_reports for select
  using (public.current_role_name() = 'ob' and auth.uid() = user_id);

-- Admin melihat semua dan menindaklanjuti
create policy "damage_select_admin" on public.asset_damage_reports for select
  using (public.current_role_name() = 'admin');
create policy "damage_update_admin" on public.asset_damage_reports for update
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');
