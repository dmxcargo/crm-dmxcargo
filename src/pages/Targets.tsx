import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Pencil, TrendingUp } from 'lucide-react'
import Layout from '../layout'
import { targetApi, userApi, dashApi } from '../api/resources'
import type { Target, PerformanceRow, User, PeriodType } from '../types'
import { useAuth, useConfirm, useToast } from '../store/app'
import { rupiah, errMsg, canManageTarget, pct, parseRupiah, isStaff } from '../utils'
import { Empty, Spinner, Modal, Field, RupiahInput, PageHeader } from '../ui'
import FormAlert from '../components/FormAlert'
import { validateTargetForm } from '../hooks/useTargets'
import { backendFieldErrors } from '../lib/formErrors'

type PerfRow = PerformanceRow & { userName?: string }

interface TargetFormInput {
  userId: string
  periodType: PeriodType
  period: string
  targetValue: string
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
  '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember',
}

const monthName = (p: string) => {
  if (!p || p.length < 7) return p
  const m = p.slice(5, 7)
  const y = p.slice(0, 4)
  return `${MONTH_NAMES[m] ?? m} ${y}`
}

export default function Targets() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const admin = canManageTarget(user)
  const staff = isStaff(user)

  const [rows, setRows] = useState<Target[]>([])
  const [perf, setPerf] = useState<PerfRow[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Target | null>(null)
  const period = new Date().toISOString().slice(0, 7)

  const load = async () => {
    setLoading(true)
    try {
      const [t, p] = await Promise.allSettled([
        targetApi.list({}),
        dashApi.performance({ periodType: 'MONTH', period, groupBy: 'sales' }),
      ])
      if (t.status === 'fulfilled') setRows(t.value.rows ?? [])
      const pv: PerfRow[] = p.status === 'fulfilled' ? (p.value ?? []) : []
      setPerf(Array.isArray(pv) ? pv : [])
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat target.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (staff) {
      userApi.list({}).then((u) => setUsers(u.rows)).catch(() => {})
    }
  }, [])

  const ownerName = (id: string) =>
    users.find((u) => u.id === id)?.name ??
    (user?.role === 'SALES' ? (user?.name ?? 'Target Saya') : String(id ?? '').slice(0, 8))

  const saveTarget = async (f: TargetFormInput) => {
    const check = validateTargetForm(f, Boolean(modal?.id))
    if (Object.keys(check).length > 0) {
      const first = Object.values(check)[0] as string
      toast.error(
        Object.keys(check).length === 1
          ? first
          : `Ada ${Object.keys(check).length} kolom yang perlu diperbaiki. ${first}`,
      )
      return false
    }
    const val = parseRupiah(f.targetValue)
    if (val === undefined || val <= 0) {
      toast.error('Nilai Target wajib diisi lebih dari Rp 0. Contoh: 500.000.000.')
      return false
    }
    const msg = modal?.id
      ? `Ubah target periode ${modal.period} dari ${rupiah(modal.targetValue)} menjadi ${rupiah(val)}?`
      : `Tetapkan target ${rupiah(val)} untuk periode ${f.period}?`
    const ok = await confirm({
      title: modal?.id ? 'Ubah Target' : 'Set Target',
      message: msg,
      confirmLabel: 'Ya, Simpan',
    })
    if (!ok) return false
    try {
      if (modal?.id) {
        await targetApi.update(modal.id, { targetValue: val, version: modal.version })
      } else {
        await targetApi.create({ userId: f.userId, periodType: f.periodType, period: f.period, targetValue: val })
      }
      toast.success('Target berhasil disimpan.')
      setModal(null)
      load()
      return true
    } catch (e) {
      const server = backendFieldErrors(e)
      const firstServer = Object.values(server)[0]
      toast.error(
        firstServer
          ? `Gagal menyimpan: ${firstServer}`
          : errMsg(e, 'Gagal menyimpan target. Periksa periode (tidak boleh duplikat) lalu coba lagi.'),
      )
      return false
    }
  }

  // Ringkasan Periode Berjalan (Referensi Meta Box)
  const totalTarget = perf.reduce((acc, p) => acc + (Number(p.targetValue) || 0), 0)
  const totalActual = perf.reduce((acc, p) => acc + (Number(p.actualValue) || 0), 0)
  const rowsWithClosing = perf.filter((p) => p.closingRate !== undefined && p.closingRate !== null)
  const avgClosingRate =
    rowsWithClosing.length > 0
      ? Math.round(rowsWithClosing.reduce((acc, p) => acc + Number(p.closingRate), 0) / rowsWithClosing.length)
      : 0
  const salesCount = users.filter((u) => u.isActive).length || perf.length

  return (
    <Layout title={user?.role === 'SALES' ? 'Target Saya' : 'Target & Performa'}>
      <PageHeader
        title={user?.role === 'SALES' ? 'Target Saya' : 'Target & Performa'}
        subtitle="Pantau pencapaian sales dan tetapkan target revenue per periode"
        actions={
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5"
              style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
              onClick={load}
              title="Muat ulang data"
            >
              <RefreshCw size={13} /> Muat Ulang
            </button>
            {admin && (
              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1.5"
                style={{ borderRadius: 6, padding: '5px 13px', fontSize: 12.5, fontWeight: 600 }}
                onClick={() => setModal({} as Target)}
              >
                <Plus size={14} /> Set Target
              </button>
            )}
          </div>
        }
      />

      {/* ── 1. Top Meta Overview Box (Mengikuti Aliran Desain Website) ── */}
      <div className="detail-summary-card mb-4">
        <div className="row g-3">
          <div className="col-12 col-md-6 border-end-md">
            <div className="detail-info-row">
              <span className="detail-info-label">Periode Berjalan</span>
              <span className="detail-info-val text-primary font-monospace">
                {period} ({monthName(period)})
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Tipe Evaluasi</span>
              <span className="detail-info-val">Bulanan (Monthly Target)</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Sales Terdaftar</span>
              <span className="detail-info-val">{salesCount} Personil Sales</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Target Ditetapkan</span>
              <span className="detail-info-val">{rows.length} Target Tercatat</span>
            </div>
          </div>

          <div className="col-12 col-md-6 ps-md-4">
            <div className="detail-info-row">
              <span className="detail-info-label">Total Target Tim</span>
              <span className="detail-info-val tbl-link tabular">{rupiah(totalTarget)}</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Total Realisasi (Actual)</span>
              <span className="detail-info-val text-success tabular fw-bold">{rupiah(totalActual)}</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Rata-rata Closing Rate</span>
              <span className="detail-info-val">
                <span className={`badge ${avgClosingRate > 0 ? 'b-green' : 'b-gray'}`} style={{ fontSize: 11 }}>
                  {avgClosingRate}%
                </span>
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Status Periode</span>
              <span className="detail-info-val text-muted">Sedang Berjalan</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* ── 2. Tabel Pencapaian (Mengikuti Sistem Tabel Standar Website) ── */}
          <div className="table-card mb-4">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h6 className="fw-bold text-dark mb-0">Pencapaian ({monthName(period)})</h6>
                <small className="text-muted">Perbandingan target revenue dan realisasi omset per personil sales.</small>
              </div>
              <span className="badge b-blue" style={{ fontSize: 11.5, padding: '4px 9px' }}>
                {perf.length} Sales
              </span>
            </div>

            {perf.length === 0 ? (
              <Empty text="Belum ada data performa periode ini. Data muncul setelah ada closing atau target ditetapkan." />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table-clean">
                    <thead>
                      <tr>
                        <th style={{ width: 48, textAlign: 'center' }}>No</th>
                        <th>Sales</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Target Revenue</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Realisasi (Actual)</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Pencapaian</th>
                        <th style={{ textAlign: 'right', width: 85, whiteSpace: 'nowrap' }}>Prospek</th>
                        <th style={{ textAlign: 'right', width: 85, whiteSpace: 'nowrap' }}>Closing</th>
                        <th style={{ textAlign: 'right', width: 110, whiteSpace: 'nowrap' }}>Closing Rate</th>
                        <th style={{ textAlign: 'center', width: 110, whiteSpace: 'nowrap' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.map((p: PerfRow, idx: number) => {
                        const uObj = users.find(
                          (u) => u.id === p.ownerUserId || u.name === p.ownerName || u.username === p.userName
                        )
                        const salesName = p.ownerName ?? uObj?.name ?? p.userName ?? '—'
                        const hasTarget = p.targetValue != null && Number(p.targetValue) > 0
                        const ach = p.achievement != null ? Number(p.achievement) : 0
                        const act = Number(p.actualValue) || 0
                        const cRate = Number(p.closingRate) || 0

                        return (
                          <tr key={p.ownerUserId || idx}>
                            <td
                              style={{
                                textAlign: 'center',
                                width: 48,
                                color: '#64748b',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td>
                              <div>
                                <span className="fw-semibold text-dark">{salesName}</span>
                                {uObj?.email && (
                                  <div style={{ fontSize: 11.5, color: '#64748b' }}>{uObj.email}</div>
                                )}
                              </div>
                            </td>
                            <td className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                              {hasTarget ? (
                                rupiah(p.targetValue)
                              ) : (
                                <span className="text-muted" style={{ fontSize: 12 }}>
                                  Belum Diatur
                                </span>
                              )}
                            </td>
                            <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                              {rupiah(p.actualValue)}
                            </td>
                            <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                              {hasTarget ? (
                                ach >= 100 ? (
                                  <span className="status-pill status-pill-success">
                                    <TrendingUp size={12} /> {pct(p.achievement)}
                                  </span>
                                ) : ach > 0 ? (
                                  <span className="status-pill status-pill-info tabular">
                                    {pct(p.achievement)}
                                  </span>
                                ) : (
                                  <span className="status-pill status-pill-muted tabular">0%</span>
                                )
                              ) : (
                                <span className="text-muted" style={{ fontSize: 12 }}>
                                  —
                                </span>
                              )}
                            </td>
                            <td className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                              {p.totalProspect ?? 0}
                            </td>
                            <td className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                              {p.closingCount ?? 0}
                            </td>
                            <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                              {cRate > 0 ? (
                                <span className="badge b-green">{pct(p.closingRate)}</span>
                              ) : (
                                <span className="badge b-gray">0%</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {!hasTarget ? (
                                <span className="badge b-gray">Belum Diatur</span>
                              ) : ach >= 100 ? (
                                <span className="badge b-green">Tercapai</span>
                              ) : act > 0 ? (
                                <span className="badge b-blue">On Track</span>
                              ) : (
                                <span className="badge b-orange">Belum Ada Omset</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  className="p-2.5 px-3 border-top d-flex align-items-center justify-content-between text-muted"
                  style={{ fontSize: 12, background: '#fafbfc' }}
                >
                  <span>Total {perf.length} sales dalam evaluasi</span>
                  <span className="font-monospace">Periode: {period}</span>
                </div>
              </>
            )}
          </div>

          {/* ── 3. Tabel Daftar Target (Mengikuti Sistem Tabel Standar Website) ── */}
          <div className="table-card mb-4">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h6 className="fw-bold text-dark mb-0">Daftar Target</h6>
                <small className="text-muted">Ketetapan target revenue yang telah ditetapkan per personil sales.</small>
              </div>
              <span className="badge b-gray" style={{ fontSize: 11.5, padding: '4px 9px' }}>
                {rows.length} Target
              </span>
            </div>

            {rows.length === 0 ? (
              <Empty
                text="Belum ada target. Tetapkan target agar pencapaian bisa diukur."
                action={
                  admin && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1.5"
                      style={{ borderRadius: 6 }}
                      onClick={() => setModal({} as Target)}
                    >
                      <Plus size={14} /> Set Target Sekarang
                    </button>
                  )
                }
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table-clean">
                    <thead>
                      <tr>
                        <th style={{ width: 48, textAlign: 'center' }}>No</th>
                        <th>Sales</th>
                        <th>Periode</th>
                        <th>Tipe</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Nilai Target</th>
                        {admin && <th style={{ textAlign: 'center', width: 90, whiteSpace: 'nowrap' }}>Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((t: Target, idx: number) => {
                        const uObj = users.find((u) => u.id === t.userId)
                        return (
                          <tr key={t.id}>
                            <td
                              style={{
                                textAlign: 'center',
                                width: 48,
                                color: '#64748b',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td>
                              <div>
                                <span className="fw-semibold text-dark">{ownerName(t.userId)}</span>
                                {uObj?.email && (
                                  <div style={{ fontSize: 11.5, color: '#64748b' }}>{uObj.email}</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="d-inline-flex align-items-center gap-1.5">
                                <span className="chip-f font-monospace">{t.period}</span>
                                {t.periodType === 'MONTH' && (
                                  <span className="text-secondary" style={{ fontSize: 12 }}>
                                    ({monthName(t.period)})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="badge b-blue">
                                {t.periodType === 'MONTH' ? 'Bulanan' : 'Tahunan'}
                              </span>
                            </td>
                            <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                              {rupiah(t.targetValue)}
                            </td>
                            {admin && (
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5"
                                  style={{ padding: '3px 10px', fontSize: 12, borderRadius: 6 }}
                                  onClick={() => setModal(t)}
                                >
                                  <Pencil size={12} /> Ubah
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  className="p-2.5 px-3 border-top d-flex align-items-center justify-content-between text-muted"
                  style={{ fontSize: 12, background: '#fafbfc' }}
                >
                  <span>Total {rows.length} target ditetapkan</span>
                  <span>Target Aktif</span>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {modal !== null && (
        <TargetModal
          initial={modal.id ? modal : null}
          users={users}
          onClose={() => setModal(null)}
          onSave={saveTarget}
        />
      )}
    </Layout>
  )
}

const MONTHS = [
  ['01', 'Januari'], ['02', 'Februari'], ['03', 'Maret'], ['04', 'April'],
  ['05', 'Mei'], ['06', 'Juni'], ['07', 'Juli'], ['08', 'Agustus'],
  ['09', 'September'], ['10', 'Oktober'], ['11', 'November'], ['12', 'Desember'],
]
const YEARS = Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 1 + i))

interface TargetModalProps {
  initial: Target | null
  users: User[]
  onClose: () => void
  onSave: (f: TargetFormInput) => Promise<boolean>
}

function TargetModal({ initial, users, onClose, onSave }: TargetModalProps) {
  const toast = useToast()
  const now = new Date()
  const [f, setF] = useState({
    userId: initial?.userId ?? '',
    periodType: (initial?.periodType ?? 'MONTH') as PeriodType,
    month:
      (initial?.period ?? '').length === 7
        ? (initial as Target).period.slice(5)
        : String(now.getMonth() + 1).padStart(2, '0'),
    year: (initial?.period ?? '').slice(0, 4) || String(now.getFullYear()),
    targetValue: initial?.targetValue ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentInput = {
    ...f,
    period: f.periodType === 'MONTH' ? `${f.year}-${f.month}` : f.year,
  }
  const liveErrors = validateTargetForm(currentInput, Boolean(initial))

  const go = async () => {
    const check = validateTargetForm(currentInput, Boolean(initial))
    setErrors(check)
    if (Object.keys(check).length > 0) {
      const first = Object.values(check)[0] as string
      toast.error(Object.keys(check).length === 1 ? first : `Ada ${Object.keys(check).length} kolom yang perlu diperbaiki. ${first}`)
      return
    }
    setBusy(true)
    const ok = await onSave(currentInput)
    setBusy(false)
    if (!ok) setErrors(liveErrors)
  }

  const shown = { ...liveErrors, ...errors }
  const showUserErr = !initial ? shown.userId : undefined
  const showTargetErr = shown.targetValue

  return (
    <Modal
      title={initial ? 'Ubah Target' : 'Set Target'}
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void go()}>
            {busy ? 'Menyimpan...' : 'Simpan'}
          </button>
        </>
      }
    >
      <FormAlert errors={shown} title="Belum bisa menyimpan target." />
      <div className="row g-3">
        {!initial && (
          <Field label="Sales" req err={showUserErr} hint="Pilih sales yang akan diberi target.">
            <select
              className="form-select"
              value={f.userId}
              onChange={(e) => setF({ ...f, userId: e.target.value })}
            >
              <option value="">— Pilih —</option>
              {users
                .filter((u: User) => u.isActive)
                .map((u: User) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Tipe Periode">
          <select
            className="form-select"
            value={f.periodType}
            onChange={(e) => setF({ ...f, periodType: e.target.value as PeriodType })}
          >
            <option value="MONTH">Bulanan</option>
            <option value="YEAR">Tahunan</option>
          </select>
        </Field>
        {!initial && f.periodType === 'MONTH' && (
          <Field label="Bulan" req>
            <select
              className="form-select"
              value={f.month}
              onChange={(e) => setF({ ...f, month: e.target.value })}
            >
              {MONTHS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!initial && (
          <Field label="Tahun" req>
            <select
              className="form-select"
              value={f.year}
              onChange={(e) => setF({ ...f, year: e.target.value })}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        )}
        {initial && (
          <Field label="Periode">
            <input className="form-control" value={initial.period} disabled />
          </Field>
        )}
        <Field label="Nilai Target" req err={showTargetErr} hint="Contoh: 500.000.000 untuk Rp 500 juta.">
          <RupiahInput value={f.targetValue} onChange={(v) => setF({ ...f, targetValue: v })} />
        </Field>
      </div>
    </Modal>
  )
}
