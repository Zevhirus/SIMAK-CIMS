import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DAYS, FLOORS, KNOWER, SLOTS, VERIFIER,
  fetchInspection, mondayOf, ymd,
} from '../lib/api'
import { Shell, Spinner } from '../components/ui'

// ---- Rumus sama persis dengan lilila.xlsm (sheet LANTAI 1-3 & DASHBOARD) ----
// skor = jumlah ceklis ✓ × 0,5 ;  maksimal = jumlah area × 10 sel × 0,5
// kategori: >80 EXCELLENT · >=61 GOOD · >=41 FAIR · >=21 POOR · sisanya VERY POOR
const OK_POINT = 0.5
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const monthName = (d) => d.toLocaleString('id-ID', { month: 'long' })

function kategoriOf(skor) {
  if (skor > 80) return 'EXCELLENT'
  if (skor >= 61) return 'GOOD'
  if (skor >= 41) return 'FAIR'
  if (skor >= 21) return 'POOR'
  return 'VERY POOR'
}

function computeFloor(floorNo, rows) {
  const byItem = {}
  rows.forEach((r) => {
    if (!byItem[r.item]) byItem[r.item] = { ok: 0, x: 0 }
    if (r.status === 'OK') byItem[r.item].ok++
    else if (r.status === 'X') byItem[r.item].x++
  })
  const area = Object.keys(byItem).length // MASTER DATA K/L: jumlah baris = area tersimpan
  const ok = Object.values(byItem).reduce((n, v) => n + v.ok, 0)
  const x = Object.values(byItem).reduce((n, v) => n + v.x, 0)
  const skor = ok * OK_POINT
  const maks = area * 10 * OK_POINT
  return {
    floor: floorNo,
    petugas: FLOORS[floorNo].petugas.map((p) => p.name).join(' & '),
    jumlahPetugas: FLOORS[floorNo].petugas.length,
    area, skor, maks,
    capaian: maks ? skor / maks : null,
    kategori: area ? kategoriOf(skor) : null,
    ok, x,
  }
}

export default function Rekap() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const days = useMemo(() => DAYS.map((_, i) => addDays(monday, i)), [monday])
  const thursday = days[3]
  const weekNo = Math.ceil(thursday.getDate() / 7)
  const range = `${days[0].getDate()} - ${days[4].getDate()} ${monthName(days[4])} ${days[4].getFullYear()}`

  useEffect(() => {
    let off = false
    setRows(null); setErr('')
    Promise.all(
      Object.keys(FLOORS).map((f) => fetchInspection(Number(f), ymd(days[0]), ymd(days[4]))),
    )
      .then((all) => { if (!off) setRows(all) })
      .catch((e) => { if (!off) { setErr(e.message); setRows([[], [], []]) } })
    return () => { off = true }
  }, [monday]) // eslint-disable-line react-hooks/exhaustive-deps

  const floors = rows ? Object.keys(FLOORS).map((f, i) => computeFloor(Number(f), rows[i])) : []
  const ada = floors.filter((f) => f.area > 0)
  const total = {
    petugas: ada.reduce((n, f) => n + f.jumlahPetugas, 0),
    ok: floors.reduce((n, f) => n + f.ok, 0),
    x: floors.reduce((n, f) => n + f.x, 0),
    skor: floors.reduce((n, f) => n + f.skor, 0),
    maks: floors.reduce((n, f) => n + f.maks, 0),
  }
  const rataSkor = ada.length ? total.skor / ada.length : null // AL12 = AF12 / jumlah lantai berdata
  const kategoriSemua = rataSkor == null ? null : kategoriOf(rataSkor)

  return (
    <Shell wide title="Rekap penilaian" subtitle="Sistem poin sesuai formulir penilaian kebersihan.">
      {/* Navigasi minggu */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-white">
          <button aria-label="Minggu sebelumnya" onClick={() => setMonday(addDays(monday, -7))} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg active:scale-95">‹</button>
          <div className="min-w-0 text-center">
            <p className="font-display text-xl font-extrabold leading-tight">Minggu ke-{weekNo} ({monthName(thursday)} {thursday.getFullYear()})</p>
            <p className="text-xs font-semibold text-lime">{range}</p>
          </div>
          <button aria-label="Minggu berikutnya" onClick={() => setMonday(addDays(monday, 7))} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg active:scale-95">›</button>
        </div>
      </section>

      <div className="mt-3 flex justify-end">
        <button onClick={() => window.print()} disabled={!rows} className="btn-ghost !px-4 !py-2 !text-xs">🖨 Cetak rekap</button>
      </div>
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      {!rows ? <Spinner /> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Total petugas" value={total.petugas} />
            <Mini label="Rata-rata skor" value={rataSkor == null ? '–' : rataSkor.toFixed(1)} tone="text-brand" />
            <Mini label="Ceklis bersih (✓)" value={total.ok} tone="text-emerald-600" />
            <Mini label="Kategori" value={kategoriSemua || '–'} tone="text-amber-600" small />
          </div>

          <section className="card mt-4 overflow-hidden">
            <h2 className="border-b border-navy/5 px-4 py-3 font-bold text-navy">Rekap per lantai — minggu ini</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-mint/50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Lantai</th>
                    <th className="px-4 py-2.5 font-semibold">Petugas</th>
                    <th className="px-4 py-2.5 font-semibold">Area</th>
                    <th className="px-4 py-2.5 font-semibold">Skor</th>
                    <th className="px-4 py-2.5 font-semibold">Maks.</th>
                    <th className="px-4 py-2.5 font-semibold">Capaian</th>
                    <th className="px-4 py-2.5 font-semibold">Kategori</th>
                    <th className="px-4 py-2.5 font-semibold">✓</th>
                    <th className="px-4 py-2.5 font-semibold">✕</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {floors.map((f) => (
                    <tr key={f.floor}>
                      <td className="px-4 py-2.5 font-bold text-navy">Lantai {f.floor}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{f.petugas}</td>
                      <td className="px-4 py-2.5">{f.area || '–'}</td>
                      <td className="px-4 py-2.5 font-bold">{f.area ? f.skor.toFixed(1) : '–'}</td>
                      <td className="px-4 py-2.5">{f.area ? f.maks.toFixed(1) : '–'}</td>
                      <td className="px-4 py-2.5">{f.capaian == null ? '–' : `${(f.capaian * 100).toFixed(1)}%`}</td>
                      <td className="px-4 py-2.5 text-xs font-bold">{f.kategori || '–'}</td>
                      <td className="px-4 py-2.5 text-emerald-600 font-bold">{f.ok}</td>
                      <td className="px-4 py-2.5 text-rose-600 font-bold">{f.x}</td>
                    </tr>
                  ))}
                  <tr className="bg-mint/40 font-bold text-navy">
                    <td className="px-4 py-2.5" colSpan={2}>SEMUA LANTAI</td>
                    <td className="px-4 py-2.5">{floors.reduce((n, f) => n + f.area, 0)}</td>
                    <td className="px-4 py-2.5">{total.skor.toFixed(1)}</td>
                    <td className="px-4 py-2.5">{total.maks.toFixed(1)}</td>
                    <td className="px-4 py-2.5">{total.maks ? `${((total.skor / total.maks) * 100).toFixed(1)}%` : '–'}</td>
                    <td className="px-4 py-2.5 text-xs">{kategoriSemua || '–'}</td>
                    <td className="px-4 py-2.5 text-emerald-600">{total.ok}</td>
                    <td className="px-4 py-2.5 text-rose-600">{total.x}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-navy/5 px-4 py-3 text-[11px] text-slate-400">
              Kategori skor lantai: EXCELLENT &gt;80 · GOOD 61–80 · FAIR 41–60 · POOR 21–40 · VERY POOR ≤20 (skor = jumlah ✓ × 0,5)
            </p>
          </section>
        </>
      )}

      {/* Cetak — di-portal ke body agar tidak ikut tersembunyi aturan #root */}
      {rows && createPortal(
        <div id="print-root">
          <section className="print-page">
            <header className="print-head">
              <h1>REKAP PENILAIAN KEBERSIHAN</h1>
              <p>PT SURVEYOR INDONESIA CABANG MAKASSAR</p>
              <p>Minggu ke-{weekNo} ({monthName(thursday)} {thursday.getFullYear()}) · {range}</p>
            </header>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Lantai</th><th>Petugas</th><th>Area</th><th>Skor</th><th>Maks.</th><th>Capaian</th><th>Kategori</th><th>✓</th><th>✕</th>
                </tr>
              </thead>
              <tbody>
                {floors.map((f) => (
                  <tr key={f.floor}>
                    <td>Lantai {f.floor}</td><td>{f.petugas}</td><td>{f.area || '–'}</td>
                    <td>{f.area ? f.skor.toFixed(1) : '–'}</td><td>{f.area ? f.maks.toFixed(1) : '–'}</td>
                    <td>{f.capaian == null ? '–' : `${(f.capaian * 100).toFixed(1)}%`}</td>
                    <td>{f.kategori || '–'}</td><td>{f.ok}</td><td>{f.x}</td>
                  </tr>
                ))}
                <tr className="print-total">
                  <td colSpan={2}>SEMUA LANTAI</td>
                  <td>{floors.reduce((n, f) => n + f.area, 0)}</td>
                  <td>{total.skor.toFixed(1)}</td><td>{total.maks.toFixed(1)}</td>
                  <td>{total.maks ? `${((total.skor / total.maks) * 100).toFixed(1)}%` : '–'}</td>
                  <td>{kategoriSemua || '–'}</td><td>{total.ok}</td><td>{total.x}</td>
                </tr>
              </tbody>
            </table>
            <p className="print-sum">
              Total petugas: <b>{total.petugas}</b> · Rata-rata skor: <b>{rataSkor == null ? '–' : rataSkor.toFixed(1)}</b> · Kategori keseluruhan: <b>{kategoriSemua || '–'}</b>
            </p>
            <p className="print-foot">Kategori skor: EXCELLENT &gt;80 · GOOD 61–80 · FAIR 41–60 · POOR 21–40 · VERY POOR ≤20 (skor = jumlah ✓ × 0,5)</p>
            <div className="print-sign">
              {[['Petugas', Object.values(FLOORS).flatMap((f) => f.petugas)], ['Verifikasi', [VERIFIER]], ['Mengetahui', [KNOWER]]].map(([title, people]) => (
                <div key={title}>
                  <p>{title}</p>
                  <div className="print-sign-space" />
                  {people.map((p) => (<div key={p.name}><b>{p.name}</b><br /><span>{p.role}</span></div>))}
                </div>
              ))}
            </div>
            <p className="print-time">Dicetak {new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</p>
          </section>
        </div>, document.body)}
    </Shell>
  )
}

function Mini({ label, value, tone = 'text-navy', small }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-display font-extrabold tracking-tight ${small ? 'text-xl' : 'text-3xl'} ${tone}`}>{value}</p>
    </div>
  )
}
