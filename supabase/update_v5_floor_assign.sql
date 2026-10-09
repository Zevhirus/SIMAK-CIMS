-- =====================================================
-- UPDATE V5 — Penugasan per LANTAI (Lantai 1 / 2 / 3)
-- Jalankan di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
-- =====================================================
alter table public.profiles add column if not exists floor smallint check (floor in (1,2,3));
alter table public.reports  add column if not exists assigned_floor smallint check (assigned_floor in (1,2,3));

-- Lantai milik OB yang sedang login (security definer agar tidak rekursif di RLS)
create or replace function public.current_floor() returns smallint
language sql stable security definer set search_path = public as $$
  select floor from public.profiles where user_id = auth.uid()
$$;

-- OB melihat & mengerjakan tugas milik lantainya (atau yang ia kerjakan sendiri)
drop policy if exists "reports_select_ob" on public.reports;
create policy "reports_select_ob" on public.reports for select
  using (public.current_role_name() = 'ob'
         and (assigned_ob_id = auth.uid() or assigned_floor = public.current_floor()));

drop policy if exists "reports_update_ob" on public.reports;
create policy "reports_update_ob" on public.reports for update
  using (public.current_role_name() = 'ob' and status = 'IN_PROGRESS'
         and (assigned_ob_id = auth.uid() or assigned_floor = public.current_floor()))
  with check (assigned_ob_id = auth.uid() and status = 'COMPLETED');

-- Tentukan lantai tiap akun OB (cocokkan dengan nama di profiles.full_name; sesuaikan bila beda)
update public.profiles set floor = 1 where role = 'ob' and full_name ilike '%qolby%';
update public.profiles set floor = 2 where role = 'ob' and (full_name ilike '%paris%' or full_name ilike '%wawan%' or full_name ilike '%teguh%');
update public.profiles set floor = 3 where role = 'ob' and (full_name ilike '%razak%' or full_name ilike '%ghozali%');
-- Cek hasilnya:
-- select full_name, role, floor from public.profiles where role = 'ob' order by floor;
