/**
 * Penerjemah error backend -> pesan Indonesia yang mudah dipahami user.
 *
 * Backend mengirim `{ code, message, fieldErrors }`. Kode seperti
 * `VERSION_CONFLICT` tidak ramah user, jadi dipetakan ke kalimat aksi:
 * apa yang terjadi + apa yang harus dilakukan user.
 */

import { errMsg } from '../utils'

/** Label ramah untuk nama field teknis backend. */
export const FIELD_LABELS: Record<string, string> = {
  accountName: 'Nama Account',
  picName: 'Nama PIC',
  picPosition: 'Jabatan PIC',
  phone: 'Nomor WhatsApp',
  email: 'Email',
  city: 'Kota',
  province: 'Provinsi',
  industryCode: 'Industri',
  sourceCode: 'Sumber Prospek',
  priority: 'Prioritas',
  customerType: 'Tipe Customer',
  potentialValue: 'Nilai Potensi',
  quotationValue: 'Nilai Quotation',
  quotationNumber: 'Nomor Quotation',
  closingValue: 'Nilai Closing',
  closingDate: 'Tanggal Closing',
  lostReasonCode: 'Alasan Lost',
  notes: 'Catatan',
  description: 'Deskripsi',
  scheduledAt: 'Jadwal',
  nextFollowUpAt: 'Follow-up Berikutnya',
  nextAction: 'Tindakan Berikutnya',
  lastProgress: 'Progres Terakhir',
  name: 'Nama',
  username: 'Username',
  password: 'Password',
  role: 'Peran',
  userId: 'Sales',
  period: 'Periode',
  targetValue: 'Nilai Target',
  code: 'Kode',
  label: 'Label',
  customerId: 'Customer',
  ownerUserId: 'Owner',
  assigneeUserId: 'PIC / Assignee',
  version: 'Versi data',
}

export const friendlyField = (field: string): string =>
  FIELD_LABELS[field] ?? field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()

interface BackendErrorLike {
  response?: {
    data?: {
      code?: string
      message?: string
      traceId?: string
      fieldErrors?: Record<string, unknown>
      errors?: Record<string, unknown>
    }
  }
}

const firstString = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    const f = v.flat()[0]
    return typeof f === 'string' ? f : undefined
  }
  return undefined
}

/**
 * Ambil `fieldErrors`/`errors` backend menjadi `{ field: pesan }`
 * dengan label yang sudah ramah. Contoh:
 * `{ phone: ["sudah dipakai"] }` -> `{ phone: "Nomor WhatsApp: sudah dipakai." }`
 */
export function backendFieldErrors(e: unknown): Record<string, string> {
  const err = e as BackendErrorLike
  const bag = err?.response?.data?.fieldErrors ?? err?.response?.data?.errors
  if (!bag || typeof bag !== 'object') return {}
  const out: Record<string, string> = {}
  Object.entries(bag as Record<string, unknown>).forEach(([field, raw]) => {
    const msg = firstString(raw)
    if (msg) out[field] = `${friendlyField(field)}: ${msg}`
  })
  return out
}

/** Pesan umum (toast/alert) yang ramah — delegasi ke errMsg pusat. */
export const friendlyError = (e: unknown, fallback: string): string => errMsg(e, fallback)

/**
 * Ringkasan untuk error-summary di atas form:
 * "Periksa 3 kolom berikut: Nama Account wajib diisi, ..."
 */
export function summarizeErrors(errors: Record<string, string | undefined>, max = 4): string {
  const list = Object.values(errors).filter((v): v is string => Boolean(v))
  if (list.length === 0) return ''
  if (list.length === 1) return list[0] as string
  const shown = list.slice(0, max).join(' ')
  return list.length > max
    ? `Periksa ${list.length} kolom berikut. ${shown} …dan ${list.length - max} lainnya.`
    : `Periksa ${list.length} kolom berikut. ${shown}`
}
