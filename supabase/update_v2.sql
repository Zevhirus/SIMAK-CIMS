-- =====================================================
-- UPDATE V2 — Pengecekan ulang admin + Inspeksi kebersihan
-- Jalankan di Supabase Dashboard > SQL Editor (setelah schema.sql)
-- =====================================================

-- 1. REPORTS: status baru VERIFIED (di-ACC admin) + catatan tinjau ulang -------------
--    Alur baru:  PENDING -> IN_PROGRESS -> COMPLETED (menunggu cek admin)
--                COMPLETED -> VERIFIED (ACC)  atau  COMPLETED -> IN_PROGRESS (tinjau ulang)
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('PENDING','APPROVED','IN_PROGRESS','COMPLETED','VERIFIED','REJECTED'));

alter table public.reports add column if not exists admin_notes text;

-- Policy admin & OB yang sudah ada tetap cukup:
--  * admin boleh update semua (ACC / tinjau ulang)
--  * OB hanya IN_PROGRESS -> COMPLETED (jadi saat ditinjau ulang OB bisa kerjakan lagi)

-- 2. INSPEKSI: tabel checklist kebersihan per lantai ---------------------------------
create table if not exists public.inspection_checks (
  id          uuid primary key default gen_random_uuid(),
  floor       smallint not null check (floor between 1 and 3),
  check_date  date     not null,
  slot        text     not null check (slot in ('10:00','17:00')),
  item        text     not null,
  status      text     check (status in ('OK','X')),   -- OK = tuntas (1 poin), X = belum tuntas
  note        text,
  checked_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (floor, check_date, slot, item)
);

create index if not exists inspection_floor_date_idx on public.inspection_checks(floor, check_date);

drop trigger if exists inspection_touch on public.inspection_checks;
create trigger inspection_touch before update on public.inspection_checks
for each row execute function public.touch_updated_at();

alter table public.inspection_checks enable row level security;

-- Hanya admin yang boleh melihat / mengisi checklist. Role 'ob' dan 'umum' tidak punya akses.
create policy "inspection_select" on public.inspection_checks for select
  using (public.current_role_name() = 'admin');
create policy "inspection_insert" on public.inspection_checks for insert
  with check (public.current_role_name() = 'admin');
create policy "inspection_update" on public.inspection_checks for update
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');
