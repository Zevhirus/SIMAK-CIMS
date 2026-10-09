-- =====================================================
-- UPDATE V13 — Revisi sistem
-- 1. OB tanpa lantai (rolling): penugasan langsung ke OB
-- 2. Kunci hasil inspeksi setelah "Selesai" + tugas ✕ ke OB
-- 3. Pemeliharaan: kolom baru (lantai, area, uraian, kondisi)
-- =====================================================

-- 1) Hapus konsep lantai pada akun OB
drop policy if exists "reports_select_ob" on public.reports;
drop policy if exists "reports_update_ob" on public.reports;
drop function if exists public.current_floor();
alter table public.reports drop constraint if exists reports_assigned_floor_check;
alter table public.reports drop column if exists assigned_floor;
alter table public.profiles drop constraint if exists profiles_floor_check;
alter table public.profiles drop column if exists floor;

-- OB melihat & mengerjakan tugas yang ditugaskan ke dia
create policy "reports_select_ob" on public.reports for select
  using (public.current_role_name() = 'ob' and assigned_ob_id = auth.uid());
create policy "reports_update_ob" on public.reports for update
  using (public.current_role_name() = 'ob' and status = 'IN_PROGRESS' and assigned_ob_id = auth.uid())
  with check (assigned_ob_id = auth.uid() and status = 'COMPLETED');

-- Admin boleh membuat tugas langsung (dari hasil inspeksi)
create policy "reports_insert_admin" on public.reports for insert
  with check (public.current_role_name() = 'admin');

-- Foto "sebelum" tidak wajib (tugas inspeksi bisa tanpa foto)
alter table public.reports alter column photo_before_url drop not null;

-- 2) Kunci hasil inspeksi mingguan per lantai
create table if not exists public.inspection_locks (
  id         uuid primary key default gen_random_uuid(),
  floor      smallint not null check (floor between 1 and 3),
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (floor, week_start)
);
alter table public.inspection_locks enable row level security;
drop policy if exists "locks_select_admin" on public.inspection_locks;
create policy "locks_select_admin" on public.inspection_locks for select
  using (public.current_role_name() = 'admin');
drop policy if exists "locks_insert_admin" on public.inspection_locks;
create policy "locks_insert_admin" on public.inspection_locks for insert
  with check (public.current_role_name() = 'admin');

-- 3) Pemeliharaan: kolom baru
alter table public.asset_damage_reports alter column item drop not null;
alter table public.asset_damage_reports alter column location drop not null;
alter table public.asset_damage_reports alter column description drop not null;
alter table public.asset_damage_reports alter column photo_url drop not null;
alter table public.asset_damage_reports add column if not exists lantai smallint check (lantai between 1 and 3);
alter table public.asset_damage_reports add column if not exists area text;
alter table public.asset_damage_reports add column if not exists uraian text;
alter table public.asset_damage_reports add column if not exists kondisi text check (kondisi in ('Bersih','Kotor','Rusak','Baik'));
