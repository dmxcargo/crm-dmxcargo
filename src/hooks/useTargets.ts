/**
 * Logic halaman Target — validasi "kurang apa" dipisah dari tampilan.
 */

import { requiredChoice, rupiahRequired } from '../lib/validation'
import { parseRupiah } from '../utils'
import type { PeriodType } from '../types'

export interface TargetFormInput {
  userId: string
  periodType: PeriodType
  period: string
  targetValue: string
}

export type TargetFormErrors = Partial<Record<'userId' | 'period' | 'targetValue' | 'month' | 'year', string>>

export function validateTargetForm(f: TargetFormInput, isEdit: boolean): TargetFormErrors {
  const e: TargetFormErrors = {}
  if (!isEdit) {
    e.userId = requiredChoice(f.userId, 'Sales')
    if (!f.period) {
      e.period = 'Periode wajib dipilih. Pilih bulan dan tahun periode target.'
    } else if (f.periodType === 'MONTH' && !/^\d{4}-\d{2}$/.test(f.period)) {
      e.period = `Periode bulanan tidak valid ("${f.period}"). Gunakan format YYYY-MM. Contoh: 2026-09.`
    } else if (f.periodType === 'YEAR' && !/^\d{4}$/.test(f.period)) {
      e.period = `Periode tahunan tidak valid ("${f.period}"). Gunakan format YYYY. Contoh: 2026.`
    }
  }
  const val = parseRupiah(f.targetValue)
  if (val === undefined) {
    e.targetValue = 'Nilai Target wajib diisi. Contoh: 500.000.000.'
  } else if (val <= 0) {
    e.targetValue = 'Nilai Target harus lebih dari Rp 0. Contoh: 500.000.000.'
  }
  void requiredChoice
  void rupiahRequired
  Object.keys(e).forEach((k) => {
    if (!e[k as keyof TargetFormErrors]) delete e[k as keyof TargetFormErrors]
  })
  return e
}
