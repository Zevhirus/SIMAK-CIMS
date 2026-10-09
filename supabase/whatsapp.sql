-- =====================================================
-- Notifikasi WhatsApp ke OB — jalankan di SQL Editor
-- =====================================================

-- 1. Kolom nomor WA di profil (diisi admin lewat SQL; client tidak bisa mengubahnya)
alter table public.profiles add column if not exists phone text;

-- Contoh: isi nomor WA OB (format bebas: 08xx / 628xx / +628xx)
-- update public.profiles set phone = '081234567890'
-- where user_id = (select id from auth.users where email = 'ob1@contoh.com');

-- 2. Trigger: panggil Edge Function saat laporan ditugaskan ke OB (status jadi IN_PROGRESS)
-- Ganti <PROJECT_REF> dan <WEBHOOK_SECRET> (samakan dengan secret di Edge Function).
create trigger notify_ob_whatsapp
after update on public.reports
for each row
when (new.status = 'IN_PROGRESS' and old.status is distinct from 'IN_PROGRESS')
execute function supabase_functions.http_request(
  'https://<PROJECT_REF>.supabase.co/functions/v1/notify-ob',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);
