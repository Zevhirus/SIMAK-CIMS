import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  DAMAGE_STATUS, FLOORS, KONDISI_OPSI, URAIAN_OPSI, deleteDamageReport, fetchAllDamageReports,
  fetchMyDamageReports, setDamageStatus, submitDamageReport, subscribeDamageReports, uploadPhoto,
} from '../lib/api'
import { Empty, fmtDate, Modal, PhotoInput, Shell, Spinner } from '../components/ui'

function Badge({ status }) {
  const s = DAMAGE_STATUS[status] || DAMAGE_STATUS.BARU
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{s.label}
    </span>
  )
}

export default function Pemeliharaan() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState(null)
  const [sel, setSel] = useState(null)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')

  // form lapor (OB)
  const [lantai, setLantai] = useState('1')
  const [area, setArea] = useState('')
  const [uraian, setUraian] = useState('')
  const [kondisi, setKondisi] = useState('Kotor')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)

  // tindak lanjut admin
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [busyA, setBusyA] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const load = useCallback(
    () => (isAdmin ? fetchAllDamageReports() : fetchMyDamageReports(user.id)).then(setRows),
    [isAdmin, user.id],
  )
  useEffect(() => { load() }, [load])

  // Admin: notifikasi realtime saat ada laporan pemeliharaan baru dari OB
  useEffect(() => {
    if (!isAdmin) return
    let t
    const off = subscribeDamageReports((p) => {
      if (p.eventType === 'INSERT') {
        const r = p.new || {}
        setToast(`Ada pengaduan baru${r.reporter_name ? ` dari ${r.reporter_name}` : ''}${r.uraian ? ` — ${r.uraian}` : ''}`)
        clearTimeout(t); t = setTimeout(() => setToast(''), 5000)
      }
      load()
    })
    return () => { clearTimeout(t); off() }
  }, [isAdmin, load])

  // Area mengikuti lantai yang dipilih (daftar sama dengan menu Inspeksi)
  const areaOpsi = FLOORS[Number(lantai)]?.items ?? []

  async function submit(e) {
    e.preventDefault()
    if (!area) return setErr('Pilih area terlebih dahulu.')
    if (!uraian) return setErr('Pilih uraian terlebih dahulu.')
    setBusy(true); setErr('')
    try {
      let photo_url = null
      if (photo) photo_url = await uploadPhoto(photo, user.id, 'pemeliharaan')
      await submitDamageReport({ userId: user.id, reporterName: profile?.full_name, lantai: Number(lantai), area: area.trim(), uraian, kondisi, photoUrl: photo_url })
      setArea(''); setUraian(''); setKondisi('Kotor'); setPhoto(null)
      await load()
    } catch (e2) { setErr(e2.message) }
    setBusy(false)
  }

  function open(r) { setSel(r); setNotes(r.admin_notes || ''); setFile(null); setErr(''); setConfirmDel(false) }

  async function tinjau() {
    setBusyA(true); setErr('')
    try { await setDamageStatus(sel.id, 'DIPROSES', notes.trim()); setSel(null); await load() }
    catch (e2) { setErr(e2.message) }
    setBusyA(false)
  }

  async function eksekusi(e) {
    e.preventDefault()
    if (!file) return setErr('Foto bukti eksekusi wajib diunggah.')
    setBusyA(true); setErr('')
    try {
      const url = await uploadPhoto(file, user.id, 'pemeliharaan')
      await setDamageStatus(sel.id, 'SELESAI', notes.trim(), url)
      setSel(null); await load()
    } catch (e2) { setErr(e2.message) }
    setBusyA(false)
  }

  return (
    <Shell wide title="Pemeliharaan" subtitle={isAdmin ? 'Tinjau & tindak lanjuti laporan pemeliharaan dari OB.' : 'Laporkan kondisi area/peralatan, lalu pantau statusnya.'}>
      {toast && <div className="fixed right-4 top-20 z-50 animate-pop rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-lg">🔔 {toast}</div>}
      {!isAdmin && (
        <section className="card mb-6 p-5">
          <h2 className="mb-4 font-bold text-navy">Buat laporan</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Lantai</label>
              <select className="input" value={lantai} onChange={(e) => { setLantai(e.target.value); setArea('') }}>
                <option value="1">Lantai 1</option>
                <option value="2">Lantai 2</option>
                <option value="3">Lantai 3</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Area</label>
              <select className="input" required value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Pilih area…</option>
                {areaOpsi.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Uraian</label>
              <select className="input" required value={uraian} onChange={(e) => setUraian(e.target.value)}>
                <option value="">Pilih uraian…</option>
                {URAIAN_OPSI.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Kondisi</label>
              <select className="input" value={kondisi} onChange={(e) => setKondisi(e.target.value)}>
                {KONDISI_OPSI.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <PhotoInput label="Foto kondisi (opsional)" file={photo} onChange={setPhoto} />
            {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Mengirim…' : 'Lapor'}</button>
          </form>
        </section>
      )}

      <h2 className="mb-3 font-bold text-navy">{isAdmin ? 'Semua laporan' : 'Laporan saya'} ({rows?.length ?? 0})</h2>
      {!rows ? <Spinner /> : rows.length === 0 ? <div className="card"><Empty>Belum ada laporan pemeliharaan.</Empty></div> : (
        <ul className="card divide-y divide-navy/5 overflow-hidden">
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => open(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-mint/40">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-mint text-xl">🛠</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.uraian || r.item || '—'}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.lantai ? `Lantai ${r.lantai}` : ''}{r.area ? ` · ${r.area}` : ''}{isAdmin && r.reporter_name ? ` · ${r.reporter_name}` : ''}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge status={r.status} />
                    {r.kondisi && <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs font-semibold text-navy">{r.kondisi}</span>}
                    <span className="truncate text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                  </div>
                </div>
                <span className="shrink-0 text-lg text-slate-300">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} title={isAdmin ? 'Tindak lanjuti laporan' : 'Detail laporan'}>
        {sel && (
          <>
            <dl className="grid gap-4 rounded-2xl bg-surface p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Lantai</dt><dd className="font-semibold text-navy">{sel.lantai ? `Lantai ${sel.lantai}` : '—'}</dd></div>
              <div><dt className="text-slate-500">Area</dt><dd className="font-semibold text-navy">{sel.area || '—'}</dd></div>
              <div><dt className="text-slate-500">Uraian</dt><dd className="font-semibold text-navy">{sel.uraian || sel.item || '—'}</dd></div>
              <div><dt className="text-slate-500">Kondisi</dt><dd className="font-semibold text-navy">{sel.kondisi || '—'}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd className="mt-0.5"><Badge status={sel.status} /></dd></div>
              <div><dt className="text-slate-500">Pelapor</dt><dd className="font-semibold text-navy">{sel.reporter_name || '—'}</dd></div>
              {sel.admin_notes && <div className="rounded-xl bg-amber-50 p-3 text-amber-800 sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wide">Catatan admin</dt><dd className="mt-0.5">{sel.admin_notes}</dd></div>}
              <div><dt className="text-slate-500">Dilaporkan</dt><dd>{fmtDate(sel.created_at)}</dd></div>
            </dl>

            {sel.photo_url && (
              <a href={sel.photo_url} target="_blank" rel="noreferrer" className="mt-4 block">
                <p className="mb-1 text-xs font-bold text-slate-500">Foto dari OB</p>
                <img src={sel.photo_url} alt="Foto OB" className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-navy/10" />
              </a>
            )}
            {sel.photo_bukti_url && (
              <a href={sel.photo_bukti_url} target="_blank" rel="noreferrer" className="mt-4 block">
                <p className="mb-1 text-xs font-bold text-slate-500">Foto bukti admin</p>
                <img src={sel.photo_bukti_url} alt="Foto bukti" className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-navy/10" />
              </a>
            )}

            {isAdmin && sel.status === 'BARU' && (
              <div className="mt-5 space-y-3 border-t border-navy/5 pt-4">
                <textarea className="input min-h-20" placeholder="Catatan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
                <button className="btn-primary w-full" disabled={busyA} onClick={tinjau}>{busyA ? 'Memproses…' : 'Tinjau (jadi Diproses)'}</button>
              </div>
            )}

            {isAdmin && sel.status === 'DIPROSES' && (
              <form onSubmit={eksekusi} className="mt-5 space-y-3 border-t border-navy/5 pt-4">
                <textarea className="input min-h-20" placeholder="Catatan eksekusi (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <PhotoInput label="Foto bukti eksekusi" file={file} onChange={setFile} />
                {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
                <button className="btn-primary w-full" disabled={busyA}>{busyA ? 'Menyimpan…' : 'Eksekusi selesai'}</button>
              </form>
            )}

            {isAdmin && (
              <div className="mt-5 border-t border-navy/5 pt-4">
                {!confirmDel ? (
                  <button className="btn-ghost w-full !border-rose-200 !text-rose-600" disabled={busyA} onClick={() => setConfirmDel(true)}>🗑 Hapus laporan</button>
                ) : (
                  <div className="animate-pop space-y-2">
                    <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Laporan akan dihapus permanen. Yakin?</p>
                    {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <button className="btn-ghost" disabled={busyA} onClick={() => setConfirmDel(false)}>Batal</button>
                      <button className="btn-danger" disabled={busyA} onClick={async () => {
                        setBusyA(true); setErr('')
                        try { await deleteDamageReport(sel); setSel(null); await load() }
                        catch (e2) { setErr(e2.message) }
                        setBusyA(false)
                      }}>{busyA ? 'Menghapus…' : 'Ya, hapus'}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </Shell>
  )
}
