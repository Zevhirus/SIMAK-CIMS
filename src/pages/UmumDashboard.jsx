import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { submitReport } from '../lib/api'
import { PhotoInput, Shell } from '../components/ui'

const AREAS = ['Lantai 1', 'Lantai 2', 'Lantai 3']

export default function UmumDashboard() {
  const { user } = useAuth()
  const [form, setForm] = useState({ area: AREAS[0], room: '', description: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!file) return setMsg({ ok: false, t: 'Foto area kotor wajib diunggah.' })
    setBusy(true); setMsg(null)
    try {
      await submitReport({ userId: user.id, location: `${form.area} — ${form.room}`, description: form.description, file })
      setForm({ area: AREAS[0], room: '', description: '' }); setFile(null)
      setMsg({ ok: true, t: 'Laporan terkirim. Admin akan segera memeriksanya.' })
    } catch (err) { setMsg({ ok: false, t: err.message }) }
    setBusy(false)
  }

  return (
    <Shell title="Laporan kebersihan" subtitle="Temukan area kotor? Kirim laporan di sini.">
      <form onSubmit={submit} className="card mx-auto max-w-xl space-y-4 p-5">
        <h2 className="font-bold text-navy">Buat laporan</h2>
        <PhotoInput label="Foto area kotor" file={file} onChange={setFile} />
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Kategori area</label>
          <select className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Detail ruangan</label>
          <input className="input" required placeholder="Mis. Toilet belakang, dekat tangga" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Keterangan keluhan</label>
          <textarea className="input min-h-24" required placeholder="Apa yang perlu dibersihkan?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? 'bg-mint text-blue-900' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim laporan'}</button>
      </form>
    </Shell>
  )
}
