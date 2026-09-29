import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NavigateFunction } from 'react-router-dom'
import {
  FileText, Users, CalendarClock,
  AlertTriangle, Plus, GitBranch, UserCheck,
  Target as TargetIcon, BarChart3, ArrowRight, ArrowDownUp,
  Quote,
} from 'lucide-react'
import Layout from '../layout'
import { dashApi, fuApi, customerApi, prospectApi } from '../api/resources'
import type { DashboardBoard, PipelineBoardRow, Customer, Prospect, FollowUp, User, Stage, PaymentStatusValue } from '../types'
import { useAuth, useToast } from '../store/app'
import { rupiah, errMsg, fmtDate } from '../utils'
import { Spinner, Empty, Badge, PageHeader } from '../ui'
import SalesChart from '../chart'

type ByStageRow = { stage?: string; name?: string; count?: number | string }

const sumStage = (byStage: ByStageRow[] = [], stages: string[]): number =>
  stages.reduce((a: number, s: string) => a + Number(byStage.find((x) => (x.stage ?? x.name) === s)?.count ?? 0), 0)

const shortName = (n: string | null | undefined): string => String(n ?? '').replace(/^uat\./i, '').split(' ')[0] || 'Sales'

const dayLabel = (iso: string | null | undefined): [string, string] => {
  if (!iso) return ['Tanpa Jadwal', 'b-gray']
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff <= 0) return ['Hari Ini', 'b-blue']
  if (diff === 1) return ['Besok', 'b-amber']
  if (diff === 2) return ['2 hari lagi', 'b-gray']
  return [fmtDate(iso), 'b-gray']
}

const DASHBOARD_QUOTES = [
  "Kesuksesan bukan kebetulan. Itu hasil dari kerja keras, konsistensi, dan komitmen terhadap tujuan yang kamu percaya.",
  "Disiplin hari ini adalah kebebasan di masa depan. Setiap usaha kecil yang konsisten akan berbuah besar pada waktunya.",
  "Profesional sejati tidak menunggu motivasi datang — mereka menciptakan progres bahkan di hari yang terasa berat.",
  "Target bulan ini adalah kesempatan untuk membuktikan pada dirimu sendiri seberapa jauh kamu bisa berkembang.",
  "Setiap penolakan adalah pelajaran, setiap keberhasilan adalah bukti — keduanya membentukmu jadi profesional yang lebih tangguh.",
  "Karier yang hebat dibangun dari hari-hari biasa yang dikerjakan dengan luar biasa.",
  "Kamu bukan sekadar menjalankan pekerjaan — kamu sedang membangun reputasi, pengalaman, dan masa depan yang kamu inginkan.",
  "Konsistensi mengalahkan intensitas. Progres kecil setiap hari lebih berarti daripada semangat sesaat.",
  "Cara terbaik menghargai waktu adalah dengan hasil kerja yang membuat dirimu sendiri bangga di akhir hari.",
  "Tim yang hebat bukan yang tidak pernah gagal, tapi yang terus bangkit dan belajar dari setiap tantangan.",
]

function MotivationQuote() {
  const [quote] = useState(() => {
    const today = new Date()
    const seed = today.getFullYear() * 137 + (today.getMonth() + 1) * 31 + today.getDate() * 17
    return DASHBOARD_QUOTES[Math.abs(seed) % DASHBOARD_QUOTES.length]
  })

  return (
    <div
      className="detail-stat-banner mb-3"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #eff6ff 100%)',
        border: '1px solid #e0f2fe',
        padding: '12px 18px',
        boxShadow: '0 1px 3px rgba(2, 132, 199, 0.05)',
      }}
    >
      <div className="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            color: '#0284c7',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(2, 132, 199, 0.1)',
          }}
        >
          <Quote size={18} strokeWidth={2.2} />
        </div>
        <div className="d-flex flex-column flex-grow-1 min-w-0" style={{ lineHeight: 1.35 }}>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="badge b-blue"
              style={{ fontSize: 9.5, padding: '2px 8px', letterSpacing: 0.5, fontWeight: 700 }}
            >
              INSPIRASI HARI INI
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#334155',
              fontStyle: 'italic',
              fontWeight: 500,
            }}
          >
            “{quote}”
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: ReactNode
  sub: ReactNode
  to?: string
  nav: (to: string) => void
}

function StatCard({ label, value, sub, to, nav }: StatCardProps) {
  return (
    <div className="col-6 col-xl-3">
      <div className="card shadow-sm h-100" onClick={() => to && nav(to)} style={to ? { cursor: 'pointer' } : undefined}>
        <div className="card-body">
          <div className="text-muted fw-bold text-uppercase" style={{ fontSize: 11 }}>{label}</div>
          <div className="fs-3 fw-bold mt-1">{value}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>{sub}</div>
        </div>
      </div>
    </div>
  )
}

interface QaItem {
  label: string
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number }>
  bg: string
  color: string
  to: string
}

interface QaGridProps {
  items: QaItem[]
  nav: (to: string) => void
}

function QaGrid({ items, nav }: QaGridProps) {
  return (
    <div className="qa-grid-card">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: 14 }}>
          Quick Access
        </h6>
        <span className="text-muted" style={{ fontSize: 12 }}>
          Akses cepat menu utama
        </span>
      </div>
      <div className="row row-cols-3 row-cols-md-6 g-2.5">
        {items.map((q: QaItem) => (
          <div className="col" key={q.to + q.label}>
            <button
              type="button"
              className="btn qa-tile"
              onClick={() => nav(q.to)}
            >
              <span className="qa-ic" style={{ background: q.bg, color: q.color }}>
                <q.icon size={22} strokeWidth={2} />
              </span>
              <span className="qa-label">{q.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SalesViewProps {
  data: DashboardBoard | null
  pipe: PipelineBoardRow[]
  tasks: FollowUp[]
  upcoming: FollowUp[]
  nav: NavigateFunction
  user: User | null
}

function SalesView({ data, pipe, tasks, upcoming, nav, user }: SalesViewProps) {
  const byStage: ByStageRow[] = (data?.byStage ?? []) as ByStageRow[]
  const countOf = (s: Stage): number => Number(pipe.find((x) => x.stage === s)?.count ?? 0)
  const funnelStages = [
    { label: 'Prospect', count: countOf('NEW') + countOf('FOLLOW_UP') + countOf('OPPORTUNITY'), color: '#1d4ed8', width: '100%', clip: 'polygon(0 0, 100% 0, 91% 100%, 9% 100%)', to: '/prospects' },
    { label: 'Quotation', count: countOf('QUOTATION'), color: '#0284c7', width: '82%', clip: 'polygon(0 0, 100% 0, 89% 100%, 11% 100%)', to: '/prospects?stage=QUOTATION' },
    { label: 'Negotiation', count: countOf('NEGOTIATION'), color: '#0d9488', width: '64%', clip: 'polygon(0 0, 100% 0, 86% 100%, 14% 100%)', to: '/prospects?stage=NEGOTIATION' },
    { label: 'Booking', count: countOf('CLOSING'), color: '#65a30d', width: '48%', clip: 'polygon(0 0, 100% 0, 82% 100%, 18% 100%)', to: '/prospects?stage=CLOSING' },
    { label: 'Won', count: countOf('WON'), color: '#ea580c', width: '34%', clip: 'none', to: '/prospects?stage=WON' },
  ]
  const allTasks = [...tasks, ...upcoming.filter((u: FollowUp) => !tasks.some((t: FollowUp) => t.id === u.id))].slice(0, 6)
  return (
    <>
      <PageHeader
        title="Dashboard Sales"
        subtitle={`Selamat datang, ${shortName(user?.name)} (Sales)`}
        actions={<button className="btn btn-primary btn-sm" onClick={() => nav('/prospects')}><Plus size={14} /> Tambah Prospek</button>}
      />
      <MotivationQuote />
      <div className="row g-3 mb-3">
        <StatCard label="My Quotation" value={sumStage(byStage, ['QUOTATION', 'NEGOTIATION', 'CLOSING'])} sub={`${data?.activeProspect ?? 0} prospek aktif`} to="/pipeline" nav={nav} />
        <StatCard label="Booking Confirmed" value={countOf('WON')} sub="Deal menang" to="/prospects?stage=WON" nav={nav} />
        <StatCard label="Deal Value" value={rupiah(data?.closingValue)} sub={`Potensi ${rupiah(data?.potentialValue)}`} to="/reports/performance" nav={nav} />
        <StatCard label="Follow-Up Hari Ini" value={data?.followUpsToday ?? 0} sub={`${data?.followUpsOverdue ?? 0} terlambat`} to="/follow-ups?mode=today" nav={nav} />
      </div>
      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-bold mb-3">My Sales Pipeline</h6>
              {pipe.length === 0 && <Empty text="Belum ada data pipeline." />}
              {funnelStages.map((st) => (
                <div key={st.label} className="d-flex align-items-center gap-2 mb-1" onClick={() => nav(st.to)} style={{ cursor: 'pointer' }}>
                  <div className="flex-grow-1 d-flex justify-content-center">
                    <div className="d-flex justify-content-center align-items-center text-center text-white fw-semibold px-3 py-2" style={{ backgroundColor: st.color, width: st.width, clipPath: st.clip, fontSize: 13 }}>
                      <span>{st.label}</span>
                    </div>
                  </div>
                  <b style={{ width: 30, textAlign: 'right' }}>{st.count}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-bold mb-0">My Task</h6>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => nav('/follow-ups')}>Lihat Semua</button>
              </div>
              {allTasks.length === 0 && <Empty text="Tidak ada tugas follow-up aktif." action={<button className="btn btn-primary btn-sm" onClick={() => nav('/follow-ups')}>Jadwalkan FU</button>} />}
              <ul className="list-group list-group-flush">
                {allTasks.map((t: FollowUp) => {
                  const [lbl] = dayLabel(t.scheduledAt)
                  return (
                    <li key={t.id} className="list-group-item d-flex gap-2 align-items-start px-0" onClick={() => (t.prospectId ? nav(`/prospects/${t.prospectId}`) : nav('/follow-ups'))} style={{ cursor: 'pointer' }}>
                      <span className="task-check mt-1" />
                      <span className="flex-grow-1">{t.description || t.prospectName || 'Follow up prospek'}</span>
                      <small className="text-muted text-nowrap">{lbl}</small>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <QaGrid nav={nav} items={[
        { label: 'Tambah Prospek', icon: Plus, bg: '#eff6ff', color: '#0284c7', to: '/prospects' },
        { label: 'My Pipeline', icon: GitBranch, bg: '#f5f3ff', color: '#7c3aed', to: '/pipeline' },
        { label: 'Customer', icon: Users, bg: '#ecfdf5', color: '#16a34a', to: '/customers' },
        { label: 'Follow Up', icon: CalendarClock, bg: '#fffbeb', color: '#d97706', to: '/follow-ups' },
        { label: 'Target Saya', icon: TargetIcon, bg: '#ecfeff', color: '#0891b2', to: '/targets' },
        { label: 'Laporan', icon: BarChart3, bg: '#eef2ff', color: '#4f46e5', to: '/reports/performance' },
      ]} />
    </>
  )
}

interface AdminViewProps {
  data: DashboardBoard | null
  tops: Customer[]
  nav: NavigateFunction
  user: User | null
}

function AdminView({ data, tops, nav, user }: AdminViewProps) {
  const byStage: ByStageRow[] = (data?.byStage ?? []) as ByStageRow[]
  const overdue = Number(data?.followUpsOverdue ?? 0)
  return (
    <>
      <PageHeader
        title="Dashboard Overview"
        subtitle={`Selamat datang, ${shortName(user?.name)} (Admin)`}
        actions={<button className="btn btn-primary btn-sm" onClick={() => nav('/prospects')}><Plus size={14} /> Tambah Prospek</button>}
      />
      {overdue > 0 && (
        <div className="alert alert-warning d-flex gap-2 align-items-center" role="alert">
          <AlertTriangle size={16} />
          <span className="flex-grow-1">Ada {overdue} follow-up terlambat. Segera tindak lanjuti.</span>
          <button className="btn btn-primary btn-sm" onClick={() => nav('/follow-ups?mode=overdue')}>Tinjau Sekarang <ArrowRight size={13} /></button>
        </div>
      )}
      <div className="row g-3 mb-3">
        <StatCard label="Total Quotation" value={sumStage(byStage, ['QUOTATION', 'NEGOTIATION', 'CLOSING'])} sub={`${data?.activeProspect ?? 0} prospek aktif`} to="/pipeline" nav={nav} />
        <StatCard label="Booking Confirmed" value={sumStage(byStage, ['WON'])} sub="Deal menang" to="/prospects?stage=WON" nav={nav} />
        <StatCard label="Revenue (YTD)" value={rupiah(data?.closingValue)} sub={`Potensi ${rupiah(data?.potentialValue)}`} to="/reports/performance" nav={nav} />
        <StatCard label="Prospek Aktif" value={data?.activeProspect ?? 0} sub={`${data?.followUpsToday ?? 0} follow-up hari ini`} to="/prospects" nav={nav} />
      </div>
      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Sales Performance (12 Bulan)</h6>
              <SalesChart />
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Top Customer</h6>
              {tops.length === 0 && <Empty text="Belum ada data customer." />}
              {tops.length > 0 && (
                <table className="table-clean mb-2">
                  <tbody>
                    {tops.slice(0, 5).map((c: Customer, i: number) => (
                      <tr key={c.id}>
                        <td className="text-muted fw-bold" style={{ width: 32 }}>{i + 1}.</td>
                        <td>
                          <div className="fw-semibold" style={{ fontSize: 13 }}>{c.accountName}</div>
                          <small className="text-muted">{[c.city, c.phone].filter(Boolean).join(' • ') || '—'}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button className="btn btn-outline-secondary btn-sm" onClick={() => nav('/customers')}>Lihat Semua</button>
            </div>
          </div>
        </div>
      </div>
      <QaGrid nav={nav} items={[
        { label: 'Tambah Prospek', icon: Plus, bg: '#eff6ff', color: '#0284c7', to: '/prospects' },
        { label: 'Pipeline', icon: GitBranch, bg: '#f5f3ff', color: '#7c3aed', to: '/pipeline' },
        { label: 'Customer', icon: UserCheck, bg: '#ecfdf5', color: '#16a34a', to: '/customers' },
        { label: 'Follow Up', icon: CalendarClock, bg: '#fffbeb', color: '#d97706', to: '/follow-ups' },
        { label: 'Target', icon: TargetIcon, bg: '#ecfeff', color: '#0891b2', to: '/targets' },
        { label: 'Laporan', icon: BarChart3, bg: '#eef2ff', color: '#4f46e5', to: '/reports/performance' },
      ]} />
    </>
  )
}

interface BillingViewProps {
  rows: Prospect[]
  total: number
  nav: NavigateFunction
  user: User | null
}

function BillingView({ rows, total, nav, user }: BillingViewProps) {
  const byPay = (s: PaymentStatusValue): Prospect[] => rows.filter((r: Prospect) => r.paymentStatus === s)
  const tanpa = rows.filter((r: Prospect) => !r.paymentStatus)
  const perlu = [...byPay('INVOICE'), ...byPay('TERTAGIH')]
  const lunas = byPay('LUNAS').length
  const belum = byPay('BELUM_DITAGIH').length
  const overdue = byPay('OVERDUE').length
  const perhatian = [...byPay('OVERDUE'), ...byPay('TERTAGIH'), ...byPay('INVOICE')]
    .sort((a, b) => Number(b.potentialValue ?? 0) - Number(a.potentialValue ?? 0))
    .slice(0, 8)
  const dist: Array<[string, number, string]> = [
    ['Perlu Ditagih', perlu.length, '#f59e0b'],
    ['Lunas', lunas, '#22c55e'],
    ['Belum Ditagih', belum, '#64748b'],
    ['Overdue', overdue, '#ef4444'],
    ['Tanpa Status', tanpa.length, '#cbd5e1'],
  ]
  const maxDist = Math.max(1, ...dist.map(([, v]) => v))
  return (
    <>
      <PageHeader
        title="Dashboard Billing"
        subtitle={`Selamat datang, ${shortName(user?.name)} (Billing)`}
        actions={<button className="btn btn-primary btn-sm" onClick={() => nav('/prospects')}><Plus size={14} /> Tambah Prospek</button>}
      />
      <MotivationQuote />
      {total > rows.length && (
        <div className="alert alert-warning" role="alert">Menampilkan {rows.length} dari {total} prospek won (100 data terbaru).</div>
      )}
      <div className="row g-3 mb-3">
        <StatCard label="Perlu Ditagih" value={perlu.length} sub="Invoice + tertagih" to="/prospects" nav={nav} />
        <StatCard label="Lunas" value={lunas} sub="Pembayaran selesai" to="/prospects" nav={nav} />
        <StatCard label="Belum Ditagih" value={belum} sub="Menunggu invoice" to="/prospects" nav={nav} />
        <StatCard label="Overdue" value={overdue} sub="Butuh perhatian" to="/prospects" nav={nav} />
      </div>
      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Status Pembayaran</h6>
              {dist.map(([l, v, c]) => (
                <div key={l} className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: 13 }}>
                  <span style={{ width: 110 }}>{l}</span>
                  <div className="progress flex-grow-1" style={{ height: 10 }}>
                    <div className="progress-bar" role="progressbar" style={{ width: `${(v / maxDist) * 100}%`, backgroundColor: c }} aria-valuenow={v} aria-valuemin={0} aria-valuemax={maxDist} />
                  </div>
                  <b style={{ width: 34, textAlign: 'right' }}>{v}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Perlu Perhatian</h6>
              {perhatian.length === 0 && <Empty text="Tidak ada tagihan yang perlu perhatian." />}
                <div className="table-responsive">
                  <table className="table-clean mb-0">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Nilai</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {perhatian.map((p: Prospect) => (
                        <tr key={p.id}>
                          <td>
                            <div className="fw-semibold text-dark" style={{ fontSize: 13 }}>{p.accountName}</div>
                            <small className="text-muted">{p.city ?? '—'}</small>
                          </td>
                          <td className="tabular text-end fw-semibold text-dark">{rupiah(p.potentialValue)}</td>
                          <td><Badge value={p.paymentStatus} /></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
                              onClick={() => nav(`/prospects/${p.id}`)}
                            >
                              Buka
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
          </div>
        </div>
      </div>
      <QaGrid nav={nav} items={[
        { label: 'Prospek', icon: FileText, bg: '#eff6ff', color: '#0284c7', to: '/prospects' },
        { label: 'Pipeline', icon: GitBranch, bg: '#f5f3ff', color: '#7c3aed', to: '/pipeline' },
        { label: 'Customer', icon: UserCheck, bg: '#ecfdf5', color: '#16a34a', to: '/customers' },
        { label: 'Follow Up', icon: CalendarClock, bg: '#fffbeb', color: '#d97706', to: '/follow-ups' },
        { label: 'Laporan', icon: BarChart3, bg: '#eef2ff', color: '#4f46e5', to: '/reports/performance' },
        { label: 'Import / Export', icon: ArrowDownUp, bg: '#f0fdfa', color: '#0d9488', to: '/import-export' },
      ]} />
    </>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [data, setData] = useState<DashboardBoard | null>(null)
  const [pipe, setPipe] = useState<PipelineBoardRow[]>([])
  const [tasks, setTasks] = useState<FollowUp[]>([])
  const [upcoming, setUpcoming] = useState<FollowUp[]>([])
  const [tops, setTops] = useState<Customer[]>([])
  const [billRows, setBillRows] = useState<Prospect[]>([])
  const [billTotal, setBillTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const role = user?.role ?? 'SALES'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (role === 'BILLING') {
          // Billing hanya menagih deal yang sudah Won — prospek pipeline
          // (NEW..CLOSING) belum ada piutangnya dan tidak ikut dihitung.
          const r = await prospectApi.list({ stage: 'WON', pageSize: 100, sort: 'updatedAt:desc' })
          // Data lama: Won yang belum pernah di-update pembayarannya masih
          // berstatus null. Anggap sebagai BELUM_DITAGIH agar tidak hilang
          // dari hitungan (backend baru sudah default-kan saat Won).
          setBillRows(r.rows.map((p) => (p.paymentStatus ? p : { ...p, paymentStatus: 'BELUM_DITAGIH' as const })))
          setBillTotal(r.total)
        } else if (role === 'ADMIN') {
          const [d, c] = await Promise.allSettled([dashApi.board(), customerApi.list({ pageSize: 5 })])
          if (d.status === 'fulfilled') setData(d.value)
          else toast.error(errMsg(d.reason, 'Gagal memuat dashboard.'))
          if (c.status === 'fulfilled') setTops(c.value.rows ?? [])
        } else {
          const [d, p, f, u] = await Promise.allSettled([
            dashApi.board(), dashApi.pipeline({}),
            fuApi.list({ mode: 'today', pageSize: 6 }), fuApi.list({ mode: 'upcoming', pageSize: 6 }),
          ])
          if (d.status === 'fulfilled') setData(d.value)
          else toast.error(errMsg(d.reason, 'Gagal memuat dashboard.'))
          const pv: PipelineBoardRow[] = p.status === 'fulfilled' ? (p.value ?? []) : []
          setPipe(Array.isArray(pv) ? pv : [])
          if (f.status === 'fulfilled') setTasks(f.value.rows ?? [])
          if (u.status === 'fulfilled') setUpcoming(u.value.rows ?? [])
        }
      } catch (e) {
        toast.error(errMsg(e, 'Gagal memuat dashboard.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [role])

  if (loading) {
    return (
      <Layout title="Dashboard">
        <Spinner />
      </Layout>
    )
  }

  if (role === 'BILLING') return <Layout title="Dashboard Billing"><BillingView rows={billRows} total={billTotal} nav={nav} user={user} /></Layout>
  if (role === 'SALES') return <Layout title="Dashboard Sales"><SalesView data={data} pipe={pipe} tasks={tasks} upcoming={upcoming} nav={nav} user={user} /></Layout>
  return <Layout title="Dashboard Overview"><AdminView data={data} tops={tops} nav={nav} user={user} /></Layout>
}
