import type { Role } from './types'
import { FU_PRIORITIES, FU_STATUSES, FU_MODES, ACT_TYPES, PAY_STATUSES, PRIORITIES, STAGES, STAGE_LABEL } from './types'

export { FU_PRIORITIES, FU_STATUSES, FU_MODES, ACT_TYPES, PAY_STATUSES, PRIORITIES, STAGES, STAGE_LABEL }

export const rupiah = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return 'Rp ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const fmtDate = (s?: string | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

export const fmtDateTime = (s?: string | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

export const todayID = (): string => {
  const d = new Date()
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

export const pct = (v: unknown): string => (typeof v === 'number' ? `${v}%` : (v as string) ?? '—')
export const num = (v: unknown): string | number => (v as string | number) ?? '—'

export const ID_STATUS: Record<string, string> = {
  DRAFT: 'Draf', VALIDATING: 'Memvalidasi', READY: 'Siap', COMMITTING: 'Mengimpor',
  DONE: 'Selesai', CANCELLED: 'Dibatalkan', QUEUED: 'Antre', PROCESSING: 'Memproses', FAILED: 'Gagal',
  VALID: 'Valid', WARNING: 'Peringatan', INVALID: 'Tidak Valid', DUPLICATE: 'Duplikat',
  OPEN: 'Berjalan', STAGED: 'Staging', CONFLICT: 'Konflik',
  BELUM_DIMULAI: 'Belum Mulai', BERJALAN: 'Berjalan', SELESAI: 'Selesai', BATAL: 'Batal',
  SKIP: 'Lewati', CREATE_NEW: 'Buat Baru', UPDATE_EXISTING: 'Update Data', MERGE_SELECTED_FIELDS: 'Gabung Pilihan',
}

export const parseRupiah = (s: unknown): number | undefined => {
  const d = String(s ?? '').replace(/\D/g, '')
  return d === '' ? undefined : Number(d)
}
export const formatTitik = (s: unknown): string => {
  const d = String(s ?? '').replace(/\D/g, '')
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
export const validEmail = (s: unknown): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim())
export const validPhone = (s: unknown): boolean => String(s ?? '').replace(/\D/g, '').length >= 9
export const rid = (): string =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

interface UserLike {
  role?: Role | string
  name?: string
}

export const isAdmin = (u?: UserLike | null): boolean => u?.role === 'ADMIN'
export const isStaff = (u?: UserLike | null): boolean => u?.role === 'ADMIN' || u?.role === 'BILLING'
export const canManageTarget = (u?: UserLike | null): boolean => u?.role === 'ADMIN'

interface ApiErrorLike {
  response?: { data?: { message?: string; code?: string; traceId?: string; fieldErrors?: Record<string, unknown>; errors?: Record<string, unknown> } }
  code?: string
  message?: string
}

export const errMsg = (e: ApiErrorLike | unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string => {
  const err = e as ApiErrorLike
  if (!err?.response && (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message ?? ''))) {
    return 'Server terlalu lama merespons. Periksa dulu daftar data sebelum mencoba lagi agar tidak duplikat.'
  }
  const d = err?.response?.data
  if (d?.message) return d.traceId && d?.code === 'INTERNAL_ERROR' ? `${d.message} (Ref: ${d.traceId})` : d.message
  if (err?.message === 'Network Error') return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'
  const code = d?.code
  const map: Record<string, string> = {
    INVALID_CREDENTIALS: 'Username atau password salah.',
    SESSION_EXPIRED: 'Sesi telah berakhir. Silakan masuk kembali.',
    FORBIDDEN: 'Anda tidak memiliki izin untuk aksi ini.',
    NOT_FOUND: 'Data tidak ditemukan.',
    VERSION_CONFLICT: 'Data telah diubah pengguna lain. Muat ulang halaman.',
    DUPLICATE_DATA: 'Data duplikat. Periksa kembali isian Anda.',
    DEAL_EXISTS: 'Prospek ini sudah memiliki deal aktif.',
    CUSTOMER_CHOICE_REQUIRED: 'Pilih customer yang sudah ada atau buat baru.',
    IDEMPOTENCY_CONFLICT: 'Permintaan ganda terdeteksi dengan data berbeda.',
    LAST_ADMIN_REQUIRED: 'Admin aktif terakhir tidak dapat dinonaktifkan.',
    ILLEGAL_TRANSITION: 'Perpindahan stage tidak valid.',
    RATE_LIMITED: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
    ALREADY_COMPLETED: 'Follow-up ini sudah diselesaikan.',
  }
  if (code && map[code]) return map[code]
  if (d?.fieldErrors && typeof d.fieldErrors === 'object') {
    const first = Object.values(d.fieldErrors).flat()[0]
    if (first) return String(first)
  }
  if (d?.errors && typeof d.errors === 'object') {
    const first = Object.values(d.errors).flat()[0]
    if (first) return String(first)
  }
  return fallback
}
