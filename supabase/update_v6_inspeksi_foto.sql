-- =====================================================
-- UPDATE V6 — Inspeksi: ganti catatan teks dengan FOTO
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
alter table public.inspection_checks add column if not exists photo_url text;
