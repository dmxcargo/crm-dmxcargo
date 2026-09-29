import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check, CalendarClock, Plus, Search, Calendar, Clock, AlertCircle,
  ListTodo, RotateCcw, ArrowUpRight, X, User as UserIcon,
} from 'lucide-react'
import Layout from '../layout'
import { fuApi, userApi } from '../api/resources'
import { useAuth, useConfirm, useToast } from '../store/app'
import { fmtDateTime, errMsg, FU_MODES, FU_STATUSES, FU_PRIORITIES, isStaff } from '../utils'
import { Badge, Empty, Spinner, Pager, Modal, Field, PageHeader } from '../ui'
import FormAlert from '../components/FormAlert'
import { useFuCreate, validateReschedule, completeFollowUp } from '../hooks/useFollowUps'
import type { FollowUp, User, FollowUpMode, FollowUpStatus, FollowUpPriority } from '../types'

export default function FollowUps() {
  const { user } = useAuth()
  const staff = isStaff(user)
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNavigate()
  const [params] = useSearchParams()

  const [mode, setMode] = useState<FollowUpMode>((params.get('mode') ?? 'today') as FollowUpMode)
  const [status, setStatus] = useState<FollowUpStatus | ''>('')
  const [assignee, setAssignee] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [rows, setRows] = useState<FollowUp[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [resched, setResched] = useState<FollowUp | null>(null)
  const [newAt, setNewAt] = useState('')
  const [create, setCreate] = useState(false)

  const emptyMsg: Record<FollowUpMode, string> = {
    today: 'Tidak ada follow-up untuk hari ini. Semua agenda beres atau jadwalkan yang baru.',
    overdue: 'Bagus! Tidak ada jadwal follow-up yang terlambat saat ini.',
    upcoming: 'Tidak ada jadwal follow-up mendatang. Buat rencana follow-up berikutnya.',
    all: 'Belum ada data follow-up tercatat.',
  }
  const emptyText = emptyMsg[mode]

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const r = await fuApi.list({
        mode,
        status: status || undefined,
        assignee: assignee || undefined,
        page,
        pageSize: 25,
      })
      setRows(r.rows)
      setMeta({ page: r.page, pages: r.pages, total: r.total })
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat follow-up.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (staff) {
      userApi.list({}).then((u) => setUsers(u.rows)).catch(() => {})
    }
  }, [staff])

  useEffect(() => {
    load(1)
  }, [mode, status, assignee])

  const done = async (row: FollowUp) => {
    await completeFollowUp(row, confirm, toast, () => load(meta.page))
  }

  const [reschedError, setReschedError] = useState<string | undefined>(undefined)

  const saveResched = async () => {
    const check = validateReschedule(newAt)
    setReschedError(check)
    if (check) {
      toast.error(check)
      return
    }
    if (!resched) return
    const ok = await confirm({
      title: 'Jadwal Ulang',
      message: `Jadwalkan ulang follow-up ke ${newAt}?`,
      confirmLabel: 'Ya, Jadwalkan',
    })
    if (!ok) return
    try {
      await fuApi.reschedule(resched.id, new Date(newAt).toISOString(), resched.version)
      toast.success('Follow-up berhasil dijadwalkan ulang.')
      setResched(null)
      load(meta.page)
    } catch (e) {
      toast.error(errMsg(e, 'Gagal menjadwalkan ulang.'))
    }
  }

  // Client-side search filtering by prospect name or description
  const filteredRows = rows.filter((r) => {
    if (!searchQ.trim()) return true
    const s = searchQ.trim().toLowerCase()
    return (
      (r.prospectName ?? '').toLowerCase().includes(s) ||
      (r.description ?? '').toLowerCase().includes(s)
    )
  })

  const hasFilter = Boolean(searchQ || status || assignee)

  return (
    <Layout title="Follow Up">
      <PageHeader
        title="Follow Up"
        subtitle="Kelola agenda follow-up prospek harian, terjadwal, dan penanganan terlambat"
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreate(true)}
            style={{ borderRadius: 8, padding: '7px 14px', fontSize: 13 }}
          >
            <Plus size={15} className="me-1" /> Jadwalkan FU
          </button>
        }
      />

      {/* ── 1. Mode Pill Tabs (Hari Ini, Terlambat, Mendatang, Semua) ── */}
      <div className="filter-stage-tabs">
        {FU_MODES.map((m) => {
          const isActive = mode === m.v
          const icon =
            m.v === 'today' ? <Calendar size={13} /> :
            m.v === 'overdue' ? <AlertCircle size={13} /> :
            m.v === 'upcoming' ? <Clock size={13} /> :
            <ListTodo size={13} />

          return (
            <button
              key={m.v}
              type="button"
              className={`filter-stage-pill ${isActive ? 'active' : ''}`}
              onClick={() => setMode(m.v)}
            >
              {icon} {m.l}
            </button>
          )
        })}
      </div>

      {/* ── 2. Unified Filter Card ────────────────────────────── */}
      <div className="filter-card">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="input-group" style={{ flex: '1 1 240px', minWidth: 220, maxWidth: 380 }}>
            <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderRadius: '8px 0 0 8px' }}>
              <Search size={15} />
            </span>
            <input
              type="text"
              className="form-control border-start-0 border-end-0"
              style={{ fontSize: 13 }}
              placeholder="Cari prospek atau catatan agenda..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searchQ && (
              <button
                type="button"
                className="input-group-text bg-white border-start-0 text-muted"
                style={{ borderRadius: '0 8px 8px 0', cursor: 'pointer' }}
                onClick={() => setSearchQ('')}
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <select
            className="form-select"
            style={{ width: 160, borderRadius: 8, fontSize: 13 }}
            value={status}
            onChange={(e) => setStatus(e.target.value as FollowUpStatus | '')}
          >
            <option value="">Semua Status</option>
            {FU_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Assignee / Sales PIC Filter (if staff) */}
          {staff && (
            <select
              className="form-select"
              style={{ width: 160, borderRadius: 8, fontSize: 13 }}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Semua PIC</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          {/* Reset Filters */}
          {hasFilter && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              style={{ borderRadius: 8, padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => {
                setSearchQ('')
                setStatus('')
                setAssignee('')
              }}
              title="Reset semua filter"
            >
              <RotateCcw size={13} /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Agenda Follow-Up Cards ─────────────────────────── */}
      {loading ? (
        <Spinner />
      ) : filteredRows.length === 0 ? (
        <div className="table-card p-4">
          <Empty
            text={searchQ ? `Tidak ada follow-up yang sesuai dengan pencarian "${searchQ}".` : emptyText}
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setCreate(true)}
              >
                <Plus size={14} className="me-1" /> Jadwalkan FU
              </button>
            }
          />
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {filteredRows.map((r: FollowUp) => {
            const isDoneOrCanceled = ['SELESAI', 'BATAL'].includes(r.status)
            const isOverdue = mode === 'overdue' || (!isDoneOrCanceled && new Date(r.scheduledAt) < new Date())
            const assigneeName = users.find((u) => u.id === r.assigneeUserId)?.name
              ?? (user?.id === r.assigneeUserId ? user?.name : undefined)

            return (
              <div
                className="card shadow-sm"
                key={r.id}
                style={{
                  border: isOverdue ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  borderLeft: isOverdue ? '4px solid #ef4444' : '4px solid #0284c7',
                  borderRadius: 10,
                  background: '#ffffff',
                  transition: 'all 0.15s ease',
                }}
              >
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span
                        className="tbl-link fs-6 fw-bold"
                        style={{ cursor: 'pointer' }}
                        onClick={() => r.prospectId && nav(`/prospects/${r.prospectId}`)}
                      >
                        {r.prospectName ?? 'Prospek'}
                      </span>
                      <Badge value={r.priority ?? 'SEDANG'} />
                      {r.status && <Badge value={r.status} />}
                      {isOverdue && !isDoneOrCanceled && (
                        <span className="badge b-red d-inline-flex align-items-center gap-1">
                          <AlertCircle size={11} /> TERLAMBAT
                        </span>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-1 text-secondary small tabular">
                      <Clock size={13} />
                      <span>{fmtDateTime(r.scheduledAt)}</span>
                    </div>
                  </div>

                  <div
                    className="p-2 mb-3 rounded"
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      fontSize: 13,
                      color: '#334155',
                      lineHeight: 1.5,
                    }}
                  >
                    {r.description || '—'}
                  </div>

                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="text-muted small">
                      {assigneeName && (
                        <span className="d-inline-flex align-items-center gap-1">
                          <UserIcon size={12} /> PIC: <b>{assigneeName}</b>
                        </span>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {!isDoneOrCanceled && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
                          style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            done(r)
                          }}
                        >
                          <Check size={14} /> Tandai Selesai
                        </button>
                      )}
                      {!isDoneOrCanceled && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                          style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setResched(r)
                            setNewAt('')
                          }}
                        >
                          <CalendarClock size={14} /> Jadwal Ulang
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                        style={{ borderRadius: 6, padding: '5px 12px', fontSize: 12.5 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          r.prospectId && nav(`/prospects/${r.prospectId}`)
                        }}
                      >
                        Buka Prospek <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 4. Pager ─────────────────────────────────────────── */}
      <div className="table-card mt-3">
        <Pager page={meta.page} pages={meta.pages} total={meta.total} onGo={load} />
      </div>

      {/* ── 5. Modal Reschedule ───────────────────────────────── */}
      {resched && (
        <Modal
          title="Jadwal Ulang Follow-Up"
          onClose={() => setResched(null)}
          foot={
            <>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setResched(null)}
              >
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={saveResched}>
                Simpan Jadwal Baru
              </button>
            </>
          }
        >
          <Field label="Jadwal Baru" req err={reschedError} hint="Pilih tanggal & jam yang akan datang. Contoh: besok pukul 09.00.">
            <input
              className="form-control"
              type="datetime-local"
              value={newAt}
              onChange={(e) => { setNewAt(e.target.value); if (reschedError) setReschedError(validateReschedule(e.target.value)) }}
            />
          </Field>
        </Modal>
      )}

      {/* ── 6. Modal Create Follow-Up ─────────────────────────── */}
      {create && (
        <CreateDlg
          onClose={() => setCreate(false)}
          onDone={() => {
            setCreate(false)
            load(1)
            setMode('upcoming')
          }}
        />
      )}
    </Layout>
  )
}

interface CreateDlgProps {
  onClose: () => void
  onDone: () => void
}

function CreateDlg({ onClose, onDone }: CreateDlgProps) {
  const { q, setQ, opts, sel, setSel, users, values, setValues, errors, busy, staff, search, save, ensureUsers } = useFuCreate(onDone)

  useEffect(() => { ensureUsers() }, [])

  return (
    <Modal
      title="Jadwalkan Follow-Up"
      onClose={onClose}
      foot={
        <>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Menyimpan...' : 'Simpan Follow-Up'}
          </button>
        </>
      }
    >
      <FormAlert errors={errors} title="Belum bisa menjadwalkan." />
      <div className="mb-3">
        <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="fu-prospect-search">
          Cari &amp; Pilih Prospek *
        </label>
        <div className="input-group mb-2">
          <input
            id="fu-prospect-search"
            className="form-control"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void search()
              }
            }}
            placeholder="Ketik nama prospek atau nomor HP..."
            aria-invalid={Boolean(errors.prospectId)}
            aria-describedby={errors.prospectId ? 'fu-prospect-error' : undefined}
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => void search()}
          >
            <Search size={14} className="me-1" /> Cari
          </button>
        </div>
        {errors.prospectId && (
          <div id="fu-prospect-error" className="form-text text-danger" role="alert">
            {errors.prospectId} {opts.length === 0 ? 'Klik Cari untuk menampilkan hasil.' : 'Klik salah satu hasil di bawah.'}
          </div>
        )}
        {!errors.prospectId && sel === '' && (
          <div className="form-text text-muted">Langkah 1: cari prospek. Langkah 2: klik salah satu hasil untuk memilih.</div>
        )}

        {opts.length > 0 && (
          <div
            className="d-flex flex-column gap-1 mb-2"
            style={{ maxHeight: 160, overflowY: 'auto' }}
            role="radiogroup"
            aria-label="Hasil pencarian prospek"
          >
            {opts.map((o) => (
              <div
                key={o.id}
                className={`p-2 rounded border d-flex align-items-center justify-content-between ${
                  sel === o.id ? 'border-primary bg-light' : 'border-light'
                }`}
                style={{ cursor: 'pointer', fontSize: 13 }}
                onClick={() => setSel(o.id)}
              >
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="radio"
                    className="form-check-input mt-0"
                    name="fu-prospect"
                    checked={sel === o.id}
                    onChange={() => setSel(o.id)}
                    aria-label={`Pilih ${o.accountName}`}
                  />
                  <span className="fw-semibold text-dark">{o.accountName}</span>
                  <small className="text-muted">({o.city || 'Kota —'})</small>
                </div>
                <Badge value={o.stage} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row g-3">
        <Field label="Jadwal & Waktu" req err={errors.scheduledAt} hint="Pilih tanggal & jam yang akan datang.">
          <input
            className="form-control"
            type="datetime-local"
            value={values.scheduledAt}
            onChange={(e) => setValues({ ...values, scheduledAt: e.target.value })}
          />
        </Field>
        <Field label="Prioritas Agenda">
          <select
            className="form-select"
            value={values.priority}
            onChange={(e) => setValues({ ...values, priority: e.target.value as FollowUpPriority })}
          >
            {FU_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        {staff && (
          <Field label="Assignee (Sales PIC)" hint="Kosongkan untuk memakai owner prospek.">
            <select
              className="form-select"
              value={values.assigneeUserId}
              onChange={(e) => setValues({ ...values, assigneeUserId: e.target.value })}
            >
              <option value="">— Owner prospek —</option>
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
        <div className="col-12">
          <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="fu-description">
            Deskripsi / Catatan Tindak Lanjut *
          </label>
          <textarea
            id="fu-description"
            className="form-control"
            rows={3}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            placeholder="Cth: Telepon konfirmasi penawaran harga dan jadwal meeting demo produk..."
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'fu-description-error' : undefined}
          />
          {errors.description && (
            <div id="fu-description-error" className="form-text text-danger" role="alert">
              {errors.description}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
