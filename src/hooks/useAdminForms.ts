/**
 * Validasi form Admin (User & Master) — dipisah dari tampilan.
 */

import { compose, emailFormat, masterCodeRule, minLength, passwordRule, required, usernameRule } from '../lib/validation'

export interface UserFormValues {
  name: string
  username: string
  email: string
  password: string
  role: string
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>

export function validateUserForm(v: UserFormValues, isEdit: boolean): UserFormErrors {
  const e: UserFormErrors = {}
  e.name = compose(
    required(v.name, 'Nama'),
    minLength(v.name, 'Nama', 3),
  )
  if (!isEdit) {
    e.username = usernameRule(v.username)
  }
  e.email = compose(required(v.email, 'Email'), emailFormat(v.email))
  if (!v.role) e.role = 'Pilih Peran terlebih dahulu (ADMIN / BILLING / SALES).'
  if (!isEdit) {
    e.password = passwordRule(v.password, 12)
  } else if (v.password !== '') {
    e.password = passwordRule(v.password, 12)
  }
  const out: UserFormErrors = {}
  Object.entries(e).forEach(([k, val]) => {
    if (val) out[k as keyof UserFormErrors] = val
  })
  return out
}

export interface MasterFormValues {
  code: string
  label: string
}

export type MasterFormErrors = Partial<Record<keyof MasterFormValues, string>>

export function validateMasterForm(v: MasterFormValues): MasterFormErrors {
  const e: MasterFormErrors = {}
  e.code = masterCodeRule(v.code)
  e.label = compose(required(v.label, 'Label'), minLength(v.label, 'Label', 3))
  const out: MasterFormErrors = {}
  Object.entries(e).forEach(([k, val]) => {
    if (val) out[k as keyof MasterFormErrors] = val
  })
  return out
}
