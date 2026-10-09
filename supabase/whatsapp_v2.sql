-- =====================================================
-- Notifikasi WhatsApp V2 — ke ADMIN (laporan baru & OB selesai) dan ke OB
-- Pakai pg_net (tidak perlu menu Webhooks). Aman dijalankan ulang.
-- Ganti <PROJECT_REF> dan <WEBHOOK_SECRET> (samakan dengan secret Edge Function).
-- =====================================================
alter table public.profiles add column if not exists phone text;
create extension if not exists pg_net;

create or replace function public.notify_whatsapp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-ob',
    headers := '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}'::jsonb,
    body    := jsonb_build_object(
                 'type', TG_OP,
                 'record', to_jsonb(new),
                 'old_record', case when TG_OP = 'UPDATE' then to_jsonb(old) else null end)
  );
  return new;
end $$;

-- Hapus trigger lama (versi sebelumnya)
drop trigger if exists notify_ob_whatsapp on public.reports;
drop trigger if exists notify_wa_insert   on public.reports;
drop trigger if exists notify_wa_update   on public.reports;

-- Laporan baru masuk -> admin
create trigger notify_wa_insert after insert on public.reports
for each row execute function public.notify_whatsapp();

-- Status berubah ke IN_PROGRESS (-> OB) atau COMPLETED (-> admin)
create trigger notify_wa_update after update on public.reports
for each row
when (new.status in ('IN_PROGRESS','COMPLETED') and old.status is distinct from new.status)
execute function public.notify_whatsapp();

-- Isi nomor WA admin & OB (format bebas: 08xx / 628xx / +628xx)
-- update public.profiles set phone = '0812xxxxxxx'
-- where user_id = (select id from auth.users where email = 'admin@lapor.test');
