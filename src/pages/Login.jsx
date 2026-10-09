import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/ui'

const STEPS = ['Dilaporkan', 'Disetujui', 'Dikerjakan', 'Selesai']

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setErr(''); setInfo(''); setBusy(true)
    const { error, data } = mode === 'login'
      ? await signIn(f.email, f.password)
      : await signUp(f.email, f.password, f.name)
    setBusy(false)
    if (error) return setErr(error.message)
    if (mode === 'register' && !data.session) setInfo('Pendaftaran berhasil. Cek email Anda untuk konfirmasi, lalu masuk.')
  }

  return (
    <div className="grid min-h-screen gap-4 p-3 lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden rounded-[2rem] bg-navy p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-lime/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo className="h-12" onDark />
          <div className="leading-tight">
            <span className="font-display text-xl font-bold">SIMAK - CIMS</span>
            <p className="text-[10px] font-semibold tracking-widest text-blue-50/60">CLEANING INSPECTION & MONITORING SYSTEM</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-lg text-6xl font-extrabold leading-[1.02] tracking-tight">Lihat yang kotor? Foto, kirim, <span className="text-lime">beres.</span></h1>
          <p className="mt-5 max-w-md text-lg text-blue-50/70">Laporkan area yang perlu dibersihkan, pantau prosesnya langsung, lalu lihat hasilnya lewat foto sebelum dan sesudah.</p>

          <div className="mt-10 max-w-md rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
            <div className="relative grid h-36 grid-cols-2 overflow-hidden rounded-2xl text-xs font-bold">
              <div className="flex items-end bg-[repeating-linear-gradient(135deg,#2a4478,#355b57_10px,#223a68_10px,#2c4d49_20px)] p-3 text-white/80">Sebelum</div>
              <div className="flex items-end justify-end bg-lime p-3 text-navy">Sesudah</div>
              <div className="absolute inset-y-0 left-1/2 w-0.5 animate-sweep bg-white shadow-[0_0_0_4px_rgba(255,255,255,.25)]" />
            </div>
            <ol className="mt-4 flex items-center justify-between px-1 text-xs">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5 font-semibold text-white">
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < 3 ? 'bg-lime text-navy' : 'bg-white/20 text-white/70'}`}>{i < 3 ? '✓' : ''}</span>
                  <span className={i < 3 ? '' : 'text-white/60'}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="relative text-sm text-blue-50/50">Surveyor Indonesia Makassar · Cleaning Inspection & Monitoring System</p>
      </div>

      <div className="grid place-items-center p-4">
        <form onSubmit={submit} className="w-full max-w-sm animate-pop space-y-4">
          <div className="lg:hidden">
            <Logo className="h-14" />
            <p className="mt-2 text-[10px] font-semibold tracking-widest text-slate-400">SURVEYOR INDONESIA MAKASSAR · CLEANING INSPECTION & MONITORING SYSTEM</p>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-navy">{mode === 'login' ? 'Selamat datang kembali' : 'Buat akun baru'}</h2>
            <p className="mt-1 text-sm text-slate-500">{mode === 'login' ? 'Masuk untuk melihat laporan Anda.' : 'Gratis, cukup satu menit.'}</p>
          </div>
          {mode === 'register' && (
            <input className="input" placeholder="Nama lengkap" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          )}
          <input className="input" type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className="input" type="password" placeholder="Kata sandi (min. 6 karakter)" minLength={6} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
          {info && <p className="rounded-xl bg-mint p-3 text-sm text-blue-900">{info}</p>}
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar'}</button>
          <p className="text-center text-sm text-slate-500">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button type="button" className="font-semibold text-brand hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>
              {mode === 'login' ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
