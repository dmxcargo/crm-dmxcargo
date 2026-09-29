/**
 * Kumpulan validator form berbahasa Indonesia yang ramah pengguna.
 *
 * Prinsip:
 * - Setiap fungsi mengembalikan `string | undefined`.
 *   `undefined` = valid, `string` = pesan kesalahan yang siap ditampilkan
 *   persis di bawah field (inline) — bukan kode teknis.
 * - Pesan selalu menyebut NAMA field + apa yang kurang + contoh benar,
 *   supaya user langsung paham tanpa menebak.
 * - File ini murni logika (tidak ada JSX) agar bisa dipakai ulang
 *   semua halaman tanpa menduplikasi aturan.
 */

import { validEmail as isEmailFmt, validPhone as isPhoneFmt, parseRupiah } from '../utils'

export type FormErrors<T extends object = Record<string, unknown>> = Partial<Record<keyof T | string, string>>

const trim = (v: unknown): string => String(v ?? '').trim()

/** "Nama Account wajib diisi." */
export const required = (value: unknown, label: string): string | undefined =>
  trim(value) === '' ? `${label} wajib diisi.` : undefined

/** Wajib pilih pada <select>/radio. Pesan dibedakan agar jelas. */
export const requiredChoice = (value: unknown, label: string): string | undefined =>
  trim(value) === '' ? `Pilih ${label} terlebih dahulu.` : undefined

export const minLength = (value: unknown, label: string, min: number): string | undefined => {
  const s = trim(value)
  if (s === '') return undefined // biar `required` yang menegur
  return s.length < min ? `${label} minimal ${min} karakter (saat ini ${s.length} karakter).` : undefined
}

export const emailFormat = (value: unknown, label = 'Email'): string | undefined => {
  const s = trim(value)
  if (s === '') return undefined
  return isEmailFmt(s) ? undefined : `Format ${label} tidak valid. Contoh yang benar: nama@perusahaan.com.`
}

export const phoneFormat = (value: unknown, label = 'Nomor WhatsApp'): string | undefined => {
  const s = trim(value)
  if (s === '') return undefined
  if (!/^[\d\s+()-]+$/.test(s)) return `${label} hanya boleh berisi angka, spasi, +, - , dan tanda kurung.`
  return isPhoneFmt(s)
    ? undefined
    : `${label} tidak valid. Minimal 9 digit angka. Contoh: 0812-3456-7890.`
}

export const rupiahRequired = (value: unknown, label: string): string | undefined => {
  const n = parseRupiah(value)
  if (n === undefined) return `${label} wajib diisi. Contoh: 50.000.000.`
  return undefined
}

export const rupiahOptional = (value: unknown, label: string): string | undefined => {
  const s = trim(value)
  if (s === '') return undefined
  const n = parseRupiah(value)
  if (n === undefined) return `${label} tidak valid. Isi hanya angka. Contoh: 50.000.000.`
  if (n < 0) return `${label} tidak boleh negatif.`
  return undefined
}

/** Memastikan tanggal/waktu sudah diisi dan tidak kadaluarsa (opsional). */
export const dateRequired = (value: unknown, label: string): string | undefined => {
  const s = trim(value)
  if (s === '') return `${label} wajib diisi.`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return `${label} tidak valid. Pilih tanggal dari kalender.`
  return undefined
}

export const futureDate = (value: unknown, label: string): string | undefined => {
  const s = trim(value)
  if (s === '') return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return `${label} tidak valid. Pilih tanggal dari kalender.`
  if (d.getTime() < Date.now() - 60_000) return `${label} sudah lewat. Pilih waktu yang akan datang.`
  return undefined
}

export const passwordRule = (value: unknown, min = 12): string | undefined => {
  const s = String(value ?? '')
  if (s === '') return `Password wajib diisi (minimal ${min} karakter).`
  if (s.length < min) return `Password terlalu pendek. Minimal ${min} karakter (saat ini ${s.length} karakter).`
  return undefined
}

/** Username: huruf kecil, angka, titik, underscore, strip. */
export const usernameRule = (value: unknown): string | undefined => {
  const s = trim(value).toLowerCase()
  if (s === '') return 'Username wajib diisi. Contoh: budi.sales.'
  if (s.length < 3) return 'Username minimal 3 karakter. Contoh: budi.sales.'
  if (!/^[a-z0-9._-]+$/.test(s)) return 'Username hanya boleh huruf, angka, titik (.), underscore (_), dan strip (-).'
  return undefined
}

/** Kode master: huruf kapital + angka + underscore. */
export const masterCodeRule = (value: unknown): string | undefined => {
  const s = trim(value)
  if (s === '') return 'Kode wajib diisi. Contoh: SHOPEE, MANUFAKTUR.'
  if (!/^[A-Z0-9_]+$/.test(s.toUpperCase())) return 'Kode hanya boleh huruf kapital, angka, dan underscore (_). Contoh: TOKOPEDIA.'
  return undefined
}

/** Menggabungkan beberapa validator: kembalikan kesalahan pertama. */
export const compose = (...checks: Array<string | undefined>): string | undefined =>
  checks.find((c): c is string => typeof c === 'string')

/** True bila tidak ada pesan error. */
export const isValid = (errors: Record<string, string | undefined>): boolean =>
  Object.values(errors).every((v) => !v)

/** Hitung jumlah field yang bermasalah (untuk ringkasan "3 kolom perlu diperbaiki"). */
export const countErrors = (errors: Record<string, string | undefined>): number =>
  Object.values(errors).filter(Boolean).length
