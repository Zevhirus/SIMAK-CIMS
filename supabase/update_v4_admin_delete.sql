-- =====================================================
-- UPDATE V4 — Admin boleh menghapus laporan (+ foto di Storage)
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
drop policy if exists "reports_delete_admin" on public.reports;
create policy "reports_delete_admin" on public.reports for delete
  using (public.current_role_name() = 'admin');

drop policy if exists "photos_delete_admin" on storage.objects;
create policy "photos_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'report-photos' and public.current_role_name() = 'admin');
