// Notifikasi WhatsApp via Fonnte. Satu fungsi, tiga kejadian:
//  1) Laporan baru masuk (INSERT, PENDING)            -> semua ADMIN
//  2) OB selesai mengerjakan (-> COMPLETED)           -> semua ADMIN (menunggu pengecekan)
//  3) Laporan ditugaskan / ditinjau ulang (-> IN_PROGRESS) -> OB terkait
// Secrets: FONNTE_TOKEN, WEBHOOK_SECRET, APP_URL (opsional)
import { createClient } from 'npm:@supabase/supabase-js@2'

const normalize = (p: string) => {
  const d = p.replace(/\D/g, '')
  return d.startsWith('0') ? '62' + d.slice(1) : d
}

async function send(phone: string, message: string) {
  const form = new FormData()
  form.append('target', normalize(phone))
  form.append('message', message)
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: Deno.env.get('FONNTE_TOKEN')! },
    body: form,
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || out.status === false) console.error('Fonnte gagal:', phone, out)
  return res.ok && out.status !== false
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const { type, record: r, old_record: old } = await req.json()
  if (!r) return Response.json({ skipped: 'no record' })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const app = Deno.env.get('APP_URL')
  const link = (path: string) => (app ? `\n\nBuka: ${app}${path}` : '')

  // ---- Ke ADMIN ----------------------------------------------------------
  const isNew = type === 'INSERT' && r.status === 'PENDING'
  const isDone = type === 'UPDATE' && r.status === 'COMPLETED' && old?.status !== 'COMPLETED'
  if (isNew || isDone) {
    const { data: admins } = await db.from('profiles').select('phone').eq('role', 'admin').not('phone', 'is', null)
    const phones = (admins ?? []).map((a) => a.phone).filter(Boolean)
    if (!phones.length) return Response.json({ skipped: 'belum ada admin dengan nomor WA' })

    let message: string
    if (isNew) {
      message =
        `📋 *Laporan kebersihan baru*\n\nLokasi: ${r.location}\nKeterangan: ${r.description}\n\n` +
        `Foto: ${r.photo_before_url}\n\nMohon diverifikasi dan ditugaskan ke OB.${link('/admin')}`
    } else {
      const { data: ob } = await db.from('profiles').select('full_name').eq('user_id', r.assigned_ob_id).single()
      message =
        `✅ *Tugas selesai — menunggu pengecekan Anda*\n\nLokasi: ${r.location}\nPetugas: ${ob?.full_name || 'OB'}\n` +
        `${r.ob_notes ? `Catatan OB: ${r.ob_notes}\n` : ''}\nFoto sesudah: ${r.photo_after_url}\n\nSilakan ACC atau tinjau ulang.${link('/admin')}`
    }
    const results = await Promise.all(phones.map((p) => send(p, message)))
    return Response.json({ to: 'admin', sent: results.filter(Boolean).length, total: phones.length })
  }

  // ---- Ke OB (ditugaskan / ditinjau ulang) -------------------------------
  if (r.status === 'IN_PROGRESS' && (r.assigned_ob_id || r.assigned_floor)) {
    // Tinjau ulang -> OB yang mengerjakan; penugasan baru -> semua OB di lantai tsb
    const q = db.from('profiles').select('full_name, phone').not('phone', 'is', null)
    const { data: obs } = r.admin_notes && r.assigned_ob_id
      ? await q.eq('user_id', r.assigned_ob_id)
      : await q.eq('role', 'ob').eq('floor', r.assigned_floor)
    if (!obs?.length) return Response.json({ skipped: 'OB belum punya nomor WA / lantai' })

    const redo = r.admin_notes ? `\n\nCatatan admin (perlu dikerjakan ulang): ${r.admin_notes}` : ''
    const results = await Promise.all(obs.map((ob) => send(ob.phone,
      `Halo ${ob.full_name || 'Petugas'}, ${r.admin_notes ? 'tugas kebersihan Anda perlu ditinjau ulang.' : 'ada tugas kebersihan baru untuk Anda.'}\n\n` +
      `Lokasi: ${r.location}\nKeterangan: ${r.description}\n\nFoto: ${r.photo_before_url}${redo}${link('/ob')}`)))
    return Response.json({ to: 'ob', sent: results.filter(Boolean).length, total: obs.length })
  }

  return Response.json({ skipped: 'bukan kejadian yang dinotifikasi' })
})
