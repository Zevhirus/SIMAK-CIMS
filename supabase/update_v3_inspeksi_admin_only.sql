-- =====================================================
-- UPDATE V3 — Inspeksi kebersihan HANYA untuk admin
-- Jalankan di Supabase Dashboard > SQL Editor
-- (untuk database yang sudah menjalankan update_v2.sql)
-- =====================================================
drop policy if exists "inspection_select" on public.inspection_checks;
drop policy if exists "inspection_insert" on public.inspection_checks;
drop policy if exists "inspection_update" on public.inspection_checks;

create policy "inspection_select" on public.inspection_checks for select
  using (public.current_role_name() = 'admin');
create policy "inspection_insert" on public.inspection_checks for insert
  with check (public.current_role_name() = 'admin');
create policy "inspection_update" on public.inspection_checks for update
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');
