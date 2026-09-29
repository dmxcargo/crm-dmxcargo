/**
 * Logic halaman Customer — dipisah dari tampilan.
 * View (`pages/Customers.tsx`) hanya merender dengan class/style yang sama.
 */

import { useState } from 'react'
import { customerApi } from '../api/resources'
import { useConfirm, useToast } from '../store/app'
import { emailFormat, phoneFormat, required } from '../lib/validation'
import { backendFieldErrors, friendlyError } from '../lib/formErrors'
import type { Customer } from '../types'

export interface CustomerFormValues {
  accountName: string
  phone: string
  email: string
  city: string
  province: string
  isActive: boolean
}

export type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>

export function validateCustomerForm(v: CustomerFormValues): CustomerFormErrors {
  const e: CustomerFormErrors = {}
  e.accountName = required(v.accountName, 'Nama Account')
  e.phone = phoneFormat(v.phone, 'Nomor Telepon')
  e.email = emailFormat(v.email)
  Object.keys(e).forEach((k) => {
    if (!e[k as keyof CustomerFormErrors]) delete e[k as keyof CustomerFormErrors]
  })
  return e
}

export function useCustomerForm(initial: Customer | null, onSaved: () => void) {
  const toast = useToast()
  const confirm = useConfirm()
  const [f, setFState] = useState<CustomerFormValues>({
    accountName: initial?.accountName ?? '',
    phone: String(initial?.phone ?? ''),
    email: String(initial?.email ?? ''),
    city: String(initial?.city ?? ''),
    province: String(initial?.province ?? ''),
    isActive: initial?.active ?? true,
  })
  const [errors, setErrors] = useState<CustomerFormErrors>({})
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<CustomerFormValues>) => {
    const next = { ...f, ...patch }
    setFState(next)
    const check = validateCustomerForm(next)
    setErrors((prev) => {
      const merged = { ...prev }
      Object.keys(patch).forEach((k) => {
        merged[k as keyof CustomerFormErrors] = check[k as keyof CustomerFormErrors]
      })
      return merged
    })
  }

  const save = async () => {
    const check = validateCustomerForm(f)
    setErrors(check)
    if (Object.keys(check).length > 0) {
      const first = Object.values(check)[0] as string
      toast.error(
        Object.keys(check).length === 1
          ? `${first} Perbaiki dulu lalu klik Simpan lagi.`
          : `Ada ${Object.keys(check).length} kolom yang perlu diperbaiki. Periksa pesan merah di bawah setiap kolom.`,
      )
      return
    }
    const ok = await confirm({
      title: initial ? 'Ubah Customer' : 'Tambah Customer',
      message: initial
        ? `Simpan perubahan customer "${initial.accountName}"?`
        : `Tambah customer baru "${f.accountName}"? Pastikan nama dan kontak sudah benar.`,
      confirmLabel: 'Ya, Simpan',
    })
    if (!ok) return
    setBusy(true)
    try {
      if (initial) {
        await customerApi.update(initial.id, { ...f, isActive: f.isActive, version: initial.version })
      } else {
        const { isActive: _a, ...rest } = f
        void _a
        await customerApi.create(rest)
      }
      toast.success(initial ? 'Customer berhasil diperbarui.' : 'Customer berhasil ditambahkan.')
      onSaved()
    } catch (e) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) {
        setErrors(server as CustomerFormErrors)
        toast.error('Server menolak isian. Periksa pesan merah di bawah kolom yang ditandai.')
      } else {
        toast.error(friendlyError(e, 'Gagal menyimpan customer. Periksa koneksi lalu coba lagi.'))
      }
    } finally {
      setBusy(false)
    }
  }

  return { f, set, errors, busy, save }
}
