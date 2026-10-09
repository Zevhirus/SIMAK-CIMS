-- =====================================================
-- FIX V12 — Perbaiki provider_id di auth.identities (penyebab login error schema)
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================
update auth.identities i
set provider_id = u.email,
    identity_data = jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true)
from auth.users u
where i.user_id = u.id
  and u.email in ('ob_qolby@lapor.test','ob_paris@lapor.test','ob_razak@lapor.test');

select u.email, i.provider, i.provider_id
from auth.identities i join auth.users u on u.id = i.user_id
where u.email in ('ob_qolby@lapor.test','ob_paris@lapor.test','ob_razak@lapor.test');
