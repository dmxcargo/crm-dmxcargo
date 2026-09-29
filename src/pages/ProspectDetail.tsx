import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../layout'
import {
  Pencil, Plus, CalendarPlus, CheckCircle2, XCircle, Check, X,
  UserPlus, Trash2, Archive, ArchiveRestore, Phone, MessageSquare,
  MapPin, Mail, Users, FileText, ArrowRight, Clock, ChevronDown,
  PhoneCall, PhoneOff, UserCheck, UserX, Calendar, GitCommit, User as UserIcon,
} from 'lucide-react'
import { prospectApi, dealApi, masterApi, userApi } from '../api/resources'
import type { AddActivityPayload, DealWonPayload } from '../api/resources'
import { useAuth, useConfirm, useToast } from '../store/app'
import { rupiah, fmtDate, fmtDateTime, errMsg, STAGE_LABEL, ACT_TYPES, isStaff, parseRupiah, FU_PRIORITIES } from '../utils'
import { Badge, Empty, Spinner, Modal, Field, RupiahInput, DetailHeader } from '../ui'
import FormAlert from '../components/FormAlert'
import { resolveActorName } from '../lib/actorName'
import { validateActivity, validateAssign, validateContact, validateLost, validateSchedule, validateWon } from '../hooks/useDetailForms'
import { backendFieldErrors } from '../lib/formErrors'
import { ProspectModal } from './Prospects'
import type {
  Prospect, ProspectContact, Deal, Customer, Activity, ActivityType,
  StageHistoryEntry, MasterItem, User, Stage, FollowUpPriority,
  Attendance, Completion, PaymentStatusValue,
} from '../types'

// Stage tujuan yang valid melalui endpoint /prospects/{id}/stage.
// WON/LOST hanya bisa dicapai lewat aksi Deal (Mark Won/Lost); MAINTENANCE hanya dari WON.
// Lihat backend: App\Sales\Domain\StageTransition::can().
const nextStageOptions = (from: Stage, privileged: boolean): Stage[] => {
  const order: Stage[] = ['NEW', 'FOLLOW_UP', 'OPPORTUNITY', 'QUOTATION', 'NEGOTIATION', 'CLOSING']
  if (from === 'WON' || from === 'LOST') {
    return privileged ? ['FOLLOW_UP'] : []
  }
  const idx = order.indexOf(from)
  return idx === -1 ? [] : order.slice(idx + 1)
}

type PayHistEntry = { fromStatus?: string; toStatus?: string; createdAt: string }

const TABS: Array<[string, string]> = [['timeline', 'Timeline'], ['deal', 'Deal'], ['kontak', 'Kontak'], ['riwayat', 'Stage History']]

const fmtTimeOnly = (s?: string | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} WIB`
}

export default function ProspectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const staff = isStaff(user)
  const [p, setP] = useState<Prospect | null>(null)
  const [tab, setTab] = useState<string>('timeline')
  const [acts, setActs] = useState<Activity[]>([])
  const [actFilter, setActFilter] = useState<string>('ALL')
  const [actLimit, setActLimit] = useState<number>(5)
  const [deals, setDeals] = useState<Deal[]>([])
  const [hist, setHist] = useState<StageHistoryEntry[]>([])
  const [payHist, setPayHist] = useState<PayHistEntry[]>([])
  const [reasons, setReasons] = useState<MasterItem[]>([])
  const [sources, setSources] = useState<MasterItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [dlg, setDlg] = useState<string | null>(null)
  const [target, setTarget] = useState<string>('')
  const [missing, setMissing] = useState<boolean>(false)

  const load = async (): Promise<void> => {
    if (!id) { setMissing(true); return }
    try {
      const d: Prospect = await prospectApi.get(id)
      setP(d)
      const [a, dl, h] = await Promise.allSettled([prospectApi.activities(id), prospectApi.deals(id), prospectApi.stageHistory(id)])
      if (a.status === 'fulfilled') setActs(a.value)
      const dlArr: Deal[] = dl.status === 'fulfilled' ? dl.value : []
      setDeals(dlArr)
      if (h.status === 'fulfilled') setHist(h.value)
      const open = dlArr.find((x) => x.status === 'OPEN')
      if (open) {
        dealApi.paymentHistory(open.id).then((r) => setPayHist(r)).catch(() => {
          setPayHist([])
          toast.warning('Riwayat pembayaran gagal dimuat. Detail deal tetap tampil.')
        })
      } else setPayHist([])
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err?.response?.status === 404) setMissing(true)
      else toast.error(errMsg(e, 'Gagal memuat detail prospek.'))
    }
  }
  useEffect(() => {
    void load()
    masterApi.reasons().then((r) => setReasons(r)).catch(() => { })
    masterApi.sources().then((s) => setSources(s)).catch(() => { })
    userApi.list({ pageSize: 100 }).then((u) => setUsers(u.rows)).catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const run = async (title: string, message: string, fn: () => Promise<unknown>, okMsg: string, danger?: boolean): Promise<void> => {
    const ok = await confirm({ title, message, confirmLabel: 'Ya, Lanjutkan', danger })
    if (!ok) return
    try { await fn(); toast.success(okMsg); void load() }
    catch (e: unknown) { toast.error(errMsg(e, 'Aksi gagal diproses.')) }
  }
  const erase = async (): Promise<void> => {
    if (!p) return
    const ok = await confirm({ title: 'Hapus Prospek', message: `Hapus prospek "${p.accountName}"? Data masih tersimpan sebagai soft-delete.`, confirmLabel: 'Ya, Hapus', danger: true })
    if (!ok) return
    try { await prospectApi.remove(p.id); toast.success('Prospek berhasil dihapus.'); nav('/prospects') }
    catch (e: unknown) { toast.error(errMsg(e, 'Gagal menghapus prospek.')) }
  }
  const archivate = async (): Promise<void> => {
    if (!p) return
    const to = !p.archived
    const ok = await confirm({ title: to ? 'Arsipkan Prospek' : 'Buka Arsip', message: `${to ? 'Arsipkan' : 'Kembalikan'} prospek "${p.accountName}"?`, confirmLabel: 'Ya, Lanjutkan' })
    if (!ok) return
    try { await prospectApi.archive(p.id, to); toast.success(to ? 'Prospek berhasil diarsipkan.' : 'Prospek berhasil dikembalikan.'); void load() }
    catch (e: unknown) { toast.error(errMsg(e, 'Gagal mengarsipkan prospek.')) }
  }
  const fmtDur = (s?: number | null): string => {
    if (s === undefined || s === null) return '—'
    if (s <= 0) return '< 1 mnt'
    const m = Math.round(s / 60)
    if (m < 1) return '< 1 mnt'
    if (m < 60) return `${m} mnt`
    const h = Math.floor(m / 60)
    return h < 24 ? `${h} jam ${m % 60} mnt` : `${Math.floor(h / 24)} hari`
  }

  if (missing) return <Layout title="Detail Prospek"><div className="card shadow-sm"><div className="card-body"><Empty text="Prospek tidak ditemukan. Mungkin sudah dihapus atau di luar akses Anda." action={<button className="btn btn-outline-secondary btn-sm" onClick={() => nav('/prospects')}>Kembali ke Daftar</button>} /></div></div></Layout>
  if (!p) return <Layout title="Detail Prospek"><Spinner /></Layout>
  const openDeal = deals.find((d) => d.status === 'OPEN')

  return (
    <Layout title={p.accountName}>
      <DetailHeader
        category="Prospek"
        title={p.accountName}
        onBack={() => nav('/prospects')}
        actions={
          <>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setDlg('edit')}><Pencil size={14} /> Ubah</button>
            <button className="btn btn-primary btn-sm" onClick={() => setDlg('fu')}><CalendarPlus size={14} /> Jadwalkan FU</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => void archivate()}>{p.archived ? <><ArchiveRestore size={14} /> Buka Arsip</> : <><Archive size={14} /> Arsipkan</>}</button>
            {(staff || p.ownerUserId === user?.id) && <button className="btn btn-danger btn-sm" onClick={() => void erase()}><Trash2 size={14} /> Hapus</button>}
          </>
        }
      />

      {/* ── 3-Column Master Summary Card (Reference Style) ─────────────── */}
      <div className="detail-summary-card">
        <div className="row g-4">
          {/* Column 1: Waktu & Lokasi */}
          <div className="col-12 col-md-4">
            <div className="detail-info-row">
              <span className="detail-info-label">Tanggal Entry</span>
              <span className="detail-info-val">{fmtDate(p.entryDate)}</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Next Follow-Up</span>
              <span className="detail-info-val text-primary tabular">
                {p.nextFollowUpAt ? fmtDateTime(p.nextFollowUpAt) : '—'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Kota / Wilayah</span>
              <span className="detail-info-val">
                {[p.city, p.province].filter(Boolean).join(', ') || '—'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Nilai Potensi</span>
              <span className="detail-info-val tbl-link">
                {rupiah(p.potentialValue)}
              </span>
            </div>
          </div>

          {/* Column 2: Status & Progres */}
          <div className="col-12 col-md-4 border-start border-end">
            <div className="detail-info-row">
              <span className="detail-info-label">Stage Prospek</span>
              <span className="detail-info-val">
                <Badge value={p.stage} />
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Priority</span>
              <span className="detail-info-val">
                <Badge value={p.priority} />
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Tipe Customer</span>
              <span className="detail-info-val">
                <span className="chip-f">{p.customerType ?? 'B2B'}</span>
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Progress</span>
              <span className="detail-info-val text-truncate" title={p.lastProgress ?? ''}>
                {p.lastProgress ?? '—'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Sales Pemegang</span>
              <span className="detail-info-val text-truncate" title={resolveActorName(p.ownerUserId, user, users, '—', '—').replace(' (Anda)', '')}>
                {resolveActorName(p.ownerUserId, user, users, '—', '—')}
              </span>
            </div>
          </div>

          {/* Column 3: Kontak PIC & Catatan */}
          <div className="col-12 col-md-4">
            <div className="detail-info-row">
              <span className="detail-info-label">PIC Utama</span>
              <span className="detail-info-val tbl-link">
                {p.picName ? `${p.picName} ${p.picPosition ? `(${p.picPosition})` : ''}` : '—'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">No. WhatsApp</span>
              <span className="detail-info-val tabular text-primary">
                {p.phone || '—'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Email</span>
              <span className="detail-info-val text-truncate">
                {p.email || '—'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-label">Catatan</span>
              <span className="detail-info-val text-muted small text-truncate">
                {p.notes || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stage Transition Bar */}
        <div
          className="d-flex align-items-center gap-2 pt-3 mt-3 flex-wrap"
          style={{ borderTop: '1px solid #f1f5f9' }}
        >
          <span className="text-secondary fw-semibold small text-uppercase me-2" style={{ letterSpacing: 0.5 }}>
            Update Stage:
          </span>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', minWidth: 180 }}
            value={target}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setTarget(e.target.value)}
          >
            <option value="">— Pilih Stage Tujuan —</option>
            {nextStageOptions(p.stage, staff).map((s) => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={nextStageOptions(p.stage, staff).length === 0}
            onClick={() => {
              if (!target) { toast.warning('Pilih stage tujuan terlebih dahulu.'); return }
              void run('Pindah Stage', `Pindahkan ke ${STAGE_LABEL[target as Stage] ?? target}?`, () => prospectApi.stage(p.id, target as Stage, p.version), 'Stage berhasil diperbarui.')
            }}
          >
            Pindah Stage
          </button>
          {staff && (p.stage === 'WON' || p.stage === 'LOST') && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => void run('Buka Kembali', 'Kembalikan prospek ke Follow Up?', () => prospectApi.stage(p.id, 'FOLLOW_UP', p.version), 'Prospek berhasil dibuka kembali.')}
            >
              Buka Kembali
            </button>
          )}
          {staff && (
            <button type="button" className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => setDlg('assign')}>
              <UserPlus size={14} /> Assign Sales
            </button>
          )}
        </div>
      </div>

      {/* ── SEGMENTED PILL NAVIGATION (Website Signature Design) ── */}
      <div className="detail-nav-pills mt-4 mb-3">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={`detail-nav-pill-btn ${tab === v ? 'active' : ''}`}
            onClick={() => setTab(v)}
          >
            {l}
            {v === 'timeline' && acts.length > 0 && (
              <span className={`badge ms-1.5 ${tab === v ? 'bg-white text-primary' : 'bg-light text-secondary border'}`}>
                {acts.length}
              </span>
            )}
            {v === 'deal' && deals.length > 0 && (
              <span className={`badge ms-1.5 ${tab === v ? 'bg-white text-primary' : 'bg-light text-secondary border'}`}>
                {deals.length}
              </span>
            )}
            {v === 'kontak' && (p.contacts?.length ?? 0) > 0 && (
              <span className={`badge ms-1.5 ${tab === v ? 'bg-white text-primary' : 'bg-light text-secondary border'}`}>
                {p.contacts?.length}
              </span>
            )}
            {v === 'riwayat' && hist.length > 0 && (
              <span className={`badge ms-1.5 ${tab === v ? 'bg-white text-primary' : 'bg-light text-secondary border'}`}>
                {hist.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body p-4">
          {/* TAB 1: TIMELINE (MODERN ACTIVITY STREAM) */}
          {tab === 'timeline' && (
            <div>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 pb-2 border-bottom">
                <div>
                  <h6 className="fw-bold text-dark mb-0">Linimasa Aktivitas</h6>
                  <small className="text-muted">Riwayat interaksi sales, panggilan, pertemuan, dan catatan prospek.</small>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1.5"
                  style={{ borderRadius: 8, padding: '7px 15px', fontWeight: 600 }}
                  onClick={() => setDlg('act')}
                >
                  <Plus size={14} /> Tambah Aktivitas
                </button>
              </div>

              {acts.length === 0 ? (
                <Empty
                  text="Belum ada aktivitas tercatat. Mulai catat panggilan, WhatsApp, atau kunjungan langsung."
                  action={
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setDlg('act')}
                    >
                      <Plus size={14} className="me-1" /> Tambah Aktivitas Pertama
                    </button>
                  }
                />
              ) : (
                <div className="act-timeline-container">
                  {/* 1. Quick Filter Bar */}
                  <div className="act-filter-bar">
                    {[
                      { key: 'ALL', label: 'Semua', count: acts.length },
                      { key: 'CALL', label: 'Panggilan', icon: Phone, count: acts.filter((a) => a.type === 'CALL').length },
                      { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare, count: acts.filter((a) => a.type === 'WHATSAPP').length },
                      { key: 'VISIT', label: 'Kunjungan', icon: MapPin, count: acts.filter((a) => a.type === 'VISIT').length },
                      { key: 'MEETING', label: 'Meeting', icon: Users, count: acts.filter((a) => a.type === 'MEETING').length },
                      { key: 'EMAIL', label: 'Email', icon: Mail, count: acts.filter((a) => a.type === 'EMAIL').length },
                      { key: 'NOTE', label: 'Catatan', icon: FileText, count: acts.filter((a) => a.type === 'NOTE').length },
                    ]
                      .filter((f) => f.key === 'ALL' || f.count > 0)
                      .map((f) => {
                        const active = actFilter === f.key
                        const Icon = f.icon
                        return (
                          <button
                            key={f.key}
                            type="button"
                            className={`act-filter-btn ${active ? 'active' : ''}`}
                            onClick={() => {
                              setActFilter(f.key)
                              setActLimit(5)
                            }}
                          >
                            {Icon && <Icon size={12} />}
                            <span>{f.label}</span>
                            <span className="act-filter-count">{f.count}</span>
                          </button>
                        )
                      })}
                  </div>

                  {/* 2. Grouped Cards per Date (Multi-Step Unified) */}
                  {(() => {
                    const filteredActs = acts.filter((a) => actFilter === 'ALL' || a.type === actFilter)
                    if (filteredActs.length === 0) {
                      return (
                        <div className="p-4 text-center text-muted bg-white rounded-3 border">
                          Tidak ada aktivitas untuk kategori filter ini.
                        </div>
                      )
                    }

                    const visibleActs = filteredActs.slice(0, actLimit)
                    const grouped = visibleActs.reduce((acc, a) => {
                      const dt = a.activityAt ?? a.createdAt
                      const dateKey = dt ? fmtDate(dt) : 'Tanggal Tidak Tercatat'
                      if (!acc[dateKey]) acc[dateKey] = []
                      acc[dateKey].push(a)
                      return acc
                    }, {} as Record<string, Activity[]>)

                    return (
                      <>
                        {Object.entries(grouped).map(([dateKey, dateActs]) => {
                          const salesOwner = users.find((u) => u.id === p?.ownerUserId)
                            ?? (user?.id === p?.ownerUserId && user?.name ? user : undefined)

                          return (
                            <div className="act-session-group" key={dateKey}>
                              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                <div className="act-session-date-header">
                                  <Calendar size={16} className="text-teal" />
                                  <span>{dateKey}</span>
                                  <span className="badge b-gray ms-1" style={{ fontSize: 11 }}>
                                    {dateActs.length} Aktivitas
                                  </span>
                                </div>
                                {salesOwner && (
                                  <span className="text-muted d-inline-flex align-items-center gap-1.5" style={{ fontSize: 12 }}>
                                    <UserIcon size={13} /> PIC: <strong className="text-dark">{salesOwner.name}</strong>
                                  </span>
                                )}
                              </div>

                              {/* Single Connected Card for this Date */}
                              <div className="act-route-card">
                                {/* Header Bar with Unique Type Pills & Quick Action Icons */}
                                <div className="act-route-header">
                                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                    {Array.from(new Set(dateActs.map((x) => x.type))).map((t) => (
                                      <span key={t} className={`act-pill-badge act-pill-${t}`}>
                                        {t}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="act-quick-actions">
                                    {p?.phone && (
                                      <>
                                        <a
                                          href={`tel:${p.phone}`}
                                          className="act-quick-btn btn-call"
                                          title={`Telepon: ${p.phone}`}
                                        >
                                          <Phone size={14} />
                                        </a>
                                        <a
                                          href={`https://wa.me/${p.phone.replace(/\D/g, '')}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="act-quick-btn btn-wa"
                                          title={`Chat WhatsApp: ${p.phone}`}
                                        >
                                          <MessageSquare size={14} />
                                        </a>
                                      </>
                                    )}
                                    {(p?.city || p?.province) && (
                                      <span
                                        className="act-quick-btn btn-map"
                                        title={`Lokasi: ${[p?.city, p?.province].filter(Boolean).join(', ')}`}
                                      >
                                        <MapPin size={14} />
                                      </span>
                                    )}
                                    {p?.picName && (
                                      <span
                                        className="act-quick-btn"
                                        title={`Kontak PIC: ${p.picName}`}
                                      >
                                        <UserIcon size={14} />
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Step Track for all Activities in this Date */}
                                <div className="act-steps-container">
                                  {dateActs.map((a, actIdx) => {
                                    const typeLabels: Record<string, string> = {
                                      CALL: 'Panggilan Telepon',
                                      WHATSAPP: 'WhatsApp Chat',
                                      VISIT: 'Kunjungan Lapangan',
                                      EMAIL: 'Email Korespondensi',
                                      MEETING: 'Meeting / Pertemuan',
                                      NOTE: 'Catatan Prospek',
                                    }

                                    let isSuccess = true
                                    let isDanger = false
                                    if (a.type === 'CALL') {
                                      if (a.answered === false) {
                                        isSuccess = false
                                        isDanger = true
                                      }
                                    } else if (a.type === 'VISIT') {
                                      if (a.attendance === 'TIDAK_HADIR' || a.completion === 'BATAL') {
                                        isSuccess = false
                                        isDanger = true
                                      }
                                    }

                                    const timeStr = fmtTimeOnly(a.activityAt ?? a.createdAt)
                                    const hasNext = Boolean(a.nextAction)
                                    const isLastAct = actIdx === dateActs.length - 1

                                    return (
                                      <div key={a.id} className={actIdx > 0 ? 'mt-2.5' : ''}>
                                        {/* Main Activity Step */}
                                        <div className="act-step-row">
                                          <div className="act-step-node-col">
                                            <div
                                              className={`act-step-circle ${isDanger
                                                  ? 'act-circle-danger'
                                                  : isSuccess
                                                    ? 'act-circle-success'
                                                    : 'act-circle-info'
                                                }`}
                                            >
                                              {isDanger ? (
                                                <X size={13} strokeWidth={3} />
                                              ) : (
                                                <Check size={13} strokeWidth={3} />
                                              )}
                                            </div>
                                            {(hasNext || !isLastAct) && (
                                              <div
                                                className={`act-step-dotted-line ${isDanger ? 'line-danger' : isSuccess ? '' : 'line-info'
                                                  }`}
                                              />
                                            )}
                                          </div>
                                          <div className="act-step-content-col">
                                            <div className="act-step-header">
                                              <span
                                                className={`act-step-time ${isDanger
                                                    ? 'time-danger'
                                                    : isSuccess
                                                      ? 'time-success'
                                                      : 'time-info'
                                                  }`}
                                              >
                                                {timeStr}
                                              </span>
                                              <span className="act-step-title">
                                                {typeLabels[a.type] || a.type}
                                                {p?.picName ? ` • ${p.picName}` : ''}
                                              </span>
                                              <div className="d-inline-flex align-items-center gap-1.5 ms-auto flex-wrap">
                                                {a.durationMinutes ? (
                                                  <span className="status-pill status-pill-muted tabular">
                                                    <Clock size={11} className="text-muted" />
                                                    <span>{a.durationMinutes} mnt</span>
                                                  </span>
                                                ) : null}
                                                {a.type === 'CALL' && a.answered !== undefined && (
                                                  <span className={`status-pill ${a.answered ? 'status-pill-success' : 'status-pill-danger'}`}>
                                                    {a.answered ? <PhoneCall size={11} /> : <PhoneOff size={11} />}
                                                    <span>{a.answered ? 'Dijawab' : 'Tidak Dijawab'}</span>
                                                  </span>
                                                )}
                                                {a.attendance && (
                                                  <span className={`status-pill ${a.attendance === 'HADIR' ? 'status-pill-success' : 'status-pill-danger'}`}>
                                                    {a.attendance === 'HADIR' ? <UserCheck size={11} /> : <UserX size={11} />}
                                                    <span>{a.attendance === 'HADIR' ? 'Hadir' : 'Tidak Hadir'}</span>
                                                  </span>
                                                )}
                                                {a.completion && (
                                                  <span className={`status-pill ${a.completion === 'SELESAI' ? 'status-pill-success' : 'status-pill-danger'}`}>
                                                    {a.completion === 'SELESAI' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                    <span>{a.completion === 'SELESAI' ? 'Selesai' : 'Batal'}</span>
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="act-step-desc">
                                              {a.notes || (
                                                <span className="text-muted fst-italic">
                                                  Tidak ada catatan rincian aktivitas.
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Next Action Sub-step (if present) */}
                                        {hasNext && (
                                          <div className="act-step-row mt-2">
                                            <div className="act-step-node-col">
                                              <div className="act-step-circle act-circle-info">
                                                <ArrowRight size={13} strokeWidth={2.5} />
                                              </div>
                                              {!isLastAct && (
                                                <div className="act-step-dotted-line line-info" />
                                              )}
                                            </div>
                                            <div className="act-step-content-col">
                                              <div className="act-step-header">
                                                <span className="act-step-time time-info">
                                                  Tindak Lanjut
                                                </span>
                                                <span className="act-step-title">{a.nextAction}</span>
                                              </div>
                                              {p?.nextFollowUpAt && (
                                                <div className="act-step-desc text-muted">
                                                  Target jadwal follow-up: {fmtDateTime(p.nextFollowUpAt)}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Divider between activities within the same day */}
                                        {!isLastAct && <div className="act-item-divider" />}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {/* 3. Load More / Pagination Controls */}
                        {filteredActs.length > actLimit && (
                          <div className="text-center mt-3 pt-2">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5"
                              style={{ borderRadius: 8, padding: '6px 18px', fontSize: 12.5 }}
                              onClick={() => setActLimit((prev) => prev + 5)}
                            >
                              <ChevronDown size={14} /> Tampilkan {Math.min(5, filteredActs.length - actLimit)} Aktivitas Sebelumnya
                              <span className="badge bg-secondary ms-1">{filteredActs.length - actLimit} tersisa</span>
                            </button>
                          </div>
                        )}
                        {actLimit > 5 && filteredActs.length > 5 && (
                          <div className="text-center mt-2">
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-decoration-none text-muted"
                              style={{ fontSize: 12 }}
                              onClick={() => setActLimit(5)}
                            >
                              Ciutkan kembali ke 5 aktivitas teranyar
                            </button>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DEAL */}
          {tab === 'deal' && (
            <div>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {!openDeal && (
                    <button
                      type="button"
                      className="btn-green-action"
                      onClick={() => setDlg('deal')}
                    >
                      <Plus size={14} /> Buat Deal Baru
                    </button>
                  )}
                  {openDeal && (
                    <div className="d-inline-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
                        onClick={() => setDlg('editDeal')}
                      >
                        <Pencil size={13} className="me-1" /> Ubah Deal
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm d-inline-flex align-items-center gap-1"
                        style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
                        onClick={() => setDlg('won')}
                      >
                        <CheckCircle2 size={14} /> Mark Won
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
                        style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
                        onClick={() => setDlg('lost')}
                      >
                        <XCircle size={14} /> Mark Lost
                      </button>
                      {staff && (
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
                          onClick={() => setDlg('pay')}
                        >
                          Update Pembayaran
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {deals.length === 0 ? (
                <Empty
                  text="Belum ada deal transaksi. Buat deal baru saat prospek siap masuk tahap penawaran / closing."
                  action={
                    <button
                      type="button"
                      className="btn-green-action"
                      onClick={() => setDlg('deal')}
                    >
                      <Plus size={14} /> Buat Deal Sekarang
                    </button>
                  }
                />
              ) : (
                <div className="table-card">
                  <div className="table-responsive">
                    <table className="table-clean">
                      <thead>
                        <tr>
                          <th>No. Deal</th>
                          <th>No. Quotation</th>
                          <th>Status</th>
                          <th className="text-end">Potensi</th>
                          <th className="text-end">Quotation</th>
                          <th className="text-end">Closing</th>
                          <th>Tgl Closing</th>
                          <th>Bayar</th>
                          <th>Alasan Lost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deals.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <span className="tbl-link">{d.dealNumber ?? d.id.slice(0, 8)}</span>
                            </td>
                            <td>
                              <span className="text-secondary tabular">{d.quotationNumber ?? '—'}</span>
                            </td>
                            <td>
                              <Badge value={d.status} />
                            </td>
                            <td className="tabular text-end">{rupiah(d.potentialValue)}</td>
                            <td className="tabular text-end">{rupiah(d.quotationValue)}</td>
                            <td className="tabular text-end fw-semibold text-dark">{rupiah(d.closingValue)}</td>
                            <td className="tabular text-secondary">{fmtDate(d.closingDate)}</td>
                            <td>
                              <Badge value={d.paymentStatus ?? 'BELUM_DITAGIH'} />
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {d.lostReasonCode
                                ? reasons.find((r) => r.code === d.lostReasonCode)?.label ?? d.lostReasonCode
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Riwayat Pembayaran */}
              {payHist.length > 0 && (
                <div className="mt-4 pt-3 border-top">
                  <h6 className="fw-bold text-dark mb-3">Riwayat Status Pembayaran</h6>
                  <div className="table-card">
                    <div className="table-responsive">
                      <table className="table-clean">
                        <thead>
                          <tr>
                            <th>Waktu Catat</th>
                            <th>Status Sebelumnya</th>
                            <th style={{ width: 30, textAlign: 'center' }}></th>
                            <th>Status Diperbarui</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payHist.map((h, i) => (
                            <tr key={i}>
                              <td className="tabular text-secondary" style={{ fontSize: 12.5 }}>
                                {fmtDateTime(h.createdAt)}
                              </td>
                              <td>
                                {h.fromStatus ? <Badge value={h.fromStatus} /> : <span className="text-muted">—</span>}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <ArrowRight size={13} className="text-muted" />
                              </td>
                              <td>
                                {h.toStatus ? <Badge value={h.toStatus} /> : <span className="text-muted">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: KONTAK */}
          {tab === 'kontak' && <ContactTab p={p} reload={() => void load()} />}

          {/* TAB 4: STAGE HISTORY (CLEAN PROGRESSION CARDS) */}
          {tab === 'riwayat' && (
            <div>
              <div className="mb-3">
                <h6 className="fw-bold text-dark mb-1">Riwayat Transisi Stage</h6>
                <small className="text-muted">Jejak perpindahan stage proses penjualan beserta durasi dan petugas yang memperbarui.</small>
              </div>

              {hist.length === 0 ? (
                <Empty text="Belum ada riwayat stage. Setiap perpindahan stage akan tercatat otomatis di sini." />
              ) : (
                <div>
                  {hist.map((h, i) => {
                    const actorName = resolveActorName(h.actorUserId, user, users)
                    return (
                      <div className="modern-stage-card" key={i}>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <div className="modern-stage-icon-node" title="Perubahan Stage">
                            <GitCommit size={15} />
                          </div>
                          <Badge value={h.fromStage ? (STAGE_LABEL[h.fromStage] ?? h.fromStage) : 'NEW'} />
                          <ArrowRight size={14} className="text-muted" />
                          <Badge value={STAGE_LABEL[h.toStage] ?? h.toStage} />
                          <span className="status-pill status-pill-muted tabular">
                            <Clock size={12} className="text-muted" />
                            <span>Durasi: {fmtDur(h.durationSeconds)}</span>
                          </span>
                        </div>

                        <div className="d-flex align-items-center gap-3 text-secondary small flex-wrap">
                          <span className="d-flex align-items-center gap-1.5" style={{ fontSize: 12.5 }}>
                            <UserIcon size={13} className="text-muted" />
                            <span>Oleh: <b className="text-dark">{actorName}</b></span>
                          </span>
                          <span className="tabular text-secondary d-flex align-items-center gap-1" style={{ fontSize: 12 }}>
                            <Clock size={12} className="text-muted" />
                            <span>{fmtDateTime(h.createdAt)}</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {dlg === 'edit' && <ProspectModal initial={p} sources={sources} onClose={() => setDlg(null)} onSaved={() => { setDlg(null); void load() }} />}
      {dlg === 'assign' && <AssignDlg p={p} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
      {dlg === 'act' && <ActivityDlg p={p} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
      {dlg === 'fu' && <ScheduleDlg p={p} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
      {dlg === 'deal' && <DealDlg p={p} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
      {dlg === 'editDeal' && openDeal && <EditDealDlg deal={openDeal} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
      {dlg === 'won' && openDeal && <WonDlg deal={openDeal} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
      {dlg === 'lost' && openDeal && <LostDlg deal={openDeal} reasons={reasons} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
      {dlg === 'pay' && openDeal && <PayDlg deal={openDeal} onClose={() => setDlg(null)} onDone={() => { setDlg(null); void load() }} />}
    </Layout>
  )
}

interface DlgProps {
  p: Prospect
  onClose: () => void
  onDone: () => void
}

function AssignDlg({ p, onClose, onDone }: DlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const [users, setUsers] = useState<User[]>([])
  const [uid, setUid] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [err, setErr] = useState<string | undefined>(undefined)
  useEffect(() => { userApi.list({}).then((u) => setUsers(u.rows)).catch(() => { }) }, [])
  const save = async (): Promise<void> => {
    const check = validateAssign(uid)
    setErr(check.ownerUserId)
    if (check.ownerUserId) { toast.error(check.ownerUserId); return }
    if (!await confirm({ title: 'Pindah Owner', message: `Pindahkan kepemilikan prospek "${p.accountName}" ke sales terpilih?`, confirmLabel: 'Ya, Pindahkan' })) return
    setBusy(true)
    try { await prospectApi.assign(p.id, uid); toast.success('Owner berhasil dipindahkan.'); onDone() }
    catch (e: unknown) { toast.error(errMsg(e, 'Gagal memindahkan owner. Muat ulang lalu coba lagi.')) }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Pindah Owner" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Memproses...' : 'Pindahkan'}</button></>}>
      <FormAlert errors={{ ownerUserId: err }} title="Belum bisa memindahkan." />
      <Field label="Owner Baru" req err={err} hint="Pilih sales aktif yang akan bertanggung jawab.">
        <select className="form-select" value={uid} onChange={(e: ChangeEvent<HTMLSelectElement>) => { setUid(e.target.value); if (err) setErr(validateAssign(e.target.value).ownerUserId) }}>
          <option value="">— Pilih —</option>{users.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </select>
      </Field>
    </Modal>
  )
}

interface ActivityFormState {
  type: ActivityType
  activityAt: string
  notes: string
  lastProgress: string
  nextAction: string
  nextFollowUpAt: string
  taskPriority: FollowUpPriority
  answered: boolean
  durationMinutes: string
  attendance: Attendance | ''
  completion: Completion | ''
}

function ActivityDlg({ p, onClose, onDone }: DlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const [f, setF] = useState<ActivityFormState>({ type: 'CALL', activityAt: '', notes: '', lastProgress: '', nextAction: '', nextFollowUpAt: '', taskPriority: 'SEDANG', answered: true, durationMinutes: '', attendance: '', completion: '' })
  const [busy, setBusy] = useState<boolean>(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const save = async (): Promise<void> => {
    const check = validateActivity({ notes: f.notes, durationMinutes: f.durationMinutes, attendance: f.attendance, completion: f.completion, activityAt: f.activityAt, nextFollowUpAt: f.nextFollowUpAt }, f.type)
    setErrors(check)
    if (Object.keys(check).length > 0) {
      const first = Object.values(check)[0] as string
      toast.error(Object.keys(check).length === 1 ? first : `Ada ${Object.keys(check).length} kolom yang perlu diperbaiki. ${first}`)
      return
    }
    if (!await confirm({ title: 'Simpan Aktivitas', message: `Simpan aktivitas ${f.type} untuk prospek "${p.accountName}"?`, confirmLabel: 'Ya, Simpan' })) return
    setBusy(true)
    try {
      const body: AddActivityPayload = {
        type: f.type, notes: f.notes.trim(),
        activityAt: f.activityAt ? new Date(f.activityAt).toISOString() : undefined,
        lastProgress: f.lastProgress || undefined, nextAction: f.nextAction || undefined,
        nextFollowUpAt: f.nextFollowUpAt ? new Date(f.nextFollowUpAt).toISOString() : undefined,
        taskPriority: f.taskPriority || undefined,
      }
      if (f.type === 'CALL') { body.answered = f.answered; body.durationMinutes = f.durationMinutes === '' ? undefined : Number(f.durationMinutes) }
      if (f.type === 'VISIT') { body.attendance = (f.attendance || undefined) as Attendance | undefined; body.completion = (f.completion || undefined) as Completion | undefined }
      await prospectApi.addActivity(p.id, body); toast.success('Aktivitas berhasil disimpan.'); onDone()
    }
    catch (e: unknown) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) setErrors(server)
      toast.error(errMsg(e, 'Gagal menyimpan aktivitas. Periksa isian lalu coba lagi.'))
    }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Tambah Aktivitas" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
      <FormAlert errors={errors} title="Belum bisa menyimpan aktivitas." />
      <div className="row g-3">
        <Field label="Jenis" req><select className="form-select" value={f.type} onChange={(e: ChangeEvent<HTMLSelectElement>) => setF({ ...f, type: e.target.value as ActivityType })}>{ACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
        <Field label="Waktu Aktivitas" err={errors.activityAt} hint="Opsional. Kosongkan untuk memakai waktu sekarang."><input className="form-control" type="datetime-local" value={f.activityAt} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, activityAt: e.target.value })} /></Field>
        {f.type === 'CALL' && <>
          <Field label="Dijawab"><select className="form-select" value={String(f.answered)} onChange={(e: ChangeEvent<HTMLSelectElement>) => setF({ ...f, answered: e.target.value === 'true' })}><option value="true">Ya</option><option value="false">Tidak</option></select></Field>
          <Field label="Durasi (menit)" err={errors.durationMinutes} hint="Opsional. Contoh: 15."><input className="form-control" type="number" min="0" value={f.durationMinutes} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, durationMinutes: e.target.value })} placeholder="Contoh: 15" /></Field>
        </>}
        {f.type === 'VISIT' && <>
          <Field label="Kehadiran"><select className="form-select" value={f.attendance} onChange={(e: ChangeEvent<HTMLSelectElement>) => setF({ ...f, attendance: e.target.value as Attendance | '' })}><option value="">— Pilih —</option><option value="HADIR">HADIR</option><option value="TIDAK_HADIR">TIDAK_HADIR</option><option value="TERJADWAL">TERJADWAL</option></select></Field>
          <Field label="Penyelesaian"><select className="form-select" value={f.completion} onChange={(e: ChangeEvent<HTMLSelectElement>) => setF({ ...f, completion: e.target.value as Completion | '' })}><option value="">— Pilih —</option><option value="SELESAI">SELESAI</option><option value="BATAL">BATAL</option><option value="TERJADWAL">TERJADWAL</option></select></Field>
        </>}
        <div className="col-12 mb-3"><label className="form-label" htmlFor="act-notes">Catatan *</label><textarea id="act-notes" className="form-control" rows={3} value={f.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setF({ ...f, notes: e.target.value })} placeholder="Contoh: Telepon dengan Pak Budi, minta penawaran 20 koli via WA..." aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? 'act-notes-error' : undefined} />{errors.notes && <div id="act-notes-error" className="form-text text-danger" role="alert">{errors.notes}</div>}</div>
        <div className="col-12 mb-3"><label className="form-label">Progres Terakhir</label><textarea className="form-control" rows={2} value={f.lastProgress} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setF({ ...f, lastProgress: e.target.value })} placeholder="Ringkasan progres terbaru (opsional)..." /></div>
        <div className="col-12 mb-3"><label className="form-label">Tindakan Berikutnya</label><input className="form-control" value={f.nextAction} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, nextAction: e.target.value })} placeholder="Contoh: Kirim quotation revisi" /></div>
        <Field label="Follow-up Berikutnya" err={errors.nextFollowUpAt}><input className="form-control" type="datetime-local" value={f.nextFollowUpAt} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, nextFollowUpAt: e.target.value })} /></Field>
        <Field label="Prioritas Tugas"><select className="form-select" value={f.taskPriority} onChange={(e: ChangeEvent<HTMLSelectElement>) => setF({ ...f, taskPriority: e.target.value as FollowUpPriority })}>{FU_PRIORITIES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
      </div>
    </Modal>
  )
}

interface ScheduleFormState {
  scheduledAt: string
  description: string
  priority: FollowUpPriority
  assigneeUserId: string
}

function ScheduleDlg({ p, onClose, onDone }: DlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const { user } = useAuth()
  const staff = isStaff(user)
  const [users, setUsers] = useState<User[]>([])
  const [f, setF] = useState<ScheduleFormState>({ scheduledAt: '', description: '', priority: 'SEDANG', assigneeUserId: '' })
  const [busy, setBusy] = useState<boolean>(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  useEffect(() => { if (staff) userApi.list({}).then((u) => setUsers(u.rows)).catch(() => { }) }, [staff])
  const save = async (): Promise<void> => {
    const check = validateSchedule(f.scheduledAt, f.description)
    setErrors(check)
    if (Object.keys(check).length > 0) {
      toast.error(Object.values(check)[0] as string)
      return
    }
    if (!await confirm({ title: 'Jadwalkan Follow-Up', message: `Buat jadwal follow-up untuk "${p.accountName}" pada ${f.scheduledAt.replace('T', ' ')}?`, confirmLabel: 'Ya, Buat' })) return
    setBusy(true)
    try { await prospectApi.followUps(p.id, { scheduledAt: new Date(f.scheduledAt).toISOString(), description: f.description.trim(), priority: f.priority, assigneeUserId: f.assigneeUserId || undefined }); toast.success('Follow-up berhasil dijadwalkan.'); onDone() }
    catch (e: unknown) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) setErrors(server)
      toast.error(errMsg(e, 'Gagal menjadwalkan follow-up. Coba lagi.'))
    }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Jadwalkan Follow-Up" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
      <FormAlert errors={errors} title="Belum bisa menjadwalkan." />
      <div className="row g-3">
        <Field label="Jadwal" req err={errors.scheduledAt} hint="Pilih tanggal & jam yang akan datang."><input className="form-control" type="datetime-local" value={f.scheduledAt} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, scheduledAt: e.target.value })} /></Field>
        <Field label="Priority"><select className="form-select" value={f.priority} onChange={(e: ChangeEvent<HTMLSelectElement>) => setF({ ...f, priority: e.target.value as FollowUpPriority })}>{FU_PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
        {staff && <Field label="Assignee" hint="Kosongkan untuk memakai owner prospek."><select className="form-select" value={f.assigneeUserId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setF({ ...f, assigneeUserId: e.target.value })}><option value="">— Owner prospek —</option>{users.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>}
        <div className="col-12 mb-3"><label className="form-label" htmlFor="sched-desc">Deskripsi *</label><textarea id="sched-desc" className="form-control" rows={3} value={f.description} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setF({ ...f, description: e.target.value })} placeholder="Contoh: Follow-up penawaran, bawa contoh produk..." aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'sched-desc-error' : undefined} />{errors.description && <div id="sched-desc-error" className="form-text text-danger" role="alert">{errors.description}</div>}</div>
      </div>
    </Modal>
  )
}

interface DealFormState {
  quotationNumber: string
  quotationValue: string
  potentialValue: string
}

function DealDlg({ p, onClose, onDone }: DlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const [f, setF] = useState<DealFormState>({ quotationNumber: '', quotationValue: '', potentialValue: '' })
  const [busy, setBusy] = useState<boolean>(false)
  const save = async (): Promise<void> => {
    if (!await confirm({ title: 'Buat Deal', message: `Buat deal baru untuk prospek "${p.accountName}"? Deal dipakai untuk tahap quotation hingga closing.`, confirmLabel: 'Ya, Buat' })) return
    setBusy(true)
    try {
      await prospectApi.createDeal(p.id, { quotationNumber: f.quotationNumber || undefined, quotationValue: parseRupiah(f.quotationValue), potentialValue: parseRupiah(f.potentialValue) })
      toast.success('Deal berhasil dibuat. Lanjutkan ke tahap quotation / closing.'); onDone()
    } catch (e: unknown) {
      const server = backendFieldErrors(e)
      const first = Object.values(server)[0]
      toast.error(first ? `Gagal membuat deal: ${first}` : errMsg(e, 'Gagal membuat deal. Prospek mungkin sudah memiliki deal aktif — periksa tab Deal.'))
    }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Buat Deal" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>Buat</button></>}>
      <div className="row g-3">
        <Field label="Nomor Quotation" hint="Opsional. Contoh: Q-2026-001."><input className="form-control" value={f.quotationNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, quotationNumber: e.target.value })} placeholder="Q-2026-001" /></Field>
        <Field label="Quotation Value" hint="Opsional. Contoh: 100.000.000."><RupiahInput value={f.quotationValue} onChange={(v: string) => setF({ ...f, quotationValue: v })} /></Field>
        <Field label="Potential Value" hint="Opsional. Estimasi nilai prospek."><RupiahInput value={f.potentialValue} onChange={(v: string) => setF({ ...f, potentialValue: v })} /></Field>
      </div>
    </Modal>
  )
}

interface DealDlgProps {
  deal: Deal
  onClose: () => void
  onDone: () => void
}

function EditDealDlg({ deal, onClose, onDone }: DealDlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const [f, setF] = useState<DealFormState>({ quotationNumber: deal.quotationNumber ?? '', quotationValue: deal.quotationValue ?? '', potentialValue: deal.potentialValue ?? '' })
  const [busy, setBusy] = useState<boolean>(false)
  const save = async (): Promise<void> => {
    if (!await confirm({ title: 'Ubah Deal', message: `Simpan perubahan deal "${deal.dealNumber ?? deal.id.slice(0, 8)}"?`, confirmLabel: 'Ya, Simpan' })) return
    setBusy(true)
    try {
      await dealApi.update(deal.id, { version: deal.version, quotationNumber: f.quotationNumber || undefined, quotationValue: parseRupiah(f.quotationValue), potentialValue: parseRupiah(f.potentialValue) })
      toast.success('Deal berhasil diperbarui.'); onDone()
    } catch (e: unknown) {
      const server = backendFieldErrors(e)
      const first = Object.values(server)[0]
      toast.error(first ? `Gagal memperbarui: ${first}` : errMsg(e, 'Gagal memperbarui deal. Data mungkin diubah pengguna lain — muat ulang halaman.'))
    }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Ubah Deal" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
      <div className="row g-3">
        <Field label="Nomor Quotation"><input className="form-control" value={f.quotationNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, quotationNumber: e.target.value })} /></Field>
        <Field label="Quotation Value"><RupiahInput value={f.quotationValue} onChange={(v: string) => setF({ ...f, quotationValue: v })} /></Field>
        <Field label="Potential Value"><RupiahInput value={f.potentialValue} onChange={(v: string) => setF({ ...f, potentialValue: v })} /></Field>
      </div>
    </Modal>
  )
}

type CustomerCandidate = Customer & { customerId?: string; name?: string }

interface WonFormState {
  closingDate: string
  closingValue: string
  mode: 'new' | 'existing'
  customerId: string
}

function WonDlg({ deal, onClose, onDone }: DealDlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const [f, setF] = useState<WonFormState>({ closingDate: new Date().toISOString().slice(0, 10), closingValue: '', mode: 'new', customerId: '' })
  const [cands, setCands] = useState<CustomerCandidate[]>([])
  const [busy, setBusy] = useState<boolean>(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  useEffect(() => {
    dealApi.candidates(deal.id).then((r) => {
      setCands(r as CustomerCandidate[])
    }).catch(() => { })
  }, [deal.id])
  const save = async (): Promise<void> => {
    const check = validateWon(f.closingDate, f.closingValue, f.mode, f.customerId)
    setErrors(check)
    if (Object.keys(check).length > 0) {
      toast.error(Object.values(check)[0] as string)
      return
    }
    const cv = parseRupiah(f.closingValue)
    if (cv === undefined) { toast.error('Closing Value tidak valid. Isi hanya angka. Contoh: 250.000.000.'); return }
    if (!await confirm({ title: 'Konfirmasi Won', message: `Tandai deal "${deal.dealNumber ?? deal.id.slice(0, 8)}" sebagai WON senilai ${rupiah(cv)}? Prospek akan menjadi customer.`, confirmLabel: 'Ya, Won' })) return
    setBusy(true)
    try {
      const payload: DealWonPayload = f.mode === 'new'
        ? { closingDate: f.closingDate, closingValue: cv, customerMode: 'new' }
        : { closingDate: f.closingDate, closingValue: cv, customerId: f.customerId }
      await dealApi.won(deal.id, payload)
      toast.success('Deal berhasil dimenangkan.'); onDone()
    } catch (e: unknown) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) setErrors(server)
      toast.error(errMsg(e, 'Gagal memproses Won. Periksa tanggal & nilai closing.'))
    }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Closing Won" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>Konfirmasi Won</button></>}>
      <FormAlert errors={errors} title="Belum bisa closing won." />
      <div className="row g-3">
        <Field label="Tanggal Closing" req err={errors.closingDate}><input className="form-control" type="date" value={f.closingDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, closingDate: e.target.value })} /></Field>
        <Field label="Closing Value" req err={errors.closingValue} hint="Nilai deal yang disepakati. Contoh: 250.000.000."><RupiahInput value={f.closingValue} onChange={(v: string) => setF({ ...f, closingValue: v })} /></Field>
      </div>
      {cands.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Customer ({cands.length} kandidat ditemukan)</label>
          {errors.customerId && <div className="form-text text-danger" role="alert">{errors.customerId}</div>}
          {cands.map((c) => {
            const cid: string = c.id ?? c.customerId ?? ''
            return <div className="form-check" key={cid} style={{ marginTop: 8, fontSize: 13 }}><input className="form-check-input" type="radio" name="customerChoice" checked={f.mode === 'existing' && f.customerId === cid} onChange={() => setF({ ...f, mode: 'existing', customerId: cid })} /><label className="form-check-label">{c.accountName ?? c.name ?? '—'}</label></div>
          })}
          <div className="form-check" style={{ marginTop: 8, fontSize: 13 }}><input className="form-check-input" type="radio" name="customerChoice" checked={f.mode === 'new'} onChange={() => setF({ ...f, mode: 'new' })} /><label className="form-check-label">Buat customer baru</label></div>
        </div>
      )}
    </Modal>
  )
}

interface LostDlgProps {
  deal: Deal
  reasons: MasterItem[]
  onClose: () => void
  onDone: () => void
}

function LostDlg({ deal, reasons, onClose, onDone }: LostDlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const [f, setF] = useState<{ lostReasonCode: string }>({ lostReasonCode: '' })
  const [busy, setBusy] = useState<boolean>(false)
  const [err, setErr] = useState<string | undefined>(undefined)
  const save = async (): Promise<void> => {
    const check = validateLost(f.lostReasonCode)
    setErr(check.lostReasonCode)
    if (check.lostReasonCode) { toast.error(check.lostReasonCode); return }
    if (!await confirm({ title: 'Konfirmasi Lost', message: `Tandai deal "${deal.dealNumber ?? deal.id.slice(0, 8)}" sebagai LOST? Data tetap tersimpan untuk evaluasi.`, confirmLabel: 'Ya, Lost', danger: true })) return
    setBusy(true)
    try { await dealApi.lost(deal.id, { lostReasonCode: f.lostReasonCode }); toast.success('Deal ditandai sebagai Lost.'); onDone() }
    catch (e: unknown) { toast.error(errMsg(e, 'Gagal memproses Lost. Coba lagi.')) }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Closing Lost" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-danger" disabled={busy} onClick={() => void save()}>Konfirmasi Lost</button></>}>
      <FormAlert errors={{ lostReasonCode: err }} title="Belum bisa closing lost." />
      <Field label="Alasan Lost" req err={err} hint="Pilih alasan yang paling sesuai agar bisa dievaluasi.">
        <select className="form-select" value={f.lostReasonCode} onChange={(e: ChangeEvent<HTMLSelectElement>) => { setF({ ...f, lostReasonCode: e.target.value }); if (err) setErr(validateLost(e.target.value).lostReasonCode) }}>
          <option value="">— Pilih —</option>{reasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </Field>
    </Modal>
  )
}

function PayDlg({ deal, onClose, onDone }: DealDlgProps) {
  const toast = useToast(); const confirm = useConfirm()
  const [st, setSt] = useState<PaymentStatusValue>(deal.paymentStatus ?? 'BELUM_DITAGIH')
  const [busy, setBusy] = useState<boolean>(false)
  const save = async (): Promise<void> => {
    if (!await confirm({ title: 'Update Pembayaran', message: `Ubah status pembayaran menjadi ${st}?`, confirmLabel: 'Ya, Update' })) return
    setBusy(true)
    try { await dealApi.payment(deal.id, st); toast.success('Status pembayaran berhasil diperbarui.'); onDone() }
    catch (e: unknown) { toast.error(errMsg(e, 'Gagal memperbarui pembayaran.')) }
    finally { setBusy(false) }
  }
  return (
    <Modal title="Status Pembayaran" onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>Simpan</button></>}>
      <Field label="Status"><select className="form-select" value={st} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSt(e.target.value as PaymentStatusValue)}>{(['BELUM_DITAGIH', 'INVOICE', 'TERTAGIH', 'LUNAS', 'OVERDUE'] as PaymentStatusValue[]).map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
    </Modal>
  )
}

interface ContactFormState {
  name: string
  position: string
  phone: string
  email: string
}

function ContactTab({ p, reload }: { p: Prospect; reload: () => void }) {
  const toast = useToast(); const confirm = useConfirm()
  const [f, setF] = useState<ContactFormState>({ name: '', position: '', phone: '', email: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const contacts: ProspectContact[] = p.contacts ?? []
  const add = async (): Promise<void> => {
    const check = validateContact(f.name, f.phone, f.email)
    setErrors(check)
    if (Object.keys(check).length > 0) {
      toast.error(Object.values(check)[0] as string)
      return
    }
    if (!await confirm({ title: 'Tambah Kontak', message: `Tambah kontak "${f.name.trim()}" ke prospek "${p.accountName}"?`, confirmLabel: 'Ya, Tambah' })) return
    try { await prospectApi.addContact(p.id, f); toast.success('Kontak berhasil ditambahkan.'); setF({ name: '', position: '', phone: '', email: '' }); setErrors({}); reload() }
    catch (e: unknown) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) setErrors(server)
      toast.error(errMsg(e, 'Gagal menambah kontak. Periksa nomor & email lalu coba lagi.'))
    }
  }
  const del = async (c: ProspectContact): Promise<void> => {
    if (!await confirm({ title: 'Hapus Kontak', message: `Hapus kontak "${c.name}"?`, confirmLabel: 'Ya, Hapus', danger: true })) return
    try { await prospectApi.removeContact(p.id, c.id); toast.success('Kontak berhasil dihapus.'); reload() }
    catch (e: unknown) { toast.error(errMsg(e, 'Gagal menghapus kontak.')) }
  }
  return (
    <div>
      <div className="card border p-3 mb-4 bg-light" style={{ borderRadius: 10 }}>
        <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2" style={{ fontSize: 13.5 }}>
          <UserPlus size={15} className="text-primary" /> Tambah Kontak PIC Baru
        </h6>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="contact-name">Nama PIC *</label>
            <input
              id="contact-name"
              className="form-control form-control-sm"
              placeholder="Nama lengkap"
              value={f.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, name: e.target.value })}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'contact-name-error' : undefined}
            />
            {errors.name && <div id="contact-name-error" className="form-text text-danger" role="alert">{errors.name}</div>}
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold text-secondary mb-1">Jabatan</label>
            <input
              className="form-control form-control-sm"
              placeholder="e.g. Procurement / Manager"
              value={f.position}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, position: e.target.value })}
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="contact-phone">No. Telepon / WA</label>
            <input
              id="contact-phone"
              className="form-control form-control-sm"
              placeholder="08..."
              value={f.phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, phone: e.target.value })}
              inputMode="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'contact-phone-error' : undefined}
            />
            {errors.phone && <div id="contact-phone-error" className="form-text text-danger" role="alert">{errors.phone}</div>}
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              className="form-control form-control-sm"
              placeholder="email@perusahaan.com"
              value={f.email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setF({ ...f, email: e.target.value })}
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'contact-email-error' : undefined}
            />
            {errors.email && <div id="contact-email-error" className="form-text text-danger" role="alert">{errors.email}</div>}
          </div>
          <div className="col-12 mt-3 d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1.5"
              style={{ borderRadius: 6, padding: '6px 14px' }}
              onClick={() => void add()}
            >
              <Plus size={14} /> Simpan Kontak PIC
            </button>
          </div>
        </div>
      </div>

      {contacts.length === 0 ? (
        <Empty text="Belum ada kontak PIC tambahan. Tambahkan PIC lain agar tim sales mudah berkoordinasi." />
      ) : (
        <div className="table-card">
          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th>No. Telepon</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="fw-semibold text-dark">{c.name}</span>
                    </td>
                    <td className="text-secondary">{c.position ?? '—'}</td>
                    <td className="tabular">
                      {c.phone ? (
                        <a
                          href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="tbl-link"
                        >
                          {c.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="tbl-link text-truncate d-inline-block" style={{ maxWidth: 200 }}>
                          {c.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
                        style={{ padding: '3px 9px', fontSize: 12, borderRadius: 6 }}
                        onClick={() => void del(c)}
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
