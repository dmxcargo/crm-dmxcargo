/**
 * Logic halaman Prospect — dipisah dari tampilan.
 *
 * - `useProspectList`: filter, pencarian, pagination, hapus/arsip.
 * - `validateProspectForm` + `useProspectForm`: aturan "kurang apa" + simpan.
 * View (`pages/Prospects.tsx`) hanya merender dengan class/style yang sama.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { prospectApi, masterApi, userApi } from '../api/resources'
import type { DuplicateCandidate } from '../api/resources'
import type { MasterItem, Priority, Prospect, ProspectCreatePayload, ProspectUpdatePayload, Stage, User } from '../types'
import { useConfirm, useToast } from '../store/app'
import { parseRupiah, rid, isStaff } from '../utils'
import { useAuth } from '../store/app'
import { compose, emailFormat, phoneFormat, required, requiredChoice } from '../lib/validation'
import { backendFieldErrors, friendlyError } from '../lib/formErrors'

// ── Daftar: filter + paging ──────────────────────────────────────────

export interface ProspectFilters {
  stage: string
  priority: string
  sourceCode: string
  owner: string
  city: string
  sort: string
  dateFrom: string
  dateTo: string
  includeArchived: boolean
}

const DEFAULT_FILTERS: ProspectFilters = {
  stage: '',
  priority: '',
  sourceCode: '',
  owner: '',
  city: '',
  sort: 'entryDate:desc',
  dateFrom: '',
  dateTo: '',
  includeArchived: false,
}

export function useProspectList(debouncedQuery: string) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNavigate()
  const staff = isStaff(user)

  const [rows, setRows] = useState<Prospect[]>([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const [params] = useSearchParams()
  const [f, setF] = useState<ProspectFilters>({ ...DEFAULT_FILTERS, stage: params.get('stage') ?? '' })
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<MasterItem[]>([])
  const [users, setUsers] = useState<User[]>([])

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const r = await prospectApi.list({
        q: debouncedQuery || undefined,
        page,
        pageSize: 25,
        stage: (f.stage || undefined) as Stage | undefined,
        priority: (f.priority || undefined) as Priority | undefined,
        sourceCode: f.sourceCode || undefined,
        owner: f.owner || undefined,
        city: f.city || undefined,
        sort: f.sort,
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
        includeArchived: f.includeArchived || undefined,
      })
      setRows(r.rows)
      setMeta({ page: r.page, pages: r.pages, total: r.total })
    } catch (e) {
      toast.error(friendlyError(e, 'Gagal memuat prospek. Periksa koneksi lalu klik Muat Ulang.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    masterApi.sources().then((s) => setSources(s)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (staff) userApi.list({}).then((u) => setUsers(u.rows)).catch(() => {})
  }, [staff])
  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, f.stage, f.priority, f.sourceCode, f.owner, f.city, f.sort, f.dateFrom, f.dateTo, f.includeArchived])

  const del = async (row: Prospect, page: number, reload: (p: number) => void) => {
    const ok = await confirm({
      title: 'Hapus Prospek',
      message: `Hapus prospek "${row.accountName}"? Data masih tersimpan sebagai soft-delete dan bisa dipulihkan admin.`,
      confirmLabel: 'Ya, Hapus',
      danger: true,
    })
    if (!ok) return
    try {
      await prospectApi.remove(row.id)
      toast.success('Prospek berhasil dihapus.')
      reload(page)
    } catch (e) {
      toast.error(friendlyError(e, 'Gagal menghapus prospek. Coba lagi.'))
    }
  }

  const arch = async (row: Prospect, page: number, reload: (p: number) => void) => {
    const to = !row.archived
    const ok = await confirm({
      title: to ? 'Arsipkan Prospek' : 'Buka Arsip',
      message: `${to ? 'Arsipkan' : 'Kembalikan'} prospek "${row.accountName}"?`,
      confirmLabel: 'Ya, Lanjutkan',
    })
    if (!ok) return
    try {
      await prospectApi.archive(row.id, to)
      toast.success(to ? 'Prospek berhasil diarsipkan.' : 'Prospek berhasil dikembalikan ke daftar aktif.')
      reload(page)
    } catch (e) {
      toast.error(friendlyError(e, 'Gagal mengarsipkan prospek. Coba lagi.'))
    }
  }

  return { rows, meta, f, setF, loading, sources, users, staff, load, del, arch, user, toast, confirm, nav }
}

export function countAdvFilters(f: ProspectFilters): number {
  return [f.sourceCode, f.owner, f.city, f.dateFrom, f.dateTo, f.includeArchived ? 'archived' : ''].filter(Boolean).length
}

export function resetFilters(): ProspectFilters {
  return { ...DEFAULT_FILTERS }
}

// ── Form tambah/ubah: validasi ramah ─────────────────────────────────

export interface ProspectFormValues {
  accountName: string
  picName: string
  picPosition: string
  phone: string
  email: string
  city: string
  province: string
  industryCode: string
  sourceCode: string
  priority: Priority
  customerType: 'B2B' | 'B2C'
  potentialValue: string
  notes: string
}

export const EMPTY_PROSPECT_FORM: ProspectFormValues = {
  accountName: '',
  picName: '',
  picPosition: '',
  phone: '',
  email: '',
  city: '',
  province: '',
  industryCode: '',
  sourceCode: '',
  priority: 'WARM',
  customerType: 'B2B',
  potentialValue: '',
  notes: '',
}

export type ProspectFormErrors = Partial<Record<keyof ProspectFormValues, string>>

/** Aturan "kurang apa": setiap field wajib menjelaskan sendiri. */
export function validateProspectForm(values: ProspectFormValues, isEdit: boolean): ProspectFormErrors {
  const e: ProspectFormErrors = {}
  e.accountName = required(values.accountName, 'Nama Account')
  if (!isEdit) {
    e.phone = compose(required(values.phone, 'Nomor WhatsApp'), phoneFormat(values.phone))
  } else {
    e.phone = phoneFormat(values.phone)
  }
  e.email = emailFormat(values.email)
  e.sourceCode = requiredChoice(values.sourceCode, 'Sumber Prospek')
  if (!values.priority) e.priority = 'Pilih Prioritas terlebih dahulu (HOT / WARM / COLD).'
  if (!isEdit && !values.customerType) e.customerType = 'Pilih Tipe Customer terlebih dahulu (B2B / B2C).'
  const pot = String(values.potentialValue ?? '').replace(/\D/g, '')
  if (pot !== '' && Number.isNaN(Number(pot))) e.potentialValue = 'Nilai Potensi tidak valid. Isi hanya angka. Contoh: 50.000.000.'
  Object.keys(e).forEach((k) => {
    if (!e[k as keyof ProspectFormErrors]) delete e[k as keyof ProspectFormErrors]
  })
  return e
}

export function useProspectForm(initial: Prospect | null) {
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setFormState] = useState<ProspectFormValues>(() =>
    initial
      ? { ...EMPTY_PROSPECT_FORM, ...(initial as unknown as ProspectFormValues), potentialValue: String(initial.potentialValue ?? '') }
      : EMPTY_PROSPECT_FORM,
  )
  const [errors, setErrors] = useState<ProspectFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dup, setDup] = useState<DuplicateCandidate[]>([])
  const [industries, setIndustries] = useState<MasterItem[]>([])
  const keyRef = useRef<string | null>(null)
  if (!keyRef.current) keyRef.current = rid()

  const set = (k: keyof ProspectFormValues, v: string) => {
    const next = { ...form, [k]: v }
    setFormState(next)
    // Validasi live: pesan hilang segera setelah diperbaiki.
    const check = validateProspectForm(next, Boolean(initial))
    setErrors((prev) => ({ ...prev, [k]: check[k] }))
  }

  useEffect(() => {
    masterApi.industries().then((s) => setIndustries(s)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.phone && !form.email && !form.accountName) {
      setDup([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await prospectApi.duplicates({
          phone: form.phone || undefined,
          email: form.email || undefined,
          accountName: form.accountName || undefined,
          city: form.city || undefined,
        })
        setDup(r)
      } catch {
        /* abaikan — cek duplikat tidak boleh menghalangi input */
      }
    }, 500)
    return () => clearTimeout(t)
  }, [form.phone, form.email, form.accountName, form.city])

  const visibleErrors: ProspectFormErrors = submitted ? errors : errors

  const save = async (onSaved: () => void): Promise<void> => {
    const check = validateProspectForm(form, Boolean(initial))
    setErrors(check)
    setSubmitted(true)
    const keys = Object.keys(check)
    if (keys.length > 0) {
      toast.error(
        keys.length === 1
          ? `${Object.values(check)[0]} Perbaiki dulu lalu klik Simpan lagi.`
          : `Ada ${keys.length} kolom yang perlu diperbaiki. Periksa pesan merah di bawah setiap kolom.`,
      )
      return
    }
    if (dup.length > 0) {
      const go = await confirm({
        title: 'Kemungkinan Duplikat',
        message: `Ditemukan ${dup.length} data mirip (telepon/email/nama sama). Tetap simpan prospek "${form.accountName}" sebagai data baru?`,
        confirmLabel: 'Ya, Tetap Simpan',
        danger: true,
      })
      if (!go) return
    }
    const ok = await confirm({
      title: initial ? 'Ubah Prospek' : 'Tambah Prospek',
      message: initial
        ? `Simpan perubahan prospek "${initial.accountName}"?`
        : `Tambah prospek baru "${form.accountName}"? Pastikan nomor WA dan sumber sudah benar.`,
      confirmLabel: 'Ya, Simpan',
    })
    if (!ok) return
    setBusy(true)
    try {
      const payload = { ...form, potentialValue: parseRupiah(form.potentialValue) }
      if (initial) {
        const { accountName, picName, picPosition, phone, email, city, province, industryCode, sourceCode, priority, potentialValue, notes } = payload
        await prospectApi.update(
          initial.id,
          { accountName, picName, picPosition, phone, email, city, province, industryCode, sourceCode, priority, potentialValue, notes, version: initial.version } as unknown as ProspectUpdatePayload,
        )
        toast.success('Prospek berhasil diperbarui.')
      } else {
        await prospectApi.create(payload as unknown as ProspectCreatePayload, keyRef.current ?? undefined)
        toast.success('Prospek berhasil ditambahkan.')
      }
      onSaved()
    } catch (e) {
      const serverFields = backendFieldErrors(e)
      if (Object.keys(serverFields).length > 0) {
        setErrors(serverFields as ProspectFormErrors)
        toast.error('Server menolak isian. Periksa pesan merah di bawah kolom yang ditandai.')
      } else {
        toast.error(friendlyError(e, 'Gagal menyimpan prospek. Periksa koneksi lalu coba lagi.'))
      }
    } finally {
      setBusy(false)
    }
  }

  return { form, set, errors: visibleErrors, busy, dup, industries, save }
}
