# crm-dmxcargo

SPA internal (auth-walled) untuk operasional sales DMX Cargo: prospek, pipeline, follow-up, customer, target, laporan, import/export, arsip. React 18 + TypeScript + Vite 5 + Bootstrap 5 + axios. Ikon: `bootstrap-icons` (tabel/aksi) + `lucide-react` (navigasi/dekoratif). Grafik: chart.js.

## Entry & shell

`main.tsx` → `App.tsx` → `layout.tsx`. Provider bersarang: `ToastProvider > ConfirmProvider > AuthProvider > BrowserRouter`. Semua route privat lewat `Guard` (`staff` untuk admin area). `layout.tsx` milik topbar + sidebar + `<main id="konten-utama">`, sinkron `document.title` per halaman.

## Struktur

```
src/
  api/         client.ts (axios, token sessionStorage, interceptor 401) + resources.ts (semua endpoint)
  pages/       satu file per halaman; modal/dialog colocated di file yang sama
  hooks/       logic yang dipisah dari view: useProspects, useCustomers, useFollowUps,
               useTargets, useAdminForms, useDetailForms, useLoginForm, useForm (generik)
  lib/         murni fungsi: validation.ts (pesan ID per field), formErrors.ts
               (fieldErrors backend → label ramah), actorName.ts (resolve nama aktor)
  components/  FormAlert.tsx (ringkasan error form)
  store/app.tsx  Auth + Toast + Confirm context
  types.ts     KONTRAK API — enum literal disalin persis dari backend, jangan diubah sepihak
  ui.tsx       primitif visual: Field, Modal, Badge, Pager, PageHeader, RupiahInput
```

## Kontrak dengan backend

`types.ts` adalah satu-satunya sumber kebenaran tipe FE. `resources.ts`: `q()` membuang query kosong, `clean()` membuang body `undefined/null/''` (backend menolak field prohibited berisi string kosong), `unwrap()` membuka amplop `{data}`. Base URL: `VITE_API_BASE_URL` (dibake saat start — ganti `.env` wajib restart `npm run dev`). Auth: token Sanctum di `sessionStorage`; 401 selain `/auth/login` → token dibuang + redirect login. Idempotency-Key dikirim saat create prospek/user.

## Pola form (berlaku di semua modal)

1. Validasi inline per field (`lib/validation.ts`, Bahasa Indonesia, menyebut nama kolom + contoh benar).
2. `FormAlert` meringkas semua error di atas form.
3. `fieldErrors` 422 dari backend dipetakan ke field (`lib/formErrors.ts`).
4. Toast sukses/gagal 5 detik, dedupe pesan identik, klik untuk tutup. Semua aksi mutasi wajib punya kedua toast ini.

## Perilaku domain yang diasumsikan FE (jangan dilanggar diam-diam)

- `nextFollowUpAt` prospek adalah **rollup backend** dari task FU terbuka (bukan input manual). FE hanya membaca.
- `paymentStatus` prospek adalah **cermin** dari deal (disinkron saat Won/payment berubah). Dashboard Billing menghitung **prospek stage WON**; null dianggap BELUM_DITAGIH.
- Opsi pindah stage dihitung di FE (`nextStageOptions`, cermin `StageTransition::can`) agar 422 ILLEGAL_TRANSITION tidak sampai ke user. WON/LOST hanya via aksi deal.
- Mode FU (`today/overdue/morning`) dihitung server terhadap `BUSINESS_TIMEZONE`; pencarian teks di halaman bersifat client-side per halaman.
- Import CSV: upload → validate (polling) → review WARNING/DUPLICATE (chunk 500) → commit. INVALID hanya boleh SKIP.
- `GET /users` butuh `users.manage` (403 untuk SALES) — nama aktor diselesaikan via `resolveActorName`: akun sendiri dulu, lalu daftar, terakhir label ramah. Tidak pernah potong UUID.

## Gotcha

- `/prospects/:id` menangkap semua segmen — ID tak dikenal render state "tidak ditemukan", bukan 404 route.
- Filter `owner` diabaikan server tanpa `sales.all`; daftar user halaman-1 (100) — aktor di luar itu tetap ter-resolve bila itu akun sendiri.
- `datetime-local → toISOString() → getter lokal`: roundtrip konsisten, yang tampil = yang dipilih user.
- StrictMode dev menjalankan efek 2x — toast dedupe menutupinya, jangan "memperbaiki" dengan menghapus StrictMode.
- Role: `Guard staff` = ADMIN/BILLING. Matriks izin authoritative ada di backend (`Role::permissions`), bukan di FE.

## Scripts

`npm run dev` (5173) · `npm run typecheck` · `npm run build` (tsc + vite, output `dist/`)

## Docker / Coolify

The root `compose.yaml` builds the Vite app and serves `dist/` with Nginx. For local browser development use `npm run dev`; to smoke-test the production container, copy `.env.example` to `.env`, then run:

```sh
docker compose up -d --build
docker compose exec -T frontend wget -q --spider http://127.0.0.1/
docker compose exec -T frontend wget -q --spider http://127.0.0.1/customers
docker compose down
```

The frontend service has no host port mapping; Coolify's proxy routes to its port 80. `VITE_API_BASE_URL` is embedded in the frontend at build time and must include `/api/v1`. In Coolify, create separate Compose resources for the `development` and `main` branches and set this build variable to the matching API URL (`https://dev.api.crm.dmxcargo.co.id/api/v1` or `https://api.crm.dmxcargo.co.id/api/v1`). It is public configuration, not a secret. Route each domain to the `frontend` service on port 80; Coolify handles HTTPS and public routing.
