import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { completeTask, fetchObTasks, subscribeReports } from '../lib/api'
import { Empty, fmtDate, Modal, PhotoInput, ReportDetail, Shell, Spinner, StatusBadge } from '../components/ui'

export default function ObDashboard() {
  const { user, profile } = useAuth()
  const [tasks, setTasks] = useState(null)
  const [sel, setSel] = useState(null)
  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => fetchObTasks(user.id).then(setTasks), [user.id])
  useEffect(() => { load(); return subscribeReports(load) }, [load])

  function open(t) { setSel(t); setFile(null); setNotes(''); setErr('') }

  async function finish(e) {
    e.preventDefault()
    if (!file) return setErr('Foto bukti hasil pembersihan wajib diunggah.')
    setBusy(true); setErr('')
    try { await completeTask({ reportId: sel.id, userId: user.id, file, notes }); setSel(null); await load() }
    catch (e2) { setErr(e2.message) }
    setBusy(false)
  }

  const todo = tasks?.filter((t) => t.status === 'IN_PROGRESS') ?? []
  const done = tasks?.filter((t) => t.status === 'COMPLETED' || t.status === 'VERIFIED') ?? []

  return (
    <Shell title="Tugas saya" subtitle="Bersihkan area yang ditugaskan, lalu unggah foto buktinya.">
      {!tasks ? <Spinner /> : (
        <>
          <h2 className="mb-3 font-bold text-navy">Perlu dikerjakan ({todo.length})</h2>
          {todo.length === 0 ? <div className="card"><Empty>Tidak ada tugas baru.</Empty></div> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {todo.map((t) => (
                <button key={t.id} onClick={() => open(t)} className="card overflow-hidden text-left transition hover:-translate-y-1 hover:shadow-lift">
                  {t.photo_before_url && <img src={t.photo_before_url} alt="" className="aspect-video w-full object-cover" />}
                  <div className="p-4">
                    {t.admin_notes && <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">↩ Perlu dikerjakan ulang: {t.admin_notes}</p>}
                    <p className="font-semibold">{t.location}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{t.description}</p>
                    <p className="mt-2 text-xs text-slate-400">{fmtDate(t.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <h2 className="mb-3 mt-8 font-bold text-navy">Riwayat selesai ({done.length})</h2>
          <div className="card divide-y divide-navy/5">
            {done.length === 0 ? <Empty>Belum ada tugas selesai.</Empty> : done.map((t) => (
              <button key={t.id} onClick={() => open(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-mint/40">
                {t.photo_after_url ? <img src={t.photo_after_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl bg-mint/60" />}
                <p className="min-w-0 flex-1 truncate font-semibold">{t.location}</p>
                <StatusBadge status={t.status} />
              </button>
            ))}
          </div>
        </>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.status === 'IN_PROGRESS' ? (sel.admin_notes ? 'Kerjakan ulang' : 'Selesaikan tugas') : 'Detail tugas'}>
        {sel && (
          sel.status !== 'IN_PROGRESS' ? <ReportDetail r={sel} /> : (
            <form onSubmit={finish} className="space-y-4">
              <ReportDetail r={sel} />
              <div className="space-y-4 border-t border-navy/5 pt-4">
                <PhotoInput label="Foto bukti setelah dibersihkan" file={file} onChange={setFile} />
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Keterangan tambahan</label>
                  <textarea className="input min-h-20" placeholder="Mis. Lantai sudah dipel dan didisinfeksi" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
                <button className="btn-primary w-full" disabled={busy}>{busy ? 'Mengirim…' : 'Tandai selesai'}</button>
              </div>
            </form>
          )
        )}
      </Modal>
    </Shell>
  )
}
