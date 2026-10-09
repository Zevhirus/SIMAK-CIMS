-- =====================================================
-- FIX V10 — Lengkapi identitas akun OB test (penyebab login 500)
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
-- Isi raw_app_meta_data & konfirmasi email
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb
where email in ('ob_qolby@lapor.test','ob_paris@lapor.test','ob_razak@lapor.test');

-- Tambah baris identity 'email' untuk tiap user (wajib agar login jalan)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', now(), now(), now()
from auth.users u
where u.email in ('ob_qolby@lapor.test','ob_paris@lapor.test','ob_razak@lapor.test')
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- Pastikan profil & role-nya benar
update public.profiles set role = 'ob', floor = 1 where full_name = 'QOLBY';
update public.profiles set role = 'ob', floor = 2 where full_name = 'PARIS DAN WAWAN';
update public.profiles set role = 'ob', floor = 3 where full_name = 'ABD. RAZAK DAN NUR MOH GHOZALI';

-- Cek: tiap user harus punya 1 identity 'email'
select u.email, p.role, p.floor, (select count(*) from auth.identities i where i.user_id = u.id) as jumlah_identity
from auth.users u join public.profiles p on p.user_id = u.id
where p.role = 'ob' order by p.floor;
