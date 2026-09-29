# Dokumentasi API DMX Sales

Referensi mesin: `backend/docs/openapi.json`. Dokumen ini penjelasan manusianya, dicicil per bagian.

Status: Bagian 0–8 selesai (S1–S5). Referensi mesin: `backend/docs/openapi.json`.

## 0. Konvensi umum

| Hal | Aturan |
|---|---|
| Base URL lokal | `http://127.0.0.1:8081/api/v1` (produksi wajib HTTPS) |
| Auth | `Authorization: Bearer <accessToken>` Sanctum; tanpa cookie |
| Format body | JSON (`Content-Type: application/json`), key `camelCase` |
| Timestamp | ISO 8601 UTC; zona bisnis laporan `Asia/Jakarta` |
| Pagination | Query `page`, `pageSize` (default 25, maks 100); respons `data/page/pageSize/totalItems/totalPages` |
| Error | Selalu Bahasa Indonesia: `{code, message, traceId, fieldErrors}` + header `X-Trace-Id` |
| Idempotency | `POST /users` dan `POST /prospects` menerima header `Idempotency-Key` (1–64 karakter). Kunci sama + payload sama = replay (200 + header `Idempotent-Replayed: true`); kunci sama + payload beda = 409 `IDEMPOTENCY_CONFLICT` |
| Concurrency | Update memakai `version`; versi basi = 409 `VERSION_CONFLICT` |
| Scope data | SALES hanya data miliknya (di luar scope = 404, seolah tidak ada); ADMIN/BILLING semua data. Aksi tanpa izin = 403 `FORBIDDEN` |

Kode error utama: `INVALID_CREDENTIALS` (401), `SESSION_EXPIRED` (401),
`VALIDATION_ERROR` (422, detail per field di `fieldErrors`), `NOT_FOUND` (404),
`DUPLICATE_DATA` (409), `VERSION_CONFLICT` (409), `RATE_LIMITED` (429),
`INTERNAL_ERROR` (500).

## 1. Auth

### POST /auth/login
Login dengan username atau email. Rate limit: 5x/menit per identitas+IP, 30x/menit per IP.

```json
// request
{"login": "uat.sales1", "password": "Uat-Pass-123456", "deviceName": "UAT"}

// response 200
{"data": {"accessToken": "1|...", "tokenType": "Bearer", "expiresAt": "2026-09-10T00:17:36Z",
  "user": {"id": "...", "name": "uat.sales1", "role": "SALES", "access": "OWN", "permissions": [...]}}}
```

Kredensial salah / akun nonaktif = 401 `INVALID_CREDENTIALS` (sengaja generik agar tidak bisa menebak user).

### GET /auth/me
Profil pemilik token. Token kedaluwarsa/dicabut/user dinonaktifkan = 401.

### POST /auth/logout
Mencabut token saat ini. Respons: `{"message": "Anda berhasil keluar."}`

### POST /auth/revoke-all
Mencabut seluruh sesi milik sendiri. Admin mencabut sesi user lain via `POST /users/{id}/revoke-all`.

## 2. User & Role (ADMIN/BILLING)

Role tepat tiga: `ADMIN` (ALL + kelola target), `BILLING` (ALL kecuali kelola target),
`SALES` (OWN). CEO memakai `ADMIN`.

| Endpoint | Fungsi |
|---|---|
| `GET /users` | Daftar user (paginasi + cari `?q=` nama/username/email) |
| `POST /users` | Buat user: `name`, `username` (huruf kecil/angka/titik/`_`/`-`), `email`, `password` (min 12), `role` |
| `GET /users/{id}` | Detail (SALES hanya dirinya sendiri) |
| `PUT /users/{id}` | Ubah (`version` wajib; `isActive:false` menonaktifkan + mencabut token; ganti role/password ikut mencabut token) |
| `POST /users/{id}/revoke-all` | Cabut semua sesi user |
| `GET /roles` | Daftar role + permission-nya |
| `GET /audit-logs` | Audit append-only (filter `?action=`, paginasi); tanpa password/token |

Aturan proteksi: admin aktif terakhir tidak boleh dinonaktifkan/diturunkan role-nya
(409 `LAST_ADMIN_REQUIRED`).

## 3. Master Data

Terbaca semua role login; tulis khusus ADMIN/BILLING.

| Endpoint | Isi |
|---|---|
| `GET /prospect-sources` | 6 sumber Excel: Banner, Database Est., Google Ads, Lokasi Maps, Meta Ads, Rekomendasi |
| `GET /industries` | 13 industri (daftar final pemilik produk) + tambahan via API |
| `GET /lost-reasons` | 9 alasan lost (daftar final pemilik produk) + tambahan via API |
| `POST /{kelompok}` | Tambah item: `code` (kapital/angka/underscore, 2–40 char), `label`. Duplikat = 409 |
| `PUT /{kelompok}/{code}` | Ubah `label` / `isActive`. Menonaktifkan membuat kode ditolak di entry baru, tapi data lama tetap terbaca |

Respons item: `{"code": "...", "label": "...", "active": true}`.

## 4. Prospect (S2)

Entry baru wajib: `accountName`, `phone` (valid, dinormalisasi ke +62),
`sourceCode`, `priority` (HOT/WARM/COLD), `customerType` (B2B/B2C).
`ownerUserId` selalu = user login (mengirimnya = 422). `entryDate` default
hari ini (server). `stage` default NEW. `industryCode` opsional.
`customerType` tidak bisa diubah setelah create (422 `CUSTOMER_TYPE_IMMUTABLE`);
data legacy null hanya via import S4.

| Endpoint | Fungsi |
|---|---|
| `GET /prospects` | Cari + filter + sort + paginasi (di bawah) |
| `POST /prospects` | Buat (201; replay idempoten = 200) |
| `GET /prospects/{id}` | Detail + `contacts` |
| `PUT /prospects/{id}` | Ubah (`version` wajib; `stage` dilarang — lewat endpoint stage) |
| `DELETE /prospects/{id}` | Soft delete (setelah itu 404 di mana-mana, data retained) |
| `POST /prospects/{id}/assign` | Pindah owner, ADMIN/BILLING saja (`ownerUserId` harus user aktif; 422 `OWNER_NOT_FOUND`) |
| `POST /prospects/{id}/stage` | Pindah stage (`stage` + `version`; aturan matriks di Bagian 6) |
| `POST /prospects/{id}/archive` | Arsip/buka arsip (`{"archived": true/false}`) |
| `GET /prospects/duplicates` | Kandidat duplikat (di bawah) |
| `POST /prospects/{id}/contacts` | Tambah kontak (`name` wajib; phone/email opsional) |
| `DELETE /prospects/{id}/contacts/{contactId}` | Hapus kontak |

List: `q` (cari account/PIC/phone/email/legacy ID), filter `owner` (ADMIN/BILLING saja),
`stage`, `priority`, `city`, `sourceCode`, `dateFrom`/`dateTo` (tanggal masuk),
`sort` (`entryDate|accountName|potentialValue|updatedAt|nextFollowUpAt` + `:asc`,
default `entryDate:desc`), `includeArchived`.

Duplikat (`phone`/`phoneNormalized`/`email`/`accountName`+`city`/`legacyId`):
respons `[{prospectId, reason: EXTERNAL_ID|PHONE|EMAIL|NAME_CITY, matchedValue}]`.
Tanpa auto-merge. SALES hanya melihat kandidat miliknya sendiri.

## 5. Aktivitas, Follow-up & Pipeline (S3)

### Aktivitas
`POST /prospects/{id}/activities`: `type` wajib (CALL/WHATSAPP/EMAIL/MEETING/VISIT/NOTE).
Call: `answered`, `durationMinutes` (≥ 0). Visit: `attendance` (HADIR/TIDAK_HADIR/TERJADWAL),
`completion` (SELESAI/BATAL/TERJADWAL). Opsional: `activityAt`, `notes`,
`lastProgress` + `nextAction` + `nextFollowUpAt` (ikut memperbarui ringkasan prospect;
`nextFollowUpAt` sekaligus membuat tugas follow-up untuk owner).
Satu transaksi: gagal di mana pun = batal semua. `GET /prospects/{id}/activities`
timeline terbaru dulu (filter `?type=`).

### Follow-up
`POST /prospects/{id}/follow-ups`: `scheduledAt` + `description` wajib,
`priority` (default SEDANG), `assigneeUserId` (default owner; harus user aktif).
`GET /follow-ups`: `mode=today|overdue|upcoming|all` (default upcoming, batas hari
zona Asia/Jakarta), filter `status`, `priority`, `prospectId`, `assignee` (ADMIN/BILLING).
Tiap baris menyertakan `prospectName` (nama account prospek) untuk tampilan daftar.
`POST /follow-ups/{id}/complete` (ganda = 409 `ALREADY_COMPLETED`).
`POST /follow-ups/{id}/reschedule` (`scheduledAt` + `version`; selesai tidak bisa dijadwal ulang).

### Pipeline
`GET /pipeline` (`?owner=` ADMIN/BILLING): `[{stage, count}]`.
`GET /prospects/{id}/stage-history`: tiap entri `{fromStage, toStage, actorUserId, createdAt, durationSeconds}`.
Aturan pindah (ditolak = 422 `ILLEGAL_TRANSITION`): maju saja
NEW→FOLLOW_UP→OPPORTUNITY→QUOTATION→NEGOTIATION→CLOSING; WON/LOST hanya via aksi
deal; MAINTENANCE hanya dari WON; reopen WON/LOST→FOLLOW_UP khusus ADMIN/BILLING.

## 6. Deal, Customer & Payment (S3)

### Deal
Satu deal OPEN per prospect (duplikat = 409 `DEAL_EXISTS`).
`POST /prospects/{id}/deals` (`quotationNumber`, `potentialValue`, `quotationValue`;
`dealNumber` format `DL-XXXXXXXX` dibuat server). `GET /prospects/{id}/deals` daftar deal.
`PUT /deals/{id}` (`version` wajib; deal WON/LOST tidak bisa diubah → repeat order).

Won — `POST /deals/{id}/won` (`closingDate` + `closingValue` wajib):
tanpa pilihan customer padahal kandidat ada = 409 `CUSTOMER_CHOICE_REQUIRED`
(lihat dulu `GET /deals/{id}/customer-candidates`); pilih via `customerId` existing
atau `customerMode: new`. Retry payload sama = replay aman tanpa ganda.
Berhasil: prospect → WON + event `sales.deal.won` (+ `sales.customer.created` bila baru).

Lost — `POST /deals/{id}/lost` (`lostReasonCode` wajib dari master): prospect → LOST.

### Customer
`GET /customers` (`?q=`; SALES hanya customer yang terhubung ke prospect miliknya),
`GET /customers/{id}`, `GET /customers/{id}/deals`.
Tulis khusus ADMIN/BILLING: `POST /customers`, `PUT /customers/{id}` (`version`,
`isActive` untuk nonaktif).
Repeat order — `POST /customers/{id}/deals` (`prospectId`): deal OPEN baru ke
customer yang SAMA (SALES boleh untuk prospect miliknya); angka deal lama utuh.

### Payment
`POST /deals/{id}/payment-status` khusus Billing/Admin
(BELUM_DITAGIH→INVOICE→TERTAGIH→LUNAS, plus OVERDUE; SALES = 403).
Tiap perubahan: histori (`GET /deals/{id}/payment-history`), sinkron ke prospect,
event `sales.payment_status.changed`.

## 7. Import CSV (S4)

Khusus ADMIN/BILLING (SALES = 403). Skema CSV v1 = 24 kolom kanonis PRD
plus `Status` (legacy), `closing_date`, `lost_reason`. Header case-insensitive;
alias Indonesia didukung (`Nama Account / Customer`, `No. WhatsApp / Handphone`,
`Sumber Prospek`, `Owner / PIC Internal`, ...). Limit 20 MB / 100.000 baris,
commit per batch 250.

| Endpoint | Fungsi |
|---|---|
| `POST /imports` | Upload CSV ke staging (`fileName`, `content`); 201 + flag `counters.duplicateFile` bila checksum pernah diimpor |
| `POST /imports/{id}/batches` | Tambah batch ke job DRAFT (row number berlanjut) |
| `POST /imports/{id}/validate` | Antrekan validasi (202); upload/validate tidak menulis tabel bisnis |
| `GET /imports/{id}` | Job + `reconciliation` (`inserted/updated/skipped/failed/pending/balanced`) |
| `GET /imports/{id}/rows?status=` | Baris staging + kode per baris |
| `GET /imports/{id}/errors.csv` | CSV baris gagal (`row_number,status,codes,result`) |
| `POST /imports/{id}/review` | Keputusan per baris + `version`; INVALID hanya boleh SKIP |
| `POST /imports/{id}/commit` | Commit per batch (202, dapat resume; ulang aman) |
| `POST /imports/{id}/cancel` | Batalkan DRAFT/VALIDATING/READY; batch committed tidak dihapus |

Aturan legacy: `Hot/Warm/Cold` di `Status` menjadi priority + stage default
`FOLLOW_UP` (warning `LEGACY_STAGE_INFERRED`); `Closing/Cancel` legacy tidak
di-auto-map (ikut review); tahun `2206`/di luar `2000..tahun+1` ditolak
(`INVALID_DATE_RANGE`) tanpa koreksi otomatis; owner wajib user aktif yang
sudah ada (`OWNER_NOT_FOUND`, tanpa auto-create); serial tanggal Excel dan
`Rp 15.000.000` diparse; WON tanpa `closing_date/value` dan LOST tanpa
`lost_reason` ditolak; WON commit membuat deal + customer (tanpa kandidat =
otomatis; bila customer cocok sudah ada, baris masuk DUPLICATE
`CUSTOMER_CHOICE_REQUIRED` — setujui CREATE_NEW untuk customer baru, atau
hubungkan manual di aplikasi); LOST membuat deal + lost reason; phone legacy kosong = warning (CREATE_NEW tanpa phone valid
gagal saat commit — hanya UPDATE/MERGE yang lolos); duplikat dicek
`external_id` → phone → email → nama+kota (default aman SKIP; `CREATE_NEW` di
atas `external_id` ganda ditolak unique). Selesai =
`inserted + updated + skipped + failed = total baris yang diputuskan`
(`balanced: true`). Baris VALID ikut commit otomatis saat tombol Commit ditekan;
WARNING/DUPLICATE butuh keputusan eksplisit (default SKIP); INVALID hanya SKIP.
Baris INVALID tidak bisa diperbaiki inline — betulkan di CSV sumber lalu upload
ulang (file ganda terdeteksi via checksum, baris ganda via `external_id`).

## 8. Target, Dashboard, Laporan & Export (S5)

### Target
Kelola = ADMIN saja (`POST /targets`, `PUT /targets/{id}` + `version`;
duplikat user+periode = 409 `TARGET_EXISTS`; periode `YYYY-MM`/`YYYY`).
Baca: ADMIN/BILLING semua, SALES miliknya (`GET /targets`).
Target nol valid (achievement-nya null, bukan 0%).

### Dashboard & laporan
`GET /dashboard` (`?owner=` ADMIN/BILLING; filter stage/sourceCode/
customerType/priority/dateFrom/dateTo): prospect aktif, per-stage,
per-priority, FU today/overdue (zona Asia/Jakarta), sum potential/quotation/closing.
`GET /reports/performance?periodType=MONTH|YEAR&period=` (`groupBy=sales|self`):
target, actual (`closing_date` WON di periode), achievement, closing rate,
aktivitas, overdue — per sales atau diri sendiri (SALES selalu diri sendiri
walau kirim `owner` orang lain).
`GET /reports/annual?year=` (agregat + perSales).
Semantik terkunci: **closing rate = kohort-entry** (denominator prospect masuk
periode, numerator yang akhirnya WON — distinct prospect, repeat deal tidak
ganda, denominator nol = null); actual/achievement ikut `closing_date` **dan
owner saat closing** (snapshot `closingOwnerId` saat Won; kohort + pipeline
ikut owner saat ini).

### Export
`POST /exports/prospects` (filter list prospect) dan
`POST /exports/performance` (`periodType`+`period` wajib) → 202 + job async;
`GET /exports/{id}` status; `GET /exports/{id}/download` file CSV
(kedaluwarsa 24 jam → 410 `DOWNLOAD_EXPIRED`; izin dicek ulang — job orang
lain 403, user dinonaktifkan 401). Kolom allowlist; sel diawali `=+-@`
(termasuk berprefix spasi/kontrol) dinetralkan; DB tetap asli.

## 9. Arsip Cold (S6-dev, S7)

Khusus ADMIN/BILLING. Kandidat = prospect WON/LOST yang belum dihapus
(prospect aktif NEW..CLOSING tidak pernah masuk).

| Endpoint | Fungsi |
|---|---|
| `POST /archives/preview` | Hitung kandidat + rentang tanggal (tanpa job) |
| `POST /archives` | Buat job → 202, worker menulis `.csv.gz` + manifest |
| `GET /archives/{id}` | Job + manifest (`recordCount`, rentang tanggal, SHA-256, versi skema 1) |
| `POST /archives/{id}/verify` | Baca-ulang + cocokkan checksum & jumlah (`valid`) |
| `POST /archives/{id}/copy` | Salinan kedua + verifikasi (`secondCopyVerified`) |
| `POST /archives/{id}/restore` | Cek checksum + skema → muat ke staging + laporan konflik (tanpa overwrite produksi) |
| `GET /archives/{id}/staging?status=` | Baris staging (`STAGED`/`CONFLICT`) |
| `POST /archives/{id}/purge` | Soft-delete prospect terarsip; TERKUNCI: butuh `ARCHIVE_PURGE_ENABLED=true` + salinan terverifikasi + `dateTo` retensi + `approved:true`, jika tidak 403/422. Deal/customer/histori retained (detach, bukan destroy) |

Baris staging: `{id, status, accountName, conflict}` (`conflict` berisi keterangan
duplikat bila `CONFLICT`, null bila `STAGED`). Daftar deal milik customer
(`GET /customers/{id}/deals`) memakai skema deal penuh seperti daftar deal prospek.
