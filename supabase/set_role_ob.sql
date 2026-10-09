-- Ubah role 5 akun OB jadi 'ob', lalu tampilkan hasilnya
update public.profiles set role = 'ob'
where full_name in ('Qolby','Paris','Teguh Anugrawan','Abd. Razak','Nur Muh Ghozali');

select u.email, p.full_name, p.role
from auth.users u join public.profiles p on p.user_id = u.id
where p.role = 'ob' order by p.full_name;
