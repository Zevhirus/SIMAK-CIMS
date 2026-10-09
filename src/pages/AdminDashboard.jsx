import { useCallback, useEffect, useState } from 'react'
import { accReport, approveAndAssign, deleteReport, fetchAllReports, fetchObUsers, rejectReport, requestRework, subscribeReports } from '../lib/api'
import { Empty, fmtDate, Modal, ReportDetail, Shell, Spinner, StatCard, StatusBadge } from '../components/ui'

const TABS = [['PENDING', 'Perlu verifikasi'], ['IN_PROGRESS', 'Dikerjakan'], ['COMPLETED', 'Perlu dicek'], ['VERIFIED', 'Selesai'], ['REJECTED', 'Ditolak'], ['ALL', 'Semua']]

export default function AdminDashboard() {
  const [reports, setReports] = useState(null)
  const [filter, setFilter] = useState('PENDING')
  const [sel, setSel] = useState(null)
  const [obId, setObId] = useState('')
  const [obUsers, setObUsers] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')
  const [redo, setRedo] = useState(false)   // form catatan tinjau ulang terbuka?
  const [redoNote, setRedoNote] = useState('')
  const [confirmDel, setConfirmDel] = useState(false) // konfirmasi hapus laporan

  const load = useCallback(() => fetchAllReports().then(setReports), [])
  useEffect(() => { load(); fetchObUsers().then(setObUsers).catch(() => {}) ; return subscribeReports((p) => {
      const msg = p.eventType === 'INSERT' ? 'Laporan baru masuk'
        : p.eventType === 'UPDATE' && p.new?.status === 'COMPLETED' ? 'OB selesai — menunggu pengecekan Anda' : ''
      if (msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }
      load()
    })
  }, [load])

  const count = (s) => reports?.filter((r) => r.status === s).length ?? 0
  const shown = reports?.filter((r) => filter === 'ALL' || r.status === filter)

  function open(r) { setSel(r); setObId(r.assigned_ob_id || ''); setErr(''); setRedo(false); setRedoNote(''); setConfirmDel(false) }
  async function act(fn) {
    setBusy(true); setErr('')
    try { await fn(); setSel(null); await load() } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  return (
    <Shell title="Dashboard admin" subtitle="Verifikasi laporan masuk dan tugaskan ke petugas OB.">
      {toast && <div className="fixed right-4 top-20 z-50 animate-pop rounded-full bg-navy px-5 py-2.5 text-lime text-sm font-semibold text-white shadow-lg">{toast}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Total laporan" value={reports?.length ?? '–'} />
        <StatCard label="Pending" value={count('PENDING')} tone="text-amber-600" />
        <StatCard label="In progress" value={count('IN_PROGRESS')} tone="text-brand" />
        <StatCard label="Perlu dicek" value={count('COMPLETED')} tone="text-violet-600" />
        <StatCard label="Selesai (ACC)" value={count('VERIFIED')} tone="text-emerald-600" />
        <StatCard label="Ditolak" value={count('REJECTED')} tone="text-rose-600" />
      </div>

      <section className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-navy/5 p-2">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === k ? 'bg-navy text-lime' : 'text-slate-600 hover:bg-mint'}`}>{l}</button>
          ))}
        </div>
        {!shown ? <Spinner /> : shown.length === 0 ? <Empty>Tidak ada laporan di kategori ini.</Empty> : (
          <>
            {/* HP: kartu, seluruh baris bisa diketuk — tanpa scroll ke samping */}
            <ul className="divide-y divide-navy/5 sm:hidden">
              {shown.map((r) => (
                <li key={r.id}>
                  <button onClick={() => open(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-mint/60">
                    <img src={r.photo_before_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.location}</p>
                      <p className="truncate text-xs text-slate-500">{r.description}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <span className="truncate text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-lg text-slate-300">›</span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Layar lebar: tabel, baris juga bisa diklik */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-mint/50 text-slate-500">
                  <tr><th className="px-4 py-2.5 font-semibold">Foto</th><th className="px-4 py-2.5 font-semibold">Lokasi</th><th className="px-4 py-2.5 font-semibold">Masuk</th><th className="px-4 py-2.5 font-semibold">Status</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {shown.map((r) => (
                    <tr key={r.id} onClick={() => open(r)} className="cursor-pointer transition hover:bg-mint/40">
                      <td className="px-4 py-2.5"><img src={r.photo_before_url} alt="" className="h-12 w-12 rounded-xl object-cover" /></td>
                      <td className="max-w-xs px-4 py-2.5"><p className="truncate font-semibold">{r.location}</p><p className="truncate text-xs text-slate-500">{r.description}</p></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5 text-right"><button className={r.status === 'PENDING' || r.status === 'COMPLETED' ? 'btn-primary' : 'btn-ghost'} onClick={(e) => { e.stopPropagation(); open(r) }}>{r.status === 'PENDING' ? 'Tinjau' : r.status === 'COMPLETED' ? 'Cek' : 'Detail'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.status === 'COMPLETED' ? 'Pengecekan hasil kerja' : 'Tinjau laporan'}>
        {sel && (
          <>
            <ReportDetail r={sel} />
            {sel.status === 'PENDING' && (
              <div className="mt-5 space-y-3 border-t border-navy/5 pt-4">
                <label className="block text-sm font-semibold">Pilih petugas OB</label>
                <select className="input" value={obId} onChange={(e) => setObId(e.target.value)}>
                  <option value="">Pilih OB…</option>
                  {obUsers.map((o) => <option key={o.user_id} value={o.user_id}>{o.full_name}</option>)}
                </select>
                {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary flex-1" disabled={busy || !obId} onClick={() => act(() => approveAndAssign(sel.id, obId))}>Setujui dan teruskan ke OB</button>
                  <button className="btn-danger" disabled={busy} onClick={() => act(() => rejectReport(sel.id))}>Tolak</button>
                </div>
              </div>
            )}

            {sel.status === 'COMPLETED' && (
              <div className="mt-5 space-y-3 border-t border-navy/5 pt-4">
                <p className="text-sm text-slate-500">Bandingkan foto sebelum &amp; sesudah. Jika sudah bersih, ACC. Jika belum, minta OB mengerjakan ulang.</p>
                {redo && (
                  <div className="animate-pop space-y-2">
                    <label className="block text-sm font-semibold">Catatan untuk OB (apa yang kurang?)</label>
                    <textarea className="input min-h-20" autoFocus placeholder="Mis. Sudut lantai masih berdebu, mohon dipel ulang" value={redoNote} onChange={(e) => setRedoNote(e.target.value)} />
                  </div>
                )}
                {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
                {!redo ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-ghost !border-amber-300 !text-amber-700" disabled={busy} onClick={() => setRedo(true)}>↩ Tinjau ulang</button>
                    <button className="btn-primary" disabled={busy} onClick={() => act(() => accReport(sel.id))}>✓ ACC</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-ghost" disabled={busy} onClick={() => setRedo(false)}>Batal</button>
                    <button className="btn-primary !bg-amber-500 hover:!bg-amber-600" disabled={busy || !redoNote.trim()} onClick={() => act(() => requestRework(sel.id, redoNote.trim()))}>Kirim ke OB</button>
                  </div>
                )}
              </div>
            )}
            <div className="mt-5 border-t border-navy/5 pt-4">
              {err && !confirmDel && sel.status !== 'PENDING' && sel.status !== 'COMPLETED' && <p className="mb-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
              {!confirmDel ? (
                <button className="btn-ghost w-full !border-rose-200 !text-rose-600" disabled={busy} onClick={() => setConfirmDel(true)}>🗑 Hapus laporan</button>
              ) : (
                <div className="animate-pop space-y-2">
                  <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Laporan beserta fotonya akan dihapus permanen dan tidak bisa dikembalikan. Yakin?</p>
                  {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-ghost" disabled={busy} onClick={() => setConfirmDel(false)}>Batal</button>
                    <button className="btn-danger" disabled={busy} onClick={() => act(() => deleteReport(sel))}>Ya, hapus</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </Shell>
  )
}
