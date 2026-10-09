-- =====================================================
-- UPDATE V14 — Pisahkan foto laporan OB & foto bukti admin
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
alter table public.asset_damage_reports add column if not exists photo_bukti_url text;
