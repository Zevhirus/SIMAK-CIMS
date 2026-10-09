-- =====================================================
-- FIX V11 — Hapus akun OB duplikat tanpa identitas (ob_lt1/2/3)
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
delete from auth.users
where email in ('ob_lt1@lapor.test','ob_lt2@lapor.test','ob_lt3@lapor.test');

-- Pastikan profil & role akun yang dipakai benar
update public.profiles set role = 'ob', floor = 1 where full_name = 'QOLBY';
update public.profiles set role = 'ob', floor = 2 where full_name = 'PARIS DAN WAWAN';
update public.profiles set role = 'ob', floor = 3 where full_name = 'ABD. RAZAK DAN NUR MOH GHOZALI';

select u.email, p.role, p.floor, (select count(*) from auth.identities i where i.user_id = u.id) as jumlah_identity
from auth.users u join public.profiles p on p.user_id = u.id
where p.role = 'ob' order by p.floor;
