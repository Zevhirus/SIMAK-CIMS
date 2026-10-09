import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { STATUS } from '../lib/api'

export const fmtDate = (d) =>
  new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function Logo({ className = 'h-9', onDark }) {
  // Logo PNG transparan bertulisan biru tua; di latar gelap diberi kotak putih agar terbaca.
  const img = <img src="/logo.png" alt="Surveyor Indonesia" className={`w-auto ${className}`} />
  return onDark ? <div className="rounded-xl bg-white p-2 shadow-lift">{img}</div> : img
}

export function Spinner({ full }) {
  return (
    <div className={full ? 'grid min-h-screen place-items-center' : 'grid place-items-center py-12'}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-mint border-t-brand" />
    </div>
  )
}

export function StatusBadge({ status }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{s.label}
    </span>
  )
}

const ROLE_LABEL = { umum: 'Pelapor', admin: 'Admin', ob: 'Petugas OB' }

const NAV = {
  admin: [['/admin', 'Laporan', '📋'], ['/inspeksi', 'Inspeksi', '✅'], ['/rekap', 'Rekap', '📊'], ['/pemeliharaan', 'Pemeliharaan', '🛠']],
  ob: [['/ob', 'Tugas', '🧹'], ['/pemeliharaan', 'Pemeliharaan', '🛠']],
}

export function Shell({ title, subtitle, children, wide }) {
  const { profile, signOut } = useAuth()
  const initial = (profile?.full_name || '?').trim().charAt(0).toUpperCase()
  const nav = NAV[profile?.role] || []
  const linkCls = ({ isActive }) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${isActive ? 'bg-navy text-lime' : 'text-slate-600 hover:bg-mint'}`
  return (
    <div className="min-h-screen">
      <header className="sticky top-3 z-30 mx-auto mt-3 max-w-6xl px-3">
        <div className="flex items-center justify-between rounded-full bg-white/80 py-2 pl-3 pr-2 shadow-soft ring-1 ring-navy/5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold leading-none text-navy">SIMAK - CIMS</p>
              <p className="hidden text-[10px] font-semibold tracking-wide text-slate-400 sm:block">SURVEYOR INDONESIA MAKASSAR · CLEANING INSPECTION & MONITORING SYSTEM</p>
            </div>
          </div>
          {nav.length > 0 && (
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map(([to, label]) => <NavLink key={to} to={to} end className={linkCls}>{label}</NavLink>)}
            </nav>
          )}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-mint py-1 pl-1 pr-3 md:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-xs font-bold text-lime">{initial}</span>
              <span className="text-sm font-semibold text-navy">{profile?.full_name}</span>
              <span className="text-xs text-brand">{ROLE_LABEL[profile?.role]}</span>
            </div>
            <button onClick={signOut} className="btn-ghost !py-2">Keluar</button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 pt-8 sm:pt-10 ${wide ? 'max-w-3xl' : 'max-w-6xl'} ${nav.length ? 'pb-40 sm:pb-24' : 'pb-16'}`}>
        <div className="mb-6 animate-rise sm:mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500 sm:text-base">{subtitle}</p>}
        </div>
        {children}
      </main>

      {/* Menu bawah — khusus tampilan HP */}
      {nav.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
          <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
            {nav.map(([to, label, icon]) => (
              <NavLink key={to} to={to} end className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${isActive ? 'text-brand' : 'text-slate-400'}`}>
                <span className="text-lg leading-none">{icon}</span>{label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

// Dropup: menu pilihan yang terbuka ke ATAS (cocok untuk bar di bawah layar HP)
export function DropUp({ value, onChange, options, label, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open])
  const current = options.find((o) => o.value === value)
  return (
    <div ref={ref} className={`relative ${className}`}>
      {open && (
        <ul role="listbox" className="absolute bottom-full left-0 right-0 z-50 mb-2 animate-pop overflow-hidden rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-navy/10">
          {options.map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={o.value === value}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition ${o.value === value ? 'bg-navy text-lime' : 'text-navy hover:bg-mint'}`}>
                {o.label}{o.value === value && <span>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-full bg-navy px-4 py-3 text-sm font-bold text-white shadow-soft transition active:scale-[.98]">
        <span className="truncate">{label && <span className="mr-1.5 font-medium text-white/60">{label}</span>}{current?.label}</span>
        <span className={`text-lime transition ${open ? '' : 'rotate-180'}`}>▾</span>
      </button>
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl animate-pop overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-xl font-bold text-navy">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full bg-mint text-slate-500 transition hover:bg-navy hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StatCard({ label, value, tone = 'text-navy' }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-4xl font-extrabold tracking-tight ${tone}`}>{value}</p>
    </div>
  )
}

export function PhotoBox({ src, label, tone }) {
  return (
    <figure>
      <figcaption className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${tone === 'after' ? 'bg-lime text-navy' : 'bg-navy/5 text-slate-600'}`}>{label}</figcaption>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer">
          <img src={src} alt={label} className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-navy/10 transition hover:opacity-90" />
        </a>
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-mint/60 text-xs text-slate-400 ring-1 ring-dashed ring-brand/30">Belum ada foto</div>
      )}
    </figure>
  )
}

// Detail laporan + perbandingan Before/After — dipakai semua role
export function ReportDetail({ r }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoBox src={r.photo_before_url} label="Sebelum" />
        <PhotoBox src={r.photo_after_url} label="Sesudah" tone="after" />
      </div>
      <dl className="grid gap-4 rounded-2xl bg-surface p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Lokasi</dt><dd className="font-semibold text-navy">{r.location}</dd></div>
        <div><dt className="text-slate-500">Status</dt><dd className="mt-0.5"><StatusBadge status={r.status} /></dd></div>
        <div className="sm:col-span-2"><dt className="text-slate-500">Keterangan pelapor</dt><dd>{r.description}</dd></div>
        {r.ob_notes && <div className="sm:col-span-2"><dt className="text-slate-500">Catatan petugas</dt><dd>{r.ob_notes}</dd></div>}
        {r.admin_notes && <div className="rounded-xl bg-amber-50 p-3 text-amber-800 sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wide">Catatan tinjau ulang admin</dt><dd className="mt-0.5">{r.admin_notes}</dd></div>}
        <div><dt className="text-slate-500">Dilaporkan</dt><dd>{fmtDate(r.created_at)}</dd></div>
        <div><dt className="text-slate-500">Diperbarui</dt><dd>{fmtDate(r.updated_at)}</dd></div>
      </dl>
    </div>
  )
}

export function PhotoInput({ file, onChange, label }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) return setUrl(null)
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <label className="block cursor-pointer">
      <span className="mb-1.5 block text-sm font-semibold text-navy">{label}</span>
      <div className="grid min-h-40 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-brand/30 bg-mint/50 text-sm text-slate-500 transition hover:border-brand hover:bg-mint">
        {url ? <img src={url} alt="Pratinjau" className="max-h-64 w-full object-cover" /> : (
          <span className="flex flex-col items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl shadow-soft">📷</span>
            Ketuk untuk memilih atau memotret foto
          </span>
        )}
      </div>
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </label>
  )
}

export const Empty = ({ children }) => (
  <div className="py-12 text-center text-sm text-slate-500">{children}</div>
)
