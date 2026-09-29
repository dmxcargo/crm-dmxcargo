import { useEffect, useState } from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import Layout from '../layout'
import { dashApi, userApi } from '../api/resources'
import { useAuth, useToast } from '../store/app'
import { rupiah, errMsg, pct, num, isStaff } from '../utils'
import { Spinner, Empty, PageHeader } from '../ui'
import type { PerformanceRow, User, PeriodType } from '../types'

type AnnualData = { year: string; totals: Record<string, unknown>; perSales: PerformanceRow[] }
type MatrixRow = { metric: string; [year: string]: string | number }

const MONTHS: Array<[string, string]> = [
  ['01', 'Januari'],
  ['02', 'Februari'],
  ['03', 'Maret'],
  ['04', 'April'],
  ['05', 'Mei'],
  ['06', 'Juni'],
  ['07', 'Juli'],
  ['08', 'Agustus'],
  ['09', 'September'],
  ['10', 'Oktober'],
  ['11', 'November'],
  ['12', 'Desember'],
]

const MONTH_NAMES: Record<string, string> = Object.fromEntries(MONTHS)
const monthName = (m: string) => MONTH_NAMES[m] ?? m

const YEARS: string[] = Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 2 + i))

const actText = (arr: PerformanceRow['activities'] | undefined): string =>
  Array.isArray(arr) && arr.length > 0
    ? arr
        .map(
          (a) =>
            `${a.type} ${a.c}${a.answered !== undefined ? ` (${a.answered} dijawab)` : ''}`
        )
        .join(', ')
    : '—'

export function Performance() {
  const toast = useToast()
  const { user } = useAuth()
  const staff = isStaff(user)
  const [rows, setRows] = useState<PerformanceRow[]>([])
  const now = new Date()
  const defaultMonth = String(now.getMonth() + 1).padStart(2, '0')
  const defaultYear = String(now.getFullYear())

  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [type, setType] = useState<PeriodType>('MONTH')
  const [groupBy, setGroupBy] = useState<'sales' | 'self'>('sales')
  const [owner, setOwner] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const period = type === 'MONTH' ? `${year}-${month}` : year

  const load = async () => {
    if (type === 'MONTH' && !/^\d{4}-\d{2}$/.test(period)) {
      toast.error(`Periode "${period}" tidak valid. Pilih bulan & tahun dari dropdown.`)
      return
    }
    if (type === 'YEAR' && !/^\d{4}$/.test(period)) {
      toast.error(`Periode "${period}" tidak valid. Pilih tahun dari dropdown.`)
      return
    }
    setLoading(true)
    try {
      const r = await dashApi.performance({
        periodType: type,
        period,
        groupBy,
        owner: owner || undefined,
      })
      setRows(r)
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat laporan performa.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, month, year, groupBy, owner])

  useEffect(() => {
    if (staff) {
      userApi
        .list({})
        .then((u) => setUsers(u.rows))
        .catch(() => {})
    }
  }, [staff])

  // Ringkasan Periode Berjalan
  const totActual = rows.reduce((a: number, r: PerformanceRow) => a + Number(r.actualValue ?? 0), 0)
  const totTarget = rows.reduce((a: number, r: PerformanceRow) => a + Number(r.targetValue ?? 0), 0)
  const totPros = rows.reduce((a: number, r: PerformanceRow) => a + Number(r.totalProspect ?? 0), 0)
  const totClose = rows.reduce((a: number, r: PerformanceRow) => a + Number(r.closingCount ?? 0), 0)
  const totOver = rows.reduce((a: number, r: PerformanceRow) => a + Number(r.overdueFollowUps ?? 0), 0)
  const capaianPct = totTarget > 0 ? Math.round((totActual / totTarget) * 100) : null
  const winRatePct = totPros > 0 ? Math.round((totClose / totPros) * 100) : null

  return (
    <Layout title={user?.role === 'SALES' ? 'Performa Saya' : 'Laporan Performa'}>
      <PageHeader
        title={user?.role === 'SALES' ? 'Performa Saya' : 'Laporan Performa'}
        subtitle="Analisis pencapaian target, konversi prospek, dan aktivitas sales per periode"
      />

      {/* ── Toolbar Kontrol Periode & Filter (Selalu Berada di Baris Mandiri) ── */}
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', borderRadius: 6, fontSize: 12.5 }}
            value={type}
            onChange={(e) => setType(e.target.value as PeriodType)}
            aria-label="Tipe Periode"
          >
            <option value="MONTH">Bulanan</option>
            <option value="YEAR">Tahunan</option>
          </select>

          {type === 'MONTH' && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', borderRadius: 6, fontSize: 12.5 }}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Pilih Bulan"
            >
              {MONTHS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}

          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', borderRadius: 6, fontSize: 12.5 }}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Pilih Tahun"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>

          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', borderRadius: 6, fontSize: 12.5 }}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'sales' | 'self')}
            aria-label="Kelompokkan Data"
          >
            <option value="sales">Semua Tim Sales</option>
            <option value="self">Saya Sendiri</option>
          </select>

          {staff && groupBy === 'sales' && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', borderRadius: 6, fontSize: 12.5 }}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              aria-label="Filter Sales PIC"
            >
              <option value="">Semua Sales PIC</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5"
          style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
          onClick={load}
          title="Muat ulang data performa"
        >
          <RefreshCw size={13} /> Muat Ulang
        </button>
      </div>

      {/* ── 1. Top Meta Overview Box (DNA Aliran Desain Website) ─── */}
      <div className="detail-summary-card mb-4">
        <div className="row g-3">
          {/* Kolom 1: Periode & Personil */}
          <div className="col-12 col-md-4 border-end-md">
            <div className="detail-info-row">
              <span className="detail-info-label">Periode Evaluasi</span>
              <span className="detail-info-val text-primary font-monospace">
                {type === 'MONTH' ? `${monthName(month)} ${year}` : `Tahun ${year}`}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Tipe Laporan</span>
              <span className="detail-info-val">
                {type === 'MONTH' ? 'Bulanan (Monthly Target)' : 'Tahunan (Annual Target)'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Personil Sales</span>
              <span className="detail-info-val">{rows.length} Personil Sales</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Total Prospek</span>
              <span className="detail-info-val tabular">{totPros} Akun Prospek</span>
            </div>
          </div>

          {/* Kolom 2: Target & Realisasi */}
          <div className="col-12 col-md-4 border-end-md ps-md-3">
            <div className="detail-info-row">
              <span className="detail-info-label">Total Target Tim</span>
              <span className="detail-info-val tbl-link tabular">
                {totTarget > 0 ? rupiah(totTarget) : 'Belum Diatur (Rp 0)'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Total Realisasi (Actual)</span>
              <span className="detail-info-val text-success tabular fw-bold">
                {rupiah(totActual)}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Capaian Target</span>
              <span className="detail-info-val">
                {totTarget > 0 && capaianPct !== null ? (
                  <span
                    className={`status-pill ${
                      capaianPct >= 100
                        ? 'status-pill-success'
                        : capaianPct > 0
                        ? 'status-pill-info'
                        : 'status-pill-muted'
                    }`}
                  >
                    {capaianPct}%
                  </span>
                ) : (
                  <span className="text-muted small">Belum Ada Target</span>
                )}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Status Periode</span>
              <span className="detail-info-val text-muted">Sedang Berjalan</span>
            </div>
          </div>

          {/* Kolom 3: Closing & Overdue */}
          <div className="col-12 col-md-4 ps-md-3">
            <div className="detail-info-row">
              <span className="detail-info-label">Deal Closing (Won)</span>
              <span className="detail-info-val tabular text-dark fw-bold">
                {totClose} Deal Menang
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Win Rate Prospek</span>
              <span className="detail-info-val">
                {winRatePct !== null && winRatePct > 0 ? (
                  <span className="badge b-green">{winRatePct}%</span>
                ) : (
                  <span className="badge b-gray">{winRatePct !== null ? `${winRatePct}%` : '—'}</span>
                )}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Follow-Up Overdue</span>
              <span className="detail-info-val">
                {totOver === 0 ? (
                  <span className="badge b-green">0 (Aman)</span>
                ) : (
                  <span className="badge b-red">{totOver} Terlambat</span>
                )}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Catatan Progres</span>
              <span className="detail-info-val text-secondary small">
                {totClose > 0 ? `${totClose} deal closing berhasil` : 'Belum ada deal closing'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Tabel Rincian Performa Sales (Standar Table-Card) ── */}
      <div className="table-card mb-4">
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h6 className="fw-bold text-dark mb-0">Rincian Performa Sales ({period})</h6>
            <small className="text-muted">
              Perbandingan target revenue, realisasi omset, dan rasio closing per personil sales.
            </small>
          </div>
          <span className="badge b-blue" style={{ fontSize: 11.5, padding: '4px 9px' }}>
            {rows.length} Sales
          </span>
        </div>

        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty text="Tidak ada data performa. Ubah periode atau pastikan ada aktivitas/closing di periode tersebut." />
        ) : (
          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th style={{ width: 48, textAlign: 'center' }}>No</th>
                  <th>Sales</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Target Revenue</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Realisasi (Actual)</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Achievement</th>
                  <th style={{ textAlign: 'right', width: 110, whiteSpace: 'nowrap' }}>Prospek</th>
                  <th style={{ textAlign: 'right', width: 70, whiteSpace: 'nowrap' }}>Closing</th>
                  <th style={{ textAlign: 'right', width: 100, whiteSpace: 'nowrap' }}>Closing Rate</th>
                  <th>Aktivitas</th>
                  <th style={{ textAlign: 'center', width: 120, whiteSpace: 'nowrap' }}>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const sName =
                    r.ownerName ?? (r as PerformanceRow & { userName?: string }).userName ?? 'Sales'
                  const uObj = users.find((u) => u.name === sName || u.id === r.ownerUserId)
                  const hasTarget = r.targetValue != null && Number(r.targetValue) > 0
                  const ach = r.achievement != null ? Number(r.achievement) : 0
                  const cRate = r.closingRate != null ? Number(r.closingRate) : 0

                  return (
                    <tr key={r.ownerUserId || i}>
                      <td
                        style={{
                          textAlign: 'center',
                          width: 48,
                          color: '#64748b',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {i + 1}
                      </td>
                      <td>
                        <div>
                          <span className="fw-semibold text-dark">{sName}</span>
                          {uObj?.email && (
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>{uObj.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                        {hasTarget ? (
                          rupiah(r.targetValue)
                        ) : (
                          <span className="text-muted" style={{ fontSize: 12 }}>
                            Belum Diatur
                          </span>
                        )}
                      </td>
                      <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                        {rupiah(r.actualValue)}
                      </td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                        {hasTarget ? (
                          ach >= 100 ? (
                            <span className="status-pill status-pill-success">
                              <TrendingUp size={12} /> {pct(r.achievement)}
                            </span>
                          ) : ach > 0 ? (
                            <span className="status-pill status-pill-info tabular">
                              {pct(r.achievement)}
                            </span>
                          ) : (
                            <span className="status-pill status-pill-muted tabular">0%</span>
                          )
                        ) : (
                          <span className="text-muted" style={{ fontSize: 12 }}>
                            Belum Ada Target
                          </span>
                        )}
                      </td>
                      <td className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                        {num(r.totalProspect)}{' '}
                        <span className="text-secondary" style={{ fontSize: 11 }}>
                          ({num(r.hotCount)}/{num(r.warmCount)}/{num(r.coldCount)})
                        </span>
                      </td>
                      <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                        {num(r.closingCount)}
                      </td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                        {cRate > 0 ? (
                          <span className="badge b-green">{pct(cRate)}</span>
                        ) : (
                          <span className="badge b-gray">0%</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{actText(r.activities)}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {Number(r.overdueFollowUps ?? 0) === 0 ? (
                          <span className="badge b-green">0 (Aman)</span>
                        ) : (
                          <span className="badge b-red">{r.overdueFollowUps} Terlambat</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div
          className="p-2.5 px-3 border-top d-flex align-items-center justify-content-between text-muted"
          style={{ fontSize: 12, background: '#fafbfc' }}
        >
          <span>Total {rows.length} sales dalam evaluasi</span>
          <span className="font-monospace">Periode: {period}</span>
        </div>
      </div>
    </Layout>
  )
}

export function Annual() {
  const toast = useToast()
  const { user } = useAuth()
  const staff = isStaff(user)
  const now = new Date()
  const defaultYear = String(now.getFullYear())

  const [year, setYear] = useState(defaultYear)
  const [owner, setOwner] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [m1, setM1] = useState(String(now.getFullYear() - 1))
  const [m2, setM2] = useState(defaultYear)
  const [data, setData] = useState<AnnualData | null>(null)
  const [matrix, setMatrix] = useState<MatrixRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadAnnual = async () => {
    if (!/^\d{4}$/.test(year)) {
      toast.error(`Tahun "${year}" tidak valid. Pilih tahun dari dropdown.`)
      return
    }
    setLoading(true)
    try {
      const a = await dashApi.annual({ year, owner: owner || undefined })
      setData(a)
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat laporan tahunan.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnual()
    loadMatrix(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, owner])

  useEffect(() => {
    if (staff) {
      userApi
        .list({})
        .then((u) => setUsers(u.rows))
        .catch(() => {})
    }
  }, [staff])

  const loadMatrix = async (silent: boolean) => {
    let y1 = Number(m1)
    let y2 = Number(m2)
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
      toast.error('Tahun matriks tidak valid. Pilih kedua tahun dari dropdown.')
      return
    }
    if (y1 > y2) [y1, y2] = [y2, y1]
    if (y2 - y1 > 5) {
      y1 = y2 - 5
      setM1(String(y1))
    }
    try {
      const yrs: number[] = []
      for (let y = y1; y <= y2; y++) yrs.push(y)
      const rs = await Promise.allSettled(
        yrs.map((y) => dashApi.annual({ year: String(y), owner: owner || undefined }))
      )
      const byYear: Record<string, Record<string, unknown>> = {}
      rs.forEach((r: PromiseSettledResult<AnnualData>, i: number) => {
        if (r.status === 'fulfilled') {
          const y = yrs[i]
          if (y === undefined) return
          const v = r.value ?? ({} as AnnualData)
          byYear[String(y)] = v?.totals ?? {}
        }
      })
      const years = Object.keys(byYear)
      if (years.length === 0) {
        toast.error('Gagal memuat matriks.')
        return
      }
      const row = (
        metric: string,
        pick: (t: Record<string, unknown>) => string | number
      ): MatrixRow => ({
        metric,
        ...Object.fromEntries(years.map((y) => [y, pick(byYear[y] ?? {})])),
      })
      setMatrix([
        row('Total Prospek', (t) => num(t.totalProspects ?? t.totalProspect)),
        row('Closing', (t) => num(t.closingCount)),
        row('Closing Rate', (t) => pct(t.closingRate)),
        row('Revenue', (t) => rupiah(t.actualValue ?? t.closingValue)),
      ])
      if (!silent) toast.success('Matriks berhasil dimuat.')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat matriks.'))
    }
  }

  const t: Record<string, unknown> = data?.totals ?? {}
  const perSales: PerformanceRow[] = data?.perSales ?? []

  const totalRev = Number(t.actualValue ?? t.closingValue ?? 0)
  const totalTar = Number(t.targetValue ?? 0)
  const totalAch = t.achievement ?? t.achievementRate
  const achNum = totalAch !== null && totalAch !== undefined ? Number(totalAch) : null
  const winRateVal =
    t.closingRate ??
    (t.totalProspects ? (Number(t.closingCount ?? 0) / Number(t.totalProspects)) * 100 : null)
  const overdueVal = Number(t.overdueFollowUps ?? t.overdue ?? 0)

  return (
    <Layout title={user?.role === 'SALES' ? 'Tahunan Saya' : 'Laporan Tahunan'}>
      <PageHeader
        title={user?.role === 'SALES' ? 'Tahunan Saya' : 'Laporan Tahunan'}
        subtitle="Analisis perbandingan performa penjualan dan realisasi revenue tahunan"
      />

      {/* ── Toolbar Kontrol Periode & Filter (Selalu Berada di Baris Mandiri) ── */}
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', borderRadius: 6, fontSize: 12.5 }}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Pilih Tahun"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>

          {staff && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto', borderRadius: 6, fontSize: 12.5 }}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              aria-label="Filter Sales PIC"
            >
              <option value="">Semua Sales PIC</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5"
          style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
          onClick={() => {
            loadAnnual()
            loadMatrix(false)
          }}
          title="Muat ulang data tahunan"
        >
          <RefreshCw size={13} /> Muat Ulang
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* ── 1. Top Meta Overview Box (Mengikuti Aliran Desain Website) ── */}
          <div className="detail-summary-card mb-4">
            <div className="row g-3">
              <div className="col-12 col-md-4 border-end-md">
                <div className="detail-info-row">
                  <span className="detail-info-label">Periode Evaluasi</span>
                  <span className="detail-info-val text-primary font-monospace">Tahun {year}</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Tipe Evaluasi</span>
                  <span className="detail-info-val">Tahunan (Annual Target)</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Sales Terdaftar</span>
                  <span className="detail-info-val">{perSales.length} Personil Sales</span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Total Prospek</span>
                  <span className="detail-info-val">{num(t.totalProspects ?? t.totalProspect)} Prospek</span>
                </div>
              </div>

              <div className="col-12 col-md-4 border-end-md ps-md-3">
                <div className="detail-info-row">
                  <span className="detail-info-label">Total Target Tahunan</span>
                  <span className="detail-info-val tbl-link tabular">
                    {totalTar > 0 ? rupiah(totalTar) : 'Belum Diatur (Rp 0)'}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Total Realisasi Revenue</span>
                  <span className="detail-info-val text-success tabular fw-bold">
                    {rupiah(totalRev)}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Capaian Revenue</span>
                  <span className="detail-info-val">
                    {achNum !== null && totalTar > 0 ? (
                      <span
                        className={`status-pill ${
                          achNum >= 100
                            ? 'status-pill-success'
                            : achNum > 0
                            ? 'status-pill-info'
                            : 'status-pill-muted'
                        }`}
                      >
                        {achNum}%
                      </span>
                    ) : (
                      <span className="text-muted small">Belum Ada Target</span>
                    )}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Status Periode</span>
                  <span className="detail-info-val text-muted">Tahunan</span>
                </div>
              </div>

              <div className="col-12 col-md-4 ps-md-3">
                <div className="detail-info-row">
                  <span className="detail-info-label">Deal Closing (Won)</span>
                  <span className="detail-info-val tabular text-dark fw-bold">
                    {num(t.closingCount)} Deal Menang
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Rata-rata Win Rate</span>
                  <span className="detail-info-val">
                    {winRateVal !== null && Number(winRateVal) > 0 ? (
                      <span className="badge b-green">{pct(winRateVal)}</span>
                    ) : (
                      <span className="badge b-gray">
                        {winRateVal !== null ? `${pct(winRateVal)}` : '—'}
                      </span>
                    )}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Follow-Up Overdue</span>
                  <span className="detail-info-val">
                    {overdueVal === 0 ? (
                      <span className="badge b-green">0 (Aman)</span>
                    ) : (
                      <span className="badge b-red">{overdueVal} Terlambat</span>
                    )}
                  </span>
                </div>
                <div className="detail-info-row">
                  <span className="detail-info-label">Catatan Tahunan</span>
                  <span className="detail-info-val text-secondary small">
                    {Number(t.closingCount ?? 0) > 0
                      ? `${t.closingCount} deal berhasil diakumulasi`
                      : 'Belum ada akumulasi closing'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 2. Matriks Multi-Tahun ─────────────────────────────── */}
          <div className="table-card p-3 mb-4">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <h6 className="fw-bold mb-1 text-dark">Matriks Multi-Tahun</h6>
                <small className="text-muted">
                  Perbandingan tren total prospek, closing, win rate, dan omset lintas tahun.
                </small>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <label className="small text-secondary fw-medium">Dari:</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto', borderRadius: 6 }}
                  value={m1}
                  onChange={(e) => setM1(e.target.value)}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <label className="small text-secondary fw-medium">Sampai:</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto', borderRadius: 6 }}
                  value={m2}
                  onChange={(e) => setM2(e.target.value)}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  style={{ borderRadius: 6, padding: '3px 9px', fontSize: 12 }}
                  onClick={() => loadMatrix(false)}
                >
                  Bandingkan
                </button>
              </div>
            </div>

            {matrix.length === 0 ? (
              <Empty text="Data matriks tahunan tidak tersedia." />
            ) : (
              <div className="table-responsive">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th style={{ width: 160 }}>Metrik</th>
                      {Object.keys(matrix[0] ?? {})
                        .filter((k) => k !== 'metric')
                        .map((yr) => (
                          <th key={yr} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            Tahun {yr}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((m, idx) => (
                      <tr key={idx}>
                        <td className="fw-semibold text-dark">{m.metric}</td>
                        {Object.entries(m)
                          .filter(([k]) => k !== 'metric')
                          .map(([yr, val]) => (
                            <td key={yr} className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                              {val}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 3. Tabel Sales ─────────────────────────────────────── */}
          {perSales.length > 0 && (
            <div className="table-card mb-4">
              <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <h6 className="fw-bold text-dark mb-0">Rincian Performa Sales Tahun {year}</h6>
                  <small className="text-muted">
                    Pencapaian target revenue dan realisasi omset tahunan per personil sales.
                  </small>
                </div>
                <span className="badge b-blue" style={{ fontSize: 11.5, padding: '4px 9px' }}>
                  {perSales.length} Sales
                </span>
              </div>
              <div className="table-responsive">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th style={{ width: 48, textAlign: 'center' }}>No</th>
                      <th>Sales</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Target</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Realisasi</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Capaian</th>
                      <th style={{ textAlign: 'right', width: 110, whiteSpace: 'nowrap' }}>Prospek</th>
                      <th style={{ textAlign: 'right', width: 70, whiteSpace: 'nowrap' }}>Closing</th>
                      <th style={{ textAlign: 'right', width: 100, whiteSpace: 'nowrap' }}>Rasio</th>
                      <th>Aktivitas</th>
                      <th style={{ textAlign: 'center', width: 110, whiteSpace: 'nowrap' }}>Terlambat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perSales.map((s, i) => {
                      const sName =
                        s.ownerName ?? (s as PerformanceRow & { userName?: string }).userName ?? 'Sales'
                      const uObj = users.find((u) => u.name === sName || u.id === s.ownerUserId)
                      const hasSTar = s.targetValue != null && Number(s.targetValue) > 0
                      const ach = s.achievement != null ? Number(s.achievement) : 0
                      const cRate = s.closingRate != null ? Number(s.closingRate) : 0

                      return (
                        <tr key={s.ownerUserId ?? i}>
                          <td
                            style={{
                              textAlign: 'center',
                              width: 48,
                              color: '#64748b',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {i + 1}
                          </td>
                          <td>
                            <div>
                              <span className="fw-semibold text-dark">{sName}</span>
                              {uObj?.email && (
                                <div style={{ fontSize: 11.5, color: '#64748b' }}>{uObj.email}</div>
                              )}
                            </div>
                          </td>
                          <td className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                            {hasSTar ? (
                              rupiah(s.targetValue)
                            ) : (
                              <span className="text-muted" style={{ fontSize: 12 }}>
                                Belum Diatur
                              </span>
                            )}
                          </td>
                          <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                            {rupiah(s.actualValue)}
                          </td>
                          <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                            {hasSTar ? (
                              ach >= 100 ? (
                                <span className="status-pill status-pill-success">
                                  <TrendingUp size={12} /> {pct(s.achievement)}
                                </span>
                              ) : ach > 0 ? (
                                <span className="status-pill status-pill-info tabular">
                                  {pct(s.achievement)}
                                </span>
                              ) : (
                                <span className="status-pill status-pill-muted tabular">0%</span>
                              )
                            ) : (
                              <span className="text-muted" style={{ fontSize: 12 }}>
                                Belum Ada Target
                              </span>
                            )}
                          </td>
                          <td className="tabular text-end" style={{ whiteSpace: 'nowrap' }}>
                            {num(s.totalProspect)}
                          </td>
                          <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                            {num(s.closingCount)}
                          </td>
                          <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                            {cRate > 0 ? (
                              <span className="badge b-green">{pct(cRate)}</span>
                            ) : (
                              <span className="badge b-gray">0%</span>
                            )}
                          </td>
                          <td style={{ fontSize: 12 }}>{actText(s.activities)}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {Number(s.overdueFollowUps ?? 0) === 0 ? (
                              <span className="badge b-green">0 (Aman)</span>
                            ) : (
                              <span className="badge b-red">{s.overdueFollowUps} Terlambat</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
