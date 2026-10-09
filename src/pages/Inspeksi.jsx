import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import {
  DAYS, FLOORS, KNOWER, SLOTS, VERIFIER,
  createInspectionTasks, fetchInspection, fetchInspectionLocks, fetchObUsers,
  lockInspection, mondayOf, saveInspection, saveInspectionBulk, uploadPhoto, ymd,
} from '../lib/api'
import { Modal, Shell, Spinner } from '../components/ui'
import InspeksiPrint from '../components/InspeksiPrint'

const key = (date, slot, item) => `${date}|${slot}|${item}`
const FLOOR_OPTIONS = Object.keys(FLOORS).map((n) => ({ value: Number(n), label: `Lantai ${n}` }))
const FOOTNOTE = 'Setiap pekerjaan yang berhasil diselesaikan akan diberikan nilai 1 (satu) poin sebagai salah satu indikator penilaian dalam perpanjangan kontrak. Tanda (X) menunjukkan bahwa pekerjaan pada hari tersebut tidak tuntas atau belum diselesaikan.'

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const monthName = (d) => d.toLocaleString('id-ID', { month: 'long' })

// "5 - 9 Oktober 2026" atau "28 September - 2 Oktober 2026"
function rangeLabel(a, b) {
  const y = b.getFullYear()
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} - ${b.getDate()} ${monthName(b)} ${y}`
    : `${a.getDate()} ${monthName(a)} - ${b.getDate()} ${monthName(b)} ${y}`
}

// baris database -> peta sel { 'tanggal|jam|area': { status, note } }
function toMap(rows) {
  const m = {}
  rows.forEach((r) => { m[key(r.check_date, r.slot, r.item)] = { status: r.status, note: r.note || '', photo: r.photo_url || '' } })
  return m
}

function initialDay() {
  const g = new Date().getDay() // 0=Min
  return g === 0 || g === 6 ? 4 : g - 1 // akhir pekan -> Jumat
}

export default function Inspeksi() {
  const { user } = useAuth()
  const [floor, setFloor] = useState(1)
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [dayIdx, setDayIdx] = useState(initialDay)
  const [slot, setSlot] = useState(() => (new Date().getHours() < 14 ? SLOTS[0] : SLOTS[1]))
  const [view, setView] = useState('harian')
  const [cells, setCells] = useState(null) // null = memuat
  const [err, setErr] = useState('')
  const [job, setJob] = useState(null)        // data yang akan dicetak
  const [preparing, setPreparing] = useState(false)
  const [lockedSlots, setLockedSlots] = useState([]) // jam yang sudah Selesai (mis. ['10:00']) -> tidak bisa diubah
  const [obUsers, setObUsers] = useState([])
  const [finishOpen, setFinishOpen] = useState(false)
  const [obForAll, setObForAll] = useState('') // satu OB untuk semua tugas dari item ✕
  const [busyF, setBusyF] = useState(false)

  const items = FLOORS[floor].items
  const locked = lockedSlots.includes(slot) // hanya jam yang sedang dipilih
  const days = useMemo(() => DAYS.map((_, i) => addDays(monday, i)), [monday])
  const thursday = days[3]
  const weekNo = Math.ceil(thursday.getDate() / 7) // minggu ke-n pada bulan (berdasarkan hari Kamis)
  const date = ymd(days[dayIdx])

  // Muat data lantai + minggu terpilih
  useEffect(() => {
    let off = false
    setCells(null); setErr('')
    fetchInspection(floor, ymd(days[0]), ymd(days[4]))
      .then((rows) => {
        if (off) return
        setCells(toMap(rows))
      })
      .catch((e) => { if (!off) { setErr(e.message); setCells({}) } })
    fetchInspectionLocks(floor, ymd(days[0]))
      .then((l) => { if (!off) setLockedSlots(l) })
      .catch(() => { if (!off) setLockedSlots([]) })
    return () => { off = true }
  }, [floor, days])

  const get = (d, s, item) => cells?.[key(d, s, item)] || { status: null, note: '', photo: '' }

  // Simpan 1 sel (optimistik; kembalikan bila gagal)
  const update = useCallback(async (item, patch) => {
    if (locked) return
    const k = key(date, slot, item)
    const prev = cells?.[k]
    const next = { status: null, note: '', photo: '', ...prev, ...patch }
    setCells((c) => ({ ...c, [k]: next }))
    try {
      await saveInspection({ floor, date, slot, item, status: next.status, note: next.note, photoUrl: next.photo, userId: user.id })
      setErr('')
    } catch (e) {
      setCells((c) => ({ ...c, [k]: prev || { status: null, note: '', photo: '' } }))
      setErr(e.message)
    }
  }, [cells, date, slot, floor, user.id, locked])

  const toggle = (item, st) => {
    if (locked) return
    const cur = get(date, slot, item).status
    if (cur === st) return update(item, { status: null, note: '', photo: '' })
    if (st === 'OK') return update(item, { status: 'OK', note: '', photo: '' })
    update(item, { status: 'X' })
  }

  async function markAllOk() {
    if (locked) return
    const blanks = items.filter((it) => !get(date, slot, it).status)
    if (!blanks.length) return
    const prev = cells
    setCells((c) => { const n = { ...c }; blanks.forEach((it) => { n[key(date, slot, it)] = { ...get(date, slot, it), status: 'OK' } }); return n })
    try {
      await saveInspectionBulk(blanks.map((item) => ({
        floor, check_date: date, slot, item, status: 'OK', note: null, photo_url: null, checked_by: user.id,
      })))
      setErr('')
    } catch (e) { setCells(prev); setErr(e.message) }
  }

  // Ringkasan hari + sesi terpilih
  const sum = { ok: 0, x: 0, blank: 0 }
  items.forEach((it) => {
    const s = get(date, slot, it).status
    if (s === 'OK') sum.ok++; else if (s === 'X') sum.x++; else sum.blank++
  })

  // Total poin seminggu (rekap)
  let weekPoints = 0
  days.forEach((d) => SLOTS.forEach((s) => items.forEach((it) => { if (get(ymd(d), s, it).status === 'OK') weekPoints++ })))

  // Status kelengkapan tiap hari (untuk titik indikator)
  const dayState = days.map((d) => {
    const filled = SLOTS.reduce((n, s) => n + items.filter((it) => get(ymd(d), s, it).status).length, 0)
    return filled === 0 ? 'none' : filled === items.length * SLOTS.length ? 'full' : 'part'
  })

  // Cetak: ambil data lantai terpilih (atau semua lantai) lalu buka dialog cetak browser
  async function doPrint(all) {
    setPreparing(true); setErr('')
    try {
      const ids = all ? Object.keys(FLOORS).map(Number) : [floor]
      const sheets = await Promise.all(ids.map(async (f) => ({
        floor: f,
        map: f === floor && cells ? cells : toMap(await fetchInspection(f, ymd(days[0]), ymd(days[4]))),
      })))
      setJob({ sheets, days, meta: { weekNo, monthYear: `${monthName(thursday)} ${thursday.getFullYear()}`, range: rangeLabel(days[0], days[4]), footnote: FOOTNOTE } })
    } catch (e) { setErr(e.message) }
    setPreparing(false)
  }
  useEffect(() => {
    if (!job) return
    const t = setTimeout(() => window.print(), 150)
    return () => clearTimeout(t)
  }, [job])

  const photoRows = []
  days.forEach((d, di) => SLOTS.forEach((s) => items.forEach((it) => {
    const c = get(ymd(d), s, it)
    if (c.photo) photoRows.push({ k: key(ymd(d), s, it), day: DAYS[di][1], s, it, photo: c.photo })
  })))

  // Semua sel berstatus ✕ di minggu ini (untuk tugas OB setelah "Selesai")
  // Hanya untuk jam yang sedang dipilih — jam lain tidak ikut
  const xRows = []
  days.forEach((d, di) => items.forEach((it) => {
    const c = get(ymd(d), slot, it)
    if (c.status === 'X') xRows.push({ k: key(ymd(d), slot, it), date: ymd(d), day: DAYS[di][1], s: slot, it, photo: c.photo })
  }))

  async function openFinish() {
    setErr('')
    try { const list = await fetchObUsers(); setObUsers(list); setObForAll(''); setFinishOpen(true) }
    catch (e) { setErr(e.message) }
  }

  async function confirmFinish() {
    setBusyF(true); setErr('')
    try {
      const target = obForAll || obUsers[0]?.user_id
      if (xRows.length && !target) throw new Error('Belum ada akun OB. Buat dulu akun OB.')
      if (xRows.length) {
        await createInspectionTasks(xRows.map((r) => ({
          user_id: user.id,
          location: r.it,
          description: `Inspeksi Lantai ${floor} · ${r.day} ${r.date} · ${r.s} — tidak tuntas`,
          photo_before_url: r.photo || null,
          status: 'IN_PROGRESS',
          assigned_ob_id: target,
        })))
      }
      await lockInspection(floor, ymd(days[0]), slot)
      setLockedSlots((l) => [...l, slot])
      setFinishOpen(false)
    } catch (e) { setErr(e.message) }
    setBusyF(false)
  }

  return (
    <Shell wide title="Inspeksi kebersihan" subtitle="Checklist pengecekan area per lantai, dua kali sehari.">
      {/* Kepala formulir (meniru formulir kertas) */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-white">
          <button aria-label="Minggu sebelumnya" onClick={() => setMonday(addDays(monday, -7))} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg active:scale-95">‹</button>
          <div className="min-w-0 text-center">
            <p className="font-display text-xl font-extrabold leading-tight">Lantai {floor}</p>
            <p className="text-xs text-white/80">Minggu ke-{weekNo} ({monthName(thursday)} {thursday.getFullYear()})</p>
            <p className="text-xs font-semibold text-lime">{rangeLabel(days[0], days[4])}</p>
          </div>
          <button aria-label="Minggu berikutnya" onClick={() => setMonday(addDays(monday, 7))} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg active:scale-95">›</button>
        </div>

        {view === 'harian' && (
          <>
            {/* Pilih hari: SN SL RB KM JM */}
            <div className="grid grid-cols-5 gap-1.5 p-3">
              {DAYS.map(([code], i) => (
                <button key={code} onClick={() => setDayIdx(i)} aria-pressed={dayIdx === i}
                  className={`relative rounded-2xl py-2 text-center transition active:scale-95 ${dayIdx === i ? 'bg-brand text-white shadow-lift' : 'bg-mint text-navy'}`}>
                  <span className="block text-xs font-bold">{code}</span>
                  <span className="block font-display text-lg font-extrabold leading-tight">{days[i].getDate()}</span>
                  <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${dayState[i] === 'full' ? 'bg-emerald-400' : dayState[i] === 'part' ? 'bg-amber-400' : 'bg-transparent'}`} />
                </button>
              ))}
            </div>

            {/* Pilih jam kontrol */}
            <div className="mx-3 mb-3 grid grid-cols-2 rounded-full bg-mint p-1">
              {SLOTS.map((s) => (
                <button key={s} onClick={() => setSlot(s)} aria-pressed={slot === s}
                  className={`rounded-full py-2 text-sm font-bold transition ${slot === s ? 'bg-white text-navy shadow-soft' : 'text-slate-500'}`}>{lockedSlots.includes(s) ? '🔒' : '🕙'} {s}</button>
              ))}
            </div>

            {/* Ringkasan */}
            <div className="border-t border-navy/5 px-4 py-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-navy">{DAYS[dayIdx][1]}, {days[dayIdx].getDate()} {monthName(days[dayIdx])} · {slot}</span>
                <span className="text-slate-500">{sum.ok + sum.x}/{items.length} terisi</span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-mint">
                <div className="bg-emerald-500 transition-all" style={{ width: `${(sum.ok / items.length) * 100}%` }} />
                <div className="bg-rose-500 transition-all" style={{ width: `${(sum.x / items.length) * 100}%` }} />
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <span className="font-bold text-emerald-600">✓ {sum.ok} poin</span>
                <span className="font-bold text-rose-600">✕ {sum.x} tidak tuntas</span>
                <span className="text-slate-400">{sum.blank} belum</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Pilih lantai yang akan diinspeksi */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-mint p-1.5">
        {FLOOR_OPTIONS.map((o) => (
          <button key={o.value} onClick={() => setFloor(o.value)} aria-pressed={floor === o.value}
            className={`rounded-xl py-2.5 text-sm font-bold transition active:scale-95 ${floor === o.value ? 'bg-white text-navy shadow-soft' : 'text-slate-500'}`}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => doPrint(false)} disabled={preparing || !cells} className="btn-ghost !px-4 !py-2 !text-xs">🖨 Cetak Lantai {floor}</button>
        <button onClick={() => doPrint(true)} disabled={preparing || !cells} className="btn-ghost !px-4 !py-2 !text-xs">🖨 Cetak semua lantai</button>
        {!locked && (
          <button onClick={openFinish} disabled={!cells} className="btn-primary !px-4 !py-2 !text-xs">✓ Selesai {slot}</button>
        )}
      </div>
      {/* Modal Selesai: tugaskan setiap sel ✕ ke OB */}
      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title={`Selesaikan inspeksi Lantai ${floor} · ${slot}`}>
        {xRows.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada item yang ditandai ✕ pada jam {slot} minggu ini. Hasil jam {slot} akan dikunci dan tidak perlu penugasan.</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">{xRows.length} item tidak tuntas (jam {slot}). Semua akan ditugaskan ke OB:</p>
            <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-sm">
              {xRows.map((r) => (
                <li key={r.k} className="rounded-xl bg-surface p-2.5">
                  <span className="font-semibold text-navy">{r.it}</span>
                  <span className="text-xs text-slate-500"> · {r.day} · {r.date} · {r.s}</span>
                </li>
              ))}
            </ul>
            <select className="input mt-3" value={obForAll} onChange={(e) => setObForAll(e.target.value)}>
              <option value="">Pilih OB…</option>
              {obUsers.map((o) => <option key={o.user_id} value={o.user_id}>{o.full_name}</option>)}
            </select>
          </>
        )}
        {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
        <button className="btn-primary mt-4 w-full" disabled={busyF || (xRows.length > 0 && !obForAll)} onClick={confirmFinish}>
          {busyF ? 'Memproses…' : 'Selesai & tugaskan'}
        </button>
      </Modal>

      {job && createPortal(<InspeksiPrint {...job} />, document.body)}

      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

      {locked && (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
          ✓ Hasil inspeksi jam {slot} minggu ini sudah diselesaikan dan tidak dapat diubah.
        </p>
      )}

      {!cells ? <Spinner /> : view === 'harian' ? (
        <section className="card mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-navy/5 px-4 py-3">
            <h2 className="font-bold text-navy">Kondisi kebersihan</h2>
            <button onClick={markAllOk} disabled={sum.blank === 0 || locked} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 transition active:scale-95 disabled:opacity-40">✓ Semua tuntas</button>
          </div>
          <ul className="divide-y divide-navy/5">
            {items.map((it) => (
              <Row key={`${floor}-${date}-${slot}-${it}`} item={it} cell={get(date, slot, it)} locked={locked}
                onToggle={(st) => toggle(it, st)} onPhoto={(url) => update(it, { photo: url })} />
            ))}
          </ul>
        </section>
      ) : (
        <Rekap items={items} days={days} get={get} floor={floor} weekPoints={weekPoints} photoRows={photoRows} />
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-slate-400">*{FOOTNOTE}</p>

      {/* Bar bawah: Dropup lantai + tampilan. Di HP berada tepat di atas menu bawah */}
      <div className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-3xl items-center justify-center gap-2 rounded-full bg-white/95 p-1.5 shadow-lift ring-1 ring-navy/10 backdrop-blur-xl sm:bottom-4">
        <div className="grid shrink-0 grid-cols-2 rounded-full bg-mint p-1">
          {[['harian', 'Harian'], ['rekap', 'Rekap']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${view === v ? 'bg-white text-navy shadow-soft' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </div>
    </Shell>
  )
}

function Row({ item, cell, onToggle, onPhoto, locked }) {
  const [uploading, setUploading] = useState(false)
  const { user } = useAuth()
  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadPhoto(file, user.id, 'inspeksi')
      onPhoto(url)
    } catch { /* diabaikan; user bisa coba lagi */ }
    setUploading(false)
    e.target.value = ''
  }
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-navy">{item}</p>
        <button aria-label={`${item} tuntas`} aria-pressed={cell.status === 'OK'} onClick={() => onToggle('OK')} disabled={locked}
          className={`grid h-11 w-11 place-items-center rounded-2xl text-xl font-bold transition active:scale-90 ${cell.status === 'OK' ? 'bg-emerald-500 text-white shadow-soft' : 'bg-white text-slate-300 ring-1 ring-slate-200'} ${locked ? 'opacity-60' : ''}`}>✓</button>
        <button aria-label={`${item} tidak tuntas`} aria-pressed={cell.status === 'X'} onClick={() => onToggle('X')} disabled={locked}
          className={`grid h-11 w-11 place-items-center rounded-2xl text-xl font-bold transition active:scale-90 ${cell.status === 'X' ? 'bg-rose-500 text-white shadow-soft' : 'bg-white text-slate-300 ring-1 ring-slate-200'} ${locked ? 'opacity-60' : ''}`}>✕</button>
      </div>
      {cell.status === 'X' && (
        <div className="mt-2 flex items-center gap-3">
          <label className="cursor-pointer rounded-xl bg-mint px-3 py-2 text-xs font-bold text-navy ring-1 ring-navy/10 active:scale-95">
            {uploading ? 'Mengunggah…' : cell.photo ? '📷 Ganti foto' : '📷 Tambah foto'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} disabled={uploading} />
          </label>
          {cell.photo && <a href={cell.photo} target="_blank" rel="noreferrer"><img src={cell.photo} alt="Bukti" className="h-12 w-12 rounded-xl object-cover ring-1 ring-navy/10" /></a>}
          {!cell.photo && !uploading && <p className="text-xs text-slate-400">Wajib foto bukti kondisi</p>}
        </div>
      )}
    </li>
  )
}

// Rekap mingguan — tampilan seperti tabel di formulir kertas
function Rekap({ items, days, get, floor, weekPoints, photoRows }) {
  const f = FLOORS[floor]
  return (
    <>
      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy/5 px-4 py-3">
          <h2 className="font-bold text-navy">Rekap minggu ini</h2>
          <span className="rounded-full bg-lime px-3 py-1 text-xs font-extrabold text-navy">{weekPoints} poin</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-center text-xs">
            <thead>
              <tr className="bg-mint/60 text-navy">
                <th rowSpan={2} className="sticky left-0 z-10 min-w-[8.5rem] bg-mint px-3 py-2 text-left font-bold">Kondisi kebersihan</th>
                {SLOTS.map((s) => <th key={s} colSpan={5} className="border-l border-navy/10 py-1.5 font-bold">{s}</th>)}
              </tr>
              <tr className="bg-mint/60 text-slate-500">
                {SLOTS.map((s) => DAYS.map(([c], i) => (
                  <th key={s + c} className={`w-9 py-1 font-semibold ${i === 0 ? 'border-l border-navy/10' : ''}`}>{c}</th>
                )))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {items.map((it) => (
                <tr key={it}>
                  <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-navy">{it}</th>
                  {SLOTS.map((s) => days.map((d, i) => {
                    const st = get(ymd(d), s, it).status
                    return (
                      <td key={s + i} className={`h-9 w-9 text-sm font-bold ${i === 0 ? 'border-l border-navy/10' : ''} ${st === 'OK' ? 'text-emerald-600' : st === 'X' ? 'bg-rose-50 text-rose-600' : 'text-slate-200'}`}>
                        {st === 'OK' ? '✓' : st === 'X' ? '✕' : '·'}
                      </td>
                    )
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {photoRows && photoRows.length > 0 && (
        <section className="card mt-4 p-4">
          <h2 className="mb-2 font-bold text-navy">Foto bukti (tidak tuntas)</h2>
          <ul className="space-y-2 text-sm">
            {photoRows.map((r) => (
              <li key={r.k} className="flex items-center gap-3 rounded-xl bg-surface p-3">
                <a href={r.photo} target="_blank" rel="noreferrer"><img src={r.photo} alt="Bukti" className="h-14 w-14 rounded-xl object-cover ring-1 ring-navy/10" /></a>
                <p className="text-xs font-semibold text-slate-500">{r.day} · {r.s} · {r.it}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tanda tangan sesuai formulir */}
      <section className="card mt-4 grid grid-cols-3 gap-2 p-4 text-center text-xs">
        <Sign title="Petugas" people={f.petugas} />
        <Sign title="Verifikasi" people={[VERIFIER]} />
        <Sign title="Mengetahui" people={[KNOWER]} />
      </section>
    </>
  )
}

function Sign({ title, people }) {
  return (
    <div className="flex flex-col">
      <p className="font-bold text-navy">{title}</p>
      <div className="h-10" />
      <div className="mt-auto space-y-1.5">
        {people.map((p) => (
          <div key={p.name}>
            <p className="font-bold text-navy underline">{p.name}</p>
            <p className="text-slate-500">{p.role}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
