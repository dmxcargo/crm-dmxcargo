/**
 * Logic halaman Follow-Up — dipisah dari tampilan.
 */

import { useState } from 'react'
import { fuApi, prospectApi, userApi } from '../api/resources'
import { useAuth, useConfirm, useToast } from '../store/app'
import { friendlyError } from '../lib/formErrors'
import { backendFieldErrors } from '../lib/formErrors'
import { compose, dateRequired, futureDate, required } from '../lib/validation'
import { isStaff } from '../utils'
import type { FollowUp, FollowUpPriority, Prospect, User } from '../types'

export interface FuCreateValues {
  prospectId: string
  scheduledAt: string
  description: string
  priority: FollowUpPriority
  assigneeUserId: string
}

export type FuCreateErrors = Partial<Record<keyof FuCreateValues, string>>

export function validateFuCreate(v: FuCreateValues): FuCreateErrors {
  const e: FuCreateErrors = {}
  if (!v.prospectId) e.prospectId = 'Pilih prospek terlebih dahulu. Cari nama / nomor HP, lalu klik salah satu hasil.'
  e.scheduledAt = compose(
    dateRequired(v.scheduledAt, 'Jadwal & Waktu'),
    futureDate(v.scheduledAt, 'Jadwal & Waktu'),
  )
  e.description = compose(
    required(v.description, 'Deskripsi / Catatan Tindak Lanjut'),
    v.description.trim() !== '' && v.description.trim().length < 5
      ? 'Deskripsi terlalu singkat. Tulis minimal 5 karakter. Contoh: Telepon konfirmasi penawaran harga.'
      : undefined,
  )
  Object.keys(e).forEach((k) => {
    if (!e[k as keyof FuCreateErrors]) delete e[k as keyof FuCreateErrors]
  })
  return e
}

export function validateReschedule(newAt: string): string | undefined {
  return compose(dateRequired(newAt, 'Jadwal Baru'), futureDate(newAt, 'Jadwal Baru'))
}

export function useFuCreate(onDone: () => void) {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const staff = isStaff(user)
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<Prospect[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [values, setValues] = useState<Omit<FuCreateValues, 'prospectId'> & { prospectId?: string }>({
    scheduledAt: '',
    description: '',
    priority: 'SEDANG',
    assigneeUserId: '',
  })
  const [sel, setSel] = useState('')
  const [errors, setErrors] = useState<FuCreateErrors>({})
  const [busy, setBusy] = useState(false)

  const ensureUsers = () => {
    if (staff && users.length === 0) {
      userApi.list({}).then((u) => setUsers(u.rows)).catch(() => {})
    }
  }

  const search = async () => {
    if (!q.trim()) {
      setErrors((p) => ({ ...p, prospectId: 'Ketik nama prospek atau nomor HP dulu, lalu klik Cari.' }))
      return
    }
    try {
      const r = await prospectApi.list({ q: q || undefined, pageSize: 10 })
      setOpts(r.rows)
      if (r.rows.length === 0) {
        toast.warning(`Tidak ditemukan prospek untuk "${q}". Coba kata kunci lain.`)
      }
    } catch (e) {
      toast.error(friendlyError(e, 'Gagal mencari prospek. Periksa koneksi lalu coba lagi.'))
    }
  }

  const save = async () => {
    const full: FuCreateValues = {
      prospectId: sel,
      scheduledAt: values.scheduledAt,
      description: values.description,
      priority: values.priority,
      assigneeUserId: values.assigneeUserId,
    }
    const check = validateFuCreate(full)
    setErrors(check)
    if (Object.keys(check).length > 0) {
      toast.error(
        Object.keys(check).length === 1
          ? `${Object.values(check)[0] as string}`
          : `Ada ${Object.keys(check).length} kolom yang perlu diperbaiki. Periksa pesan merah di form.`,
      )
      return
    }
    const ok = await confirm({
      title: 'Jadwalkan Follow-Up',
      message: `Buat jadwal follow-up untuk prospek terpilih pada ${full.scheduledAt.replace('T', ' ')}?`,
      confirmLabel: 'Ya, Buat',
    })
    if (!ok) return
    setBusy(true)
    try {
      await prospectApi.followUps(sel, {
        scheduledAt: new Date(full.scheduledAt).toISOString(),
        description: full.description.trim(),
        priority: full.priority,
        assigneeUserId: full.assigneeUserId || undefined,
      })
      toast.success('Follow-up berhasil dijadwalkan.')
      onDone()
    } catch (e) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) setErrors(server as FuCreateErrors)
      toast.error(friendlyError(e, 'Gagal menjadwalkan follow-up. Coba lagi.'))
    } finally {
      setBusy(false)
    }
  }

  return { q, setQ, opts, sel, setSel, users, values, setValues, errors, busy, staff, search, save, ensureUsers }
}

export async function completeFollowUp(
  row: FollowUp,
  confirm: (o: { title: string; message: string; confirmLabel: string }) => Promise<boolean>,
  toast: { success: (m: string) => void; error: (m: string) => void },
  reload: () => void,
) {
  const ok = await confirm({
    title: 'Selesaikan Follow-Up',
    message: `Tandai follow-up "${row.prospectName ?? 'prospek'}" sebagai selesai? Pastikan hasilnya sudah dicatat.`,
    confirmLabel: 'Ya, Selesai',
  })
  if (!ok) return
  try {
    await fuApi.complete(row.id)
    toast.success('Follow-up berhasil diselesaikan.')
    reload()
  } catch (e) {
    toast.error(friendlyError(e, 'Gagal menyelesaikan follow-up. Follow-up mungkin sudah diselesaikan orang lain — muat ulang daftar.'))
  }
}
