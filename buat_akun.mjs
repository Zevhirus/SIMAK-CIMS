import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const sb = createClient(url, key)

const AKUN = [
  { nama: 'Qolby', email: 'ob_qolby@lapor.test', password: 'Petugas@12345' },
  { nama: 'Paris', email: 'ob_paris@lapor.test', password: 'Petugas@12345' },
  { nama: 'Teguh Anugrawan', email: 'ob-teguh@lapor.test', password: 'Petugas@12345' },
  { nama: 'Abd. Razak', email: 'ob_razak@lapor.test', password: 'Petugas@12345' },
  { nama: 'Nur Muh Ghozali', email: 'ob-ghozali@lapor.test', password: 'Petugas@12345' },
]

for (const a of AKUN) {
  const { data, error } = await sb.auth.signUp({
    email: a.email, password: a.password, options: { data: { full_name: a.nama } },
  })
  if (error) console.log(`${a.email}: GAGAL -> ${error.message}`)
  else console.log(`${a.email}: ${data.session ? 'OK (langsung aktif)' : 'terdaftar (butuh konfirmasi email)'}`)
}
