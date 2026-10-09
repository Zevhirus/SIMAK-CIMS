-- =====================================================
-- UPDATE V8 — Izinkan admin menghapus laporan kerusakan barang
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
create policy "damage_delete_admin" on public.asset_damage_reports for delete
  using (public.current_role_name() = 'admin');
