select net.http_post(
  url     := 'https://vuxnkygbmusbshoszucy.supabase.co/functions/v1/notify-ob',
  headers := '{"Content-Type":"application/json","x-webhook-secret":"lapor2026rahasia"}'::jsonb,
  body    := '{"type":"INSERT","record":{"status":"PENDING","location":"Tes","description":"Tes notifikasi WA","photo_before_url":"https://contoh.com/x.jpg"}}'::jsonb
);

-- tunggu 5 detik, lalu lihat hasilnya
select status_code, content, error_msg, created
from net._http_response order by created desc limit 5;