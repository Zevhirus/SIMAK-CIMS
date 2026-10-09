import { supabase } from './supabase'

const BUCKET = 'report-photos'

// Sinkron ke Google Sheets (opsional) — priksa VITE_SHEET_URL di .env
const SHEET_URL = import.meta.env.VITE_SHEET_URL
export async function syncToSheet(row) {
  if (!SHEET_URL) return
  try {
    await fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(row),
    })
  } catch { /* gagal sync tidak menggagalkan penyimpanan ke Supabase */ }
}

export const STATUS = {
  PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  APPROVED: { label: 'Disetujui Admin', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  IN_PROGRESS: { label: 'Dikerjakan OB', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  COMPLETED: { label: 'Menunggu pengecekan', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  VERIFIED: { label: 'Selesai (ACC)', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED: { label: 'Ditolak', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
}

// Upload foto ke Storage -> kembalikan URL publik
export async function uploadPhoto(file, userId, prefix) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${prefix}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// ALUR 1 — UMUM: kirim laporan (status PENDING)
export async function submitReport({ userId, location, description, file }) {
  const photo_before_url = await uploadPhoto(file, userId, 'before')
  const { error } = await supabase.from('reports').insert({
    user_id: userId, location, description, photo_before_url, status: 'PENDING',
  })
  if (error) throw error
}

// ALUR 2 — ADMIN
export async function fetchAllReports() {
  const { data, error } = await supabase.from('reports').select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Daftar akun OB (untuk pilihan penugasan admin)
export async function fetchObUsers() {
  const { data, error } = await supabase.from('profiles').select('user_id, full_name')
    .eq('role', 'ob').order('full_name')
  if (error) throw error
  return data
}

// Approve + tugaskan ke satu OB -> IN_PROGRESS
export async function approveAndAssign(reportId, obUserId) {
  const { error } = await supabase.from('reports')
    .update({ status: 'IN_PROGRESS', assigned_ob_id: obUserId }).eq('id', reportId)
  if (error) throw error
}

export async function rejectReport(reportId) {
  const { error } = await supabase.from('reports').update({ status: 'REJECTED' }).eq('id', reportId)
  if (error) throw error
}

// Hapus laporan (admin) + file fotonya di Storage
const photoPath = (url) => {
  const i = url ? url.indexOf(`/${BUCKET}/`) : -1
  return i === -1 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])
}
export async function deleteReport(report) {
  const { data, error } = await supabase.from('reports').delete().eq('id', report.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Laporan tidak terhapus. Jalankan supabase/update_v4_admin_delete.sql dulu.')
  const paths = [report.photo_before_url, report.photo_after_url].map(photoPath).filter(Boolean)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths) // gagal hapus foto tidak menggagalkan hapus laporan
}

// Pengecekan ulang setelah OB selesai
// ACC -> laporan final (VERIFIED)
export async function accReport(reportId) {
  const { error } = await supabase.from('reports')
    .update({ status: 'VERIFIED' }).eq('id', reportId)
  if (error) throw error
}

// Tinjau ulang -> kembali ke OB yang sama (IN_PROGRESS) dengan catatan perbaikan
export async function requestRework(reportId, adminNotes) {
  const { error } = await supabase.from('reports')
    .update({ status: 'IN_PROGRESS', admin_notes: adminNotes }).eq('id', reportId)
  if (error) throw error
}

// ALUR 3 — OB
export async function fetchObTasks(obUserId) {
  const { data, error } = await supabase.from('reports').select('*')
    .eq('assigned_ob_id', obUserId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function completeTask({ reportId, userId, file, notes }) {
  const photo_after_url = await uploadPhoto(file, userId, 'after')
  const { error } = await supabase.from('reports')
    .update({ status: 'COMPLETED', photo_after_url, ob_notes: notes, assigned_ob_id: userId })
    .eq('id', reportId)// mencatat siapa yang mengerjakan.eq('id', reportId)
  if (error) throw error
}

// Realtime: panggil callback tiap ada perubahan di tabel reports
export function subscribeReports(onChange) {
  const ch = supabase.channel('reports-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(ch)
}

export async function deleteDamageReport(report) {
  const { data, error } = await supabase.from('asset_damage_reports').delete().eq('id', report.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Laporan tidak terhapus. Jalankan supabase/update_v8_kerusakan_delete.sql dulu.')
  const paths = [report.photo_url, report.photo_bukti_url].map((u) => {
    const i = u ? u.indexOf('/report-photos/') : -1
    return i === -1 ? null : decodeURIComponent(u.slice(i + '/report-photos/'.length).split('?')[0])
  }).filter(Boolean)
  if (paths.length) await supabase.storage.from('report-photos').remove(paths)
  await syncToSheet({ id: report.id, hapus: true })
}

// =====================================================
// PELAPORAN KERUSAKAN BARANG (OB melapor, admin menerima)
// =====================================================
export const DAMAGE_STATUS = {
  BARU: { label: 'Baru', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  DIPROSES: { label: 'Diproses', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  SELESAI: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  DITOLAK: { label: 'Ditolak', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
}

export async function submitDamageReport({ userId, reporterName, lantai, area, uraian, kondisi, photoUrl }) {
  const { data, error } = await supabase.from('asset_damage_reports').insert({
    user_id: userId, reporter_name: reporterName || null, lantai, area, uraian, kondisi, photo_url: photoUrl || null, status: 'BARU',
  }).select('id, created_at').single()
  if (error) throw error
  await syncToSheet({
    id: data.id, tanggal: data.created_at, lantai, area, uraian, kondisi,
    pelapor: reporterName || '', status: 'BARU', foto: photoUrl || '',
  })
}

export async function fetchMyDamageReports(userId) {
  const { data, error } = await supabase.from('asset_damage_reports').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchAllDamageReports() {
  const { data, error } = await supabase.from('asset_damage_reports').select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function setDamageStatus(id, status, adminNotes, photoBuktiUrl) {
  const patch = { status, admin_notes: adminNotes || null }
  if (photoBuktiUrl) patch.photo_bukti_url = photoBuktiUrl
  const { error } = await supabase.from('asset_damage_reports').update(patch).eq('id', id)
  if (error) throw error
  await syncToSheet({ id, status, catatan: adminNotes || '', foto_bukti: photoBuktiUrl || '' })
}

// Daftar dropdown "Uraian" — ganti dengan data dari spreadsheet yang akan diberikan
export const URAIAN_OPSI = [
  'AC', 'Plafon', 'Sensor Fire Alarm', 'Speaker', 'Spandek', 'Jendela', 'Roller Blind', 'Dinding', 'Kaca', 'Bingkai Decoratif', 'Remote AC', 'Pengharum', 'Stop Kontak/Saklar', 'Kursi', 'Meja', 'Laci', 'Elektronik', 'Mesin Air', 'Sofa', 'Runner', 'Lampu Hias', 'Sound System', 'Papan Tulis', 'Rak Buku', 'Aksesoris', 'Meja Pantry', 'Alat Makan', 'Sink', 'Kompor', 'Kitchen Set', 'Storage', 'Locker', 'Lemari Arsip', 'Rak', 'Treadmill', 'Timbangan BB', 'Gym Ball', 'Kloset', 'Mesin Kopi', 'Lantai', 'Karpet', 'Pagar Depan', 'Pagar Kolam', 'Pintu', 'Rumput Sintetis', 'Wastafel', 'Railing', 'Tanaman',
]
export const KONDISI_OPSI = ['Bersih', 'Kotor', 'Rusak', 'Baik']

// Kunci hasil inspeksi per lantai + minggu + jam kontrol (10:00 dan 17:00 dikunci terpisah)
// Mengembalikan daftar jam yang sudah dikunci, mis. ['10:00']
export async function fetchInspectionLocks(floor, weekStartYmd) {
  const { data, error } = await supabase.from('inspection_locks').select('slot')
    .eq('floor', floor).eq('week_start', weekStartYmd)
  if (error) throw error
  return data.map((r) => r.slot)
}
export async function lockInspection(floor, weekStartYmd, slot) {
  const { error } = await supabase.from('inspection_locks')
    .insert({ floor, week_start: weekStartYmd, slot })
  if (error) throw error
}

// Buat tugas OB dari hasil inspeksi (satu tugas per sel ✕)
export async function createInspectionTasks(rows) {
  const { error } = await supabase.from('reports').insert(rows)
  if (error) throw error
}

// =====================================================
// INSPEKSI KEBERSIHAN (checklist per lantai)
// =====================================================
export const SLOTS = ['10:00', '17:00']
export const DAYS = [['SN', 'Senin'], ['SL', 'Selasa'], ['RB', 'Rabu'], ['KM', 'Kamis'], ['JM', 'Jumat']]

// Daftar area per lantai — disalin dari formulir checklist kertas
export const FLOORS = {
  1: {
    items: ['Jendela Kaca', 'Semua Pintu', 'Plafon', 'Lobby', 'Lantai', 'Wastafel Depan', 'Toilet Depan', 'Perpustakaan', 'Ruang Meeting', 'Gudang', 'Pantry', 'Sink', 'Wastafel Belakang', 'Toilet Belakang', 'Janitor', 'Bawah Tangga', 'Area Loker'],
    petugas: [{ name: 'Qolby', role: 'Office Boy' }],
  },
  2: {
    items: ['Halaman Depan', 'Area Parkir Mobil', 'Tangga Depan', 'Plafon', 'Lantai', 'Jendela Kaca', 'Semua Pintu', 'Ruang GM', 'Ruang SM 1', 'Ruang SM 2', 'Ruang Manager', 'Ruang Meeting', 'Ruang Tender', 'Area Kerja Karyawan', 'Ruang Arsip', 'Sink', 'Wastafel', 'Toilet', 'Balkon', 'Tanaman'],
    petugas: [{ name: 'Paris', role: 'Office Boy' }, { name: 'Teguh Anugrawan', role: 'Office Boy' }],
  },
  3: {
    items: ['Area Parkir Motor', 'Area Kolam', 'Jendela Kaca', 'Plafon', 'Toilet Depan', 'Ruang Kasir', 'Ruang Manager BS', 'Area Kerja Karyawan', 'Ruang Meeting', 'Ruang GYM', 'Balkon', 'Tanaman', 'Gudang Lt3', 'Mushola', 'Area Wudhu', 'Sink', 'Wastafel', 'Toilet Belakang Lt3', 'Area Rooftop', 'Tangga Belakang'],
    petugas: [{ name: 'Abd. Razak', role: 'Office Boy' }, { name: 'Nur Muh Ghozali', role: 'Office Boy' }],
  },
}
export const VERIFIER = { name: 'Rezky Tri Utami', role: 'Koor. Pengadaan Umum & Aset' }
export const KNOWER = { name: 'Hermawati', role: 'SH Business Support' }

// Tanggal lokal -> 'YYYY-MM-DD' (jangan pakai toISOString: bergeser zona waktu)
export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Senin dari minggu yang memuat tanggal d
export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export async function fetchInspection(floor, fromYmd, toYmd) {
  const { data, error } = await supabase.from('inspection_checks').select('*')
    .eq('floor', floor).gte('check_date', fromYmd).lte('check_date', toYmd)
  if (error) throw error
  return data
}

// status: 'OK' | 'X' | null (kosong). Upsert satu sel checklist.
export async function saveInspection({ floor, date, slot, item, status, note, photoUrl, userId }) {
  const { error } = await supabase.from('inspection_checks').upsert(
    { floor, check_date: date, slot, item, status, note: note || null, photo_url: photoUrl || null, checked_by: userId },
    { onConflict: 'floor,check_date,slot,item' },
  )
  if (error) throw error
}

// Simpan banyak sel sekaligus (mis. "tandai semua tuntas")
export async function saveInspectionBulk(rows) {
  const { error } = await supabase.from('inspection_checks')
    .upsert(rows, { onConflict: 'floor,check_date,slot,item' })
  if (error) throw error
}
