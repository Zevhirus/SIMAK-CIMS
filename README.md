# SIMAK - CIMS — Surveyor Indonesia Makassar

**Cleaning Inspection & Monitoring System** — sistem pelaporan, inspeksi, dan monitoring kebersihan gedung 3 lantai PT Surveyor Indonesia Makassar.

Aplikasi web untuk melaporkan masalah kebersihan, menugaskan petugas (OB) per lantai, memverifikasi hasil pekerjaan, inspeksi checklist harian, serta pelaporan kerusakan barang — lengkap dengan notifikasi WhatsApp otomatis.

---

## Daftar Isi

1. [Teknologi](#teknologi)
2. [Peran (Role) Pengguna](#peran-role-pengguna)
3. [Daftar Akun](#daftar-akun)
4. [Fitur per Role](#fitur-per-role)
5. [Alur Status Laporan](#alur-status-laporan)
6. [Setup Awal (Instalasi)](#setup-awal-instalasi)
7. [Migrasi Database (Urutan)](#migrasi-database-urutan)
8. [Notifikasi WhatsApp (Fonnte)](#notifikasi-whatsapp-fonnte)
9. [Menjalankan Aplikasi](#menjalankan-aplikasi)
10. [Deployment (Vercel)](#deployment-vercel)
11. [Struktur Proyek](#struktur-proyek)
12. [Struktur Database](#struktur-database)
13. [Maintenance & Operasional](#maintenance--operasional)
14. [Keamanan](#keamanan)
15. [Troubleshooting](#troubleshooting)

---

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router DOM 6 |
| Backend (BaaS) | Supabase — Auth, Postgres (RLS), Storage, Realtime, Edge Function |
| Notifikasi WA | Fonnte + Supabase Edge Function (`notify-ob`) |
| Hosting | Vercel (SPA rewrite ke `index.html`) |

---

## Peran (Role) Pengguna

| Role | Deskripsi |
|---|---|
| `umum` | **Pelapor** — karyawan yang melaporkan masalah kebersihan. Role default setiap pendaftaran baru. |
| `admin` | **Pengelola** — menyetujui & menugaskan laporan ke OB, verifikasi hasil (ACC / tinjau ulang), inspeksi checklist harian, rekap, dan menindaklanjuti kerusakan barang. |
| `ob` | **Petugas kebersihan (Office Boy)** — mengerjakan tugas yang ditugaskan kepadanya dan melaporkan kondisi pemeliharaan. |

> Role tidak bisa dipilih dari halaman daftar. Semua akun baru otomatis `umum`; perubahan role hanya bisa dilakukan lewat SQL/Dashboard Supabase (anti eskalasi hak akses).

---

## Daftar Akun

Seluruh akun bawaan sistem (domain `@lapor.test` hanya untuk internal, bukan email sungguhan):

| Role | Nama | Email | Password |
|---|---|---|---|
| **Admin** | Admin | `admin@lapor.test` | `Admin@12345` |
| **Umum** | Pelapor 1 | `umum1@lapor.test` | `Pelapor@12345` |
| **Umum** | Pelapor 2 | `umum2@lapor.test` | `Pelapor@12345` |
| **OB** | Qolby | `ob_qolby@lapor.test` | `Petugas@12345` |
| **OB** | Paris | `ob_paris@lapor.test` | `Petugas@12345` |
| **OB** | Teguh Anugrawan | `ob-teguh@lapor.test` | `Petugas@12345` |
| **OB** | Abd. Razak | `ob_razak@lapor.test` | `Petugas@12345` |
| **OB** | Nur Muh Ghozali | `ob-ghozali@lapor.test` | `Petugas@12345` |


| email                 | full_name       | role |
| --------------------- | --------------- | ---- |
| ob_razak@lapor.test   | Abd. Razak      | ob   |
| ob1@lapor.test        | Budi (OB)       | ob   |
| ob-ghozali@lapor.test | Nur Muh Ghozali | ob   |
| ob_paris@lapor.test   | Paris           | ob   |
| ob_qolby@lapor.test   | Qolby           | ob   |
| ob2@lapor.test        | Siti (OB)       | ob   |
| ob-teguh@lapor.test   | Teguh Anugrawan | ob   |
> Sejak revisi terakhir, akun OB **tidak lagi terikat ke lantai tertentu** (sistem rolling tiap 2 minggu). Penugasan laporan/tugas dilakukan langsung ke nama OB.

Daftar akun ini juga tersimpan di file `akun ` (perhatikan: nama file mengandung spasi di akhir).

> ⚠️ **Penting:** password di atas adalah kredensial bawaan untuk lingkungan internal/uji coba. Ganti semua password sebelum sistem dipakai produksi, dan **jangan commit kredensial produksi ke Git**.

### Cara membuat akun OB baru

Jalankan script (isi environment `VITE_SUPABASE_URL` & `VITE_SUPABASE_PUBLISHABLE_KEY` dulu):

```bash
set -a && . ./.env && set +a && node buat_akun.mjs
```

Lalu set role-nya lewat SQL:

```sql
update public.profiles set role = 'ob'
where full_name in ('Qolby','Paris','Teguh Anugrawan','Abd. Razak','Nur Muh Ghozali');
```

### Cara mengubah role akun lewat SQL

```sql
-- Jadikan admin
update public.profiles set role = 'admin'
where user_id = (select id from auth.users where email = 'email@contoh.com');

-- Jadikan OB
update public.profiles set role = 'ob'
where user_id = (select id from auth.users where email = 'email@contoh.com');
```

---

## Fitur per Role

### 👤 Umum (Pelapor) — `/umum`
- Membuat laporan kebersihan: lokasi, deskripsi, dan **foto sebelum** (wajib).
- Melihat status laporannya secara realtime (PENDING → … → VERIFIED).
- Melihat catatan admin bila laporan ditinjau ulang/ditolak.

### 🛠️ OB (Petugas) — `/ob`
- Melihat tugas yang ditugaskan **ke dirinya**.
- Mengerjakan tugas: upload **foto sesudah** + catatan pengerjaan → status `COMPLETED`.
- Mengerjakan ulang tugas yang ditinjau ulang oleh admin.
- **Lapor Pemeliharaan** (`/pemeliharaan`): Lantai, Area, Uraian, Kondisi, + foto opsional → dikirim ke admin.
- Melihat status laporannya (Baru/Diproses/Selesai/Ditolak).
- Menerima notifikasi **WhatsApp** saat ditugasi atau saat laporan ditinjau ulang.

### 🧑‍💼 Admin — `/admin`
- Menyetujui laporan & memilih petugas OB secara langsung → status `IN_PROGRESS` (OB langsung dapat WA).
- Verifikasi hasil kerja OB:
  - **ACC** → status `VERIFIED` (selesai).
  - **Tinjau ulang** → kembali ke `IN_PROGRESS` + catatan untuk OB (OB dapat WA berisi catatan).
- Menolak (`REJECTED`) atau menghapus laporan (tombol 🗑 di detail).
- **Inspeksi Kebersihan** (`/inspeksi`) — khusus admin:
  - Pilihan lantai 1/2/3, checklist dua kali sehari: slot **10:00** dan **17:00**, hari **Senin–Jumat (SN–JM)**.
  - Status item: `OK` (tuntas) / `X` (tidak tuntas + wajib foto).
  - Tombol **✓ Selesai** → semua item ✕ diubah jadi tugas dan ditugaskan ke OB (pilih nama OB per item); setelah Selesai hasil ceklist **terkunci**.
  - 🖨 Cetak formulir mingguan A4 (satu lantai atau semua lantai).
- **Rekap** (`/rekap`) — rekapitulasi nilai kebersihan per minggu dengan sistem poin sesuai `lilila.xlsm` (siap cetak).
- **Pemeliharaan** (`/pemeliharaan`) — meninjau laporan OB: **Tinjau** → `DIPROSES`, **Eksekusi** (wajib foto bukti) → `SELESAI`, bisa menghapus laporan.

---

## Alur Status Laporan

```
UMUM membuat laporan
        │
        ▼
   PENDING ──(admin tolak)──► REJECTED
        │
        │ admin setujui & tugaskan OB/lantai
        ▼
  IN_PROGRESS ◄──────────────┐
        │                    │ admin tinjau ulang
        │ OB kerjakan        │ (+ catatan, WA ke OB)
        │ (foto sesudah)     │
        ▼                    │
   COMPLETED ────────────────┘
        │
        │ admin ACC
        ▼
    VERIFIED (selesai)
```

**Pemeliharaan:** `BARU → DIPROSES → SELESAI` atau `DITOLAK`.

---

## Setup Awal (Instalasi)

### Prasyarat
- Node.js 18+
- Akun Supabase (supabase.com) — buat 1 project baru
- (Opsional) akun Fonnte untuk notifikasi WA

### Langkah

1. **Database** — Supabase Dashboard → **SQL Editor**, jalankan `supabase/schema.sql`, lalu semua file migrasi sesuai [urutan](#migrasi-database-urutan).

2. **Environment** — buat file `.env` di root proyek:
   ```env
   VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable-key>
   VITE_SHEET_URL=<url-webhook-apps-script>   # opsional, sync Google Sheets
   ```
   > Hanya gunakan **publishable/anon key**. SECRET key **tidak boleh** masuk frontend atau Git.

3. **Install & jalankan**:
   ```bash
   npm install
   npm run dev
   ```

4. **Buat akun** — jalankan `supabase/update_v13_akun_ob.sql` untuk 3 akun OB. Akun admin & umum bisa dibuat lewat halaman **Daftar**, lalu ubah role admin lewat SQL (lihat [Daftar Akun](#daftar-akun)).

5. **Opsional (uji coba cepat)** — Supabase Dashboard → Authentication → Providers → Email → matikan **Confirm email**.

---

## Migrasi Database (Urutan)

Jalankan berurutan di Supabase SQL Editor. Semua file berada di folder `supabase/`:

| # | File | Fungsi |
|---|---|---|
| 1 | `schema.sql` | Tabel `profiles` + `reports`, trigger, RLS, Storage bucket `report-photos`, Realtime |
| 2 | `update_v2.sql` | Status `VERIFIED`, kolom `admin_notes`, tabel `inspection_checks` |
| 3 | `update_v3_inspeksi_admin_only.sql` | Inspeksi dikunci hanya untuk admin |
| 4 | `update_v4_admin_delete.sql` | Admin dapat menghapus laporan |
| 5 | `update_v5_floor_assign.sql` | Penugasan per lantai (`profiles.floor`, `reports.assigned_floor`, RLS OB per lantai) |
| 6 | `update_v6_inspeksi_foto.sql` | Foto pada checklist inspeksi |
| 7 | `update_v7_kerusakan_barang.sql` | Tabel `asset_damage_reports` (laporan kerusakan OB → admin) |
| 8 | `update_v8_kerusakan_delete.sql` | Admin dapat menghapus laporan kerusakan |
| 9 | `whatsapp.sql` → `whatsapp_v2.sql` | Trigger webhook WA (ganti `<PROJECT_REF>` & `<WEBHOOK_SECRET>`) |
| 10 | `update_v13_revisi.sql` | OB tanpa lantai (rolling), kunci inspeksi + tugas ✕, kolom pemeliharaan |
| 11 | `update_v14_foto_bukti.sql` | Kolom foto bukti admin |
| 12 | `set_role_ob.sql` | Set role 5 akun OB |

File `update_v9`–`update_v12` adalah perbaikan bertahap untuk akun OB (duplikat, provider identity). Untuk instalasi baru disarankan mengikuti panduan [Cara membuat akun OB baru](#cara-membuat-akun-ob-baru).

---

## Notifikasi WhatsApp (Fonnte)

Saat admin menugaskan laporan, OB otomatis menerima WA. Saat laporan ditinjau ulang, OB menerima WA berisi catatan admin. (V2: admin juga ikut menerima notifikasi.)

1. Daftar di [fonnte.com](https://fonnte.com), hubungkan nomor WA pengirim (scan QR), salin **token**.
2. Jalankan `supabase/whatsapp_v2.sql` di SQL Editor — ganti `<PROJECT_REF>` dan `<WEBHOOK_SECRET>` dengan nilai milik Anda.
3. Isi kolom `phone` pada tabel `profiles` untuk setiap OB (dan admin), format nomor: `08xxxxxxxxxx`.
4. Deploy Edge Function:
   ```bash
   supabase secrets set FONNTE_TOKEN=xxx WEBHOOK_SECRET=xxx APP_URL=https://domain-anda.com
   supabase functions deploy notify-ob --no-verify-jwt
   ```
5. Setiap mengubah SQL WhatsApp, **deploy ulang** fungsi `notify-ob`.

---

## Menjalankan Aplikasi

```bash
npm run dev       # mode development (Vite dev server)
npm run build     # build produksi ke folder dist/
npm run preview   # preview hasil build lokal
```

---

## Deployment (Vercel)

1. Push proyek ke GitHub/GitLab, import ke Vercel (framework: **Vite**).
2. Isi Environment Variables: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. File `vercel.json` sudah berisi rewrite SPA (`/(.*) → /index.html`) agar refresh halaman tidak 404.
4. Setelah domain aktif, perbarui `APP_URL` di secrets Supabase agar link WA mengarah ke domain produksi:
   ```bash
   supabase secrets set APP_URL=https://domain-anda.com
   ```

---

## Struktur Proyek

```
SIMAK-CIMS/
├── index.html
├── package.json
├── vite.config.js / tailwind.config.js / postcss.config.js
├── vercel.json                 # rewrite SPA untuk Vercel
├── .env                        # VITE_SUPABASE_URL + publishable key (JANGAN commit key rahasia)
├── buat_akun.mjs               # script pembuatan akun OB
├── akun                        # daftar akun bawaan (nama file mengandung spasi)
├── public/                     # logo & favicon
├── src/
│   ├── main.jsx / App.jsx      # routing + route guard per role
│   ├── index.css
│   ├── context/AuthContext.jsx # session, login/daftar, profil & role
│   ├── lib/
│   │   ├── supabase.js         # client Supabase
│   │   └── api.js              # helper akses data
│   ├── components/
│   │   ├── ui.jsx              # komponen UI (Shell, Spinner, Logo, dll.)
│   │   └── InspeksiPrint.jsx   # cetak formulir inspeksi mingguan A4
│   └── pages/
│       ├── Login.jsx           # login & daftar
│       ├── UmumDashboard.jsx   # dashboard pelapor
│       ├── ObDashboard.jsx     # tugas OB
│       ├── AdminDashboard.jsx  # dashboard admin (approval & penugasan per OB)
│       ├── Inspeksi.jsx        # checklist inspeksi harian (admin only)
│       ├── Rekap.jsx           # rekap poin siap cetak (admin only)
│       └── KerusakanBarang.jsx # menu pemeliharaan (OB & admin)
└── supabase/
    ├── schema.sql              # skema awal + RLS + storage
    ├── update_v2 … v13.sql     # migrasi bertahap
    ├── whatsapp.sql / whatsapp_v2.sql  # trigger webhook WA
    └── functions/notify-ob/    # Edge Function pengirim WA (Fonnte)
```

### Routing & hak akses

| Path | Role |
|---|---|
| `/login` | publik |
| `/umum` | `umum` |
| `/ob` | `ob` |
| `/admin`, `/inspeksi`, `/rekap` | `admin` |
| `/pemeliharaan` | `admin` + `ob` |

(Catatan: menu & rute `/kerusakan` sudah diganti nama menjadi **Pemeliharaan** `/pemeliharaan`.)

---

## Struktur Database

| Tabel | Isi |
|---|---|
| `profiles` | Profil user: `full_name`, `role` (`umum`/`admin`/`ob`), `phone` (untuk WA) |
| `reports` | Laporan kebersihan: lokasi, deskripsi, `photo_before_url`, `photo_after_url`, `status`, `assigned_ob_id`, `ob_notes`, `admin_notes` |
| `inspection_checks` | Checklist inspeksi: `floor`, `check_date`, `slot` (`10:00`/`17:00`), `item`, `status` (`OK`/`X`), `note`, `photo_url` |
| `inspection_locks` | Kunci hasil inspeksi per lantai & minggu |
| `asset_damage_reports` | Pemeliharaan: `lantai`, `area`, `uraian`, `kondisi` (`Bersih`/`Kotor`/`Rusak`/`Baik`), `photo_url` (foto OB), `photo_bukti_url` (foto bukti admin), `status` (`BARU`/`DIPROSES`/`SELESAI`/`DITOLAK`), `admin_notes` |

**Storage:** bucket publik `report-photos` — setiap user hanya bisa upload ke folder miliknya (`<uid>/<file>`), semua orang bisa membaca.

**Realtime:** tabel `reports` dipublikasikan ke `supabase_realtime` (notifikasi laporan baru untuk admin).

---

## Maintenance & Operasional

### Pekerjaan rutin admin
- **Setiap hari (Senin–Jumat):** isi checklist inspeksi slot 10:00 & 17:00 untuk tiap lantai di menu **Inspeksi**.
- **Mingguan:** cetak formulir inspeksi (tombol 🖨 Cetak) untuk arsip/paraf.
- Tinjau laporan `COMPLETED` → ACC atau tinjau ulang.
- Tindaklanjuti laporan kerusakan barang di menu **Kerusakan**.

### Tugas database berkala

```sql
-- Cek akun OB
select p.full_name, u.email, p.role, p.phone
from public.profiles p join auth.users u on u.id = p.user_id
where p.role = 'ob' order by p.full_name;

-- Cek laporan yang menggantung (belum selesai)
select id, location, status, assigned_ob_id, created_at
from public.reports
where status in ('PENDING','IN_PROGRESS','COMPLETED')
order by created_at;

-- Reset password user (Supabase Dashboard → Authentication → Users → pilih user → Send password recovery)
-- atau lewat SQL (ganti email & password):
update auth.users
set encrypted_password = crypt('PasswordBaru@123', gen_salt('bf'))
where email = 'ob_qolby@lapor.test';
```

### Menambah akun OB baru (contoh lantai 1)

```sql
-- 1. Buat user lewat node buat_akun.mjs, lalu set role (tanpa lantai lagi):
update public.profiles set role = 'ob', phone = '08xxxxxxxxxx'
where user_id = (select id from auth.users where email = 'ob_baru@lapor.test');
```

### Menonaktifkan akun
Supabase Dashboard → **Authentication → Users** → pilih user → **Ban user**.

---

## Keamanan

- Frontend **hanya** memakai publishable/anon key. **SECRET KEY tidak boleh** masuk frontend atau Git.
- Hak akses ditegakkan oleh **Row Level Security (RLS)** di database, bukan oleh tampilan UI.
- Role selalu `umum` saat pendaftaran; tidak ada policy UPDATE role dari client (anti eskalasi).
- OB hanya bisa melihat & mengerjakan tugas lantainya; hanya bisa mengubah status `IN_PROGRESS → COMPLETED`.
- Upload foto dibatasi ke folder milik sendiri di Storage.
- Fungsi helper role memakai `security definer` agar tidak terjadi rekursi RLS.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Login OB gagal / "Invalid login" | Pastikan akun dibuat dengan benar (buat akun → role `ob`); cek query di bagian Maintenance. |
| OB tidak melihat tugas | Pastikan `reports.assigned_ob_id` berisi user_id OB tersebut — cek query di bagian Maintenance. |
| WA tidak terkirim | Cek `FONNTE_TOKEN`, `WEBHOOK_SECRET`, kolom `phone` OB sudah terisi, lalu deploy ulang `notify-ob`. Cek log di Supabase → Edge Functions. |
| Upload foto gagal | Pastikan bucket `report-photos` ada dan policy storage dari `schema.sql` sudah dibuat. |
| Refresh halaman di Vercel jadi 404 | Pastikan `vercel.json` ikut ter-deploy (rewrite SPA). |
| User daftar tapi tidak bisa login | Cek apakah "Confirm email" masih aktif; matikan untuk uji coba atau konfirmasi email user. |

---

*Dokumentasi ini mencakup seluruh sistem SIMAK - CIMS: instalasi, akun, fitur, migrasi database, WhatsApp, deployment, dan maintenance.*
# SIMAK-CIMS
# SIMAK-CIMS
