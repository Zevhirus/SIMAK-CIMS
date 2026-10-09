-- =====================================================
-- AKUN TEST OB PER LANTAI (untuk testing)
-- Jalankan di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
-- Password semua akun: Petugas@12345
-- =====================================================
create extension if not exists pgcrypto;

-- Helper: buat user auth kalau belum ada (trigger akan membuat profil 'umum')
-- lalu ubah role -> 'ob' dan floor sesuai lantai.
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, created_at, updated_at, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', v.email,
       crypt('Petugas@12345', gen_salt('bf')), now(), 'authenticated', 'authenticated', now(), now(),
       jsonb_build_object('full_name', v.nama)
from (values
  ('QOLBY',                       'ob_qolby@lapor.test'),
  ('PARIS DAN WAWAN',             'ob_paris@lapor.test'),
  ('ABD. RAZAK DAN NUR MOH GHOZALI','ob_razak@lapor.test')
) as v(nama, email)
where not exists (select 1 from auth.users u where u.email = v.email);

-- Identitas 'email' wajib ada agar user bisa login
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', now(), now(), now()
from auth.users u
where u.email in ('ob_qolby@lapor.test','ob_paris@lapor.test','ob_razak@lapor.test')
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

update public.profiles set role = 'ob', floor = 1 where full_name = 'QOLBY';
update public.profiles set role = 'ob', floor = 2 where full_name = 'PARIS DAN WAWAN';
update public.profiles set role = 'ob', floor = 3 where full_name = 'ABD. RAZAK DAN NUR MOH GHOZALI';

-- Cek hasilnya:
select p.full_name, u.email, p.role, p.floor
from public.profiles p join auth.users u on u.id = p.user_id
where p.role = 'ob' order by p.floor;
