/**
 * Validasi semua dialog di halaman Detail Prospek & Customer.
 * Dipisah dari JSX agar view hanya merender (standar view/logic separation).
 */

import { compose, dateRequired, emailFormat, phoneFormat, required, requiredChoice, rupiahOptional } from '../lib/validation'
import { parseRupiah } from '../utils'

export type SimpleErrors = Record<string, string | undefined>

const clean = (e: SimpleErrors): SimpleErrors => {
  const out: SimpleErrors = {}
  Object.entries(e).forEach(([k, v]) => {
    if (v) out[k] = v
  })
  return out
}

export const validateAssign = (ownerId: string): SimpleErrors =>
  clean({ ownerUserId: requiredChoice(ownerId, 'Owner Baru') })

export interface ActivityValues {
  notes: string
  durationMinutes: string
  attendance: string
  completion: string
  activityAt: string
  nextFollowUpAt: string
}

export const validateActivity = (f: ActivityValues, type: string): SimpleErrors => {
  const e: SimpleErrors = {}
  e.notes = compose(
    required(f.notes, 'Catatan Aktivitas'),
    f.notes.trim() !== '' && f.notes.trim().length < 5
      ? 'Catatan terlalu singkat. Tulis minimal 5 karakter agar bisa dipahami tim.'
      : undefined,
  )
  if (type === 'CALL' && f.durationMinutes !== '') {
    const n = Number(f.durationMinutes)
    if (!Number.isFinite(n) || n < 0) e.durationMinutes = 'Durasi tidak valid. Isi angka menit 0 atau lebih. Contoh: 15.'
  }
  if (f.activityAt !== '') {
    const d = new Date(f.activityAt)
    if (Number.isNaN(d.getTime())) e.activityAt = 'Waktu Aktivitas tidak valid. Pilih dari kalender jam.'
  }
  if (f.nextFollowUpAt !== '') {
    const d = new Date(f.nextFollowUpAt)
    if (Number.isNaN(d.getTime())) e.nextFollowUpAt = 'Follow-up Berikutnya tidak valid. Pilih dari kalender jam.'
  }
  return clean(e)
}

export const validateSchedule = (scheduledAt: string, description: string): SimpleErrors =>
  clean({
    scheduledAt: dateRequired(scheduledAt, 'Jadwal'),
    description: compose(
      required(description, 'Deskripsi'),
      description.trim() !== '' && description.trim().length < 5
        ? 'Deskripsi terlalu singkat. Minimal 5 karakter. Contoh: Kunjungan demo produk.'
        : undefined,
    ),
  })

export const validateWon = (closingDate: string, closingValue: string, mode: string, customerId: string): SimpleErrors => {
  const e: SimpleErrors = {}
  e.closingDate = dateRequired(closingDate, 'Tanggal Closing')
  const cv = parseRupiah(closingValue)
  if (cv === undefined) e.closingValue = 'Closing Value wajib diisi. Contoh: 250.000.000.'
  else if (cv <= 0) e.closingValue = 'Closing Value harus lebih dari Rp 0.'
  if (mode === 'existing' && !customerId) e.customerId = 'Pilih salah satu customer yang sudah ada, atau pilih "Buat customer baru".'
  return clean(e)
}

export const validateLost = (reason: string): SimpleErrors =>
  clean({ lostReasonCode: requiredChoice(reason, 'Alasan Lost') })

export const validateContact = (name: string, phone: string, email: string): SimpleErrors =>
  clean({
    name: required(name, 'Nama Kontak'),
    phone: phoneFormat(phone, 'No. Telepon / WA'),
    email: emailFormat(email),
  })

export const validateRepeatNew = (sourceCode: string, phone: string, potentialValue: string): SimpleErrors => {
  const e: SimpleErrors = {}
  e.sourceCode = requiredChoice(sourceCode, 'Sumber Prospek')
  e.phone = phoneFormat(phone, 'No. Telepon / WA')
  const pot = rupiahOptional(potentialValue, 'Nilai Potensi')
  if (pot) e.potentialValue = pot
  return clean(e)
}
