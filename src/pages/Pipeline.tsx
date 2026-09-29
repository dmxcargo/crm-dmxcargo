import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Eye,
  MoreHorizontal,
  Calendar,
  Download,
  Plus,
} from 'lucide-react'
import Layout from '../layout'
import { dashApi, userApi, prospectApi } from '../api/resources'
import { useAuth, useConfirm, useToast } from '../store/app'
import { rupiah, fmtDate, errMsg, STAGES, STAGE_LABEL, isStaff } from '../utils'
import { Badge, Spinner, Empty } from '../ui'
import type { PipelineBoardRow, Prospect, User, Stage } from '../types'

const NEXT: Record<Stage, Stage | null> = {
  NEW: 'FOLLOW_UP',
  FOLLOW_UP: 'OPPORTUNITY',
  OPPORTUNITY: 'QUOTATION',
  QUOTATION: 'NEGOTIATION',
  NEGOTIATION: 'CLOSING',
  CLOSING: null,
  WON: 'MAINTENANCE',
  LOST: null,
  MAINTENANCE: null,
}

const COLORS: Record<Stage, string> = {
  NEW: '#7c3aed',
  FOLLOW_UP: '#2563eb',
  OPPORTUNITY: '#0891b2',
  QUOTATION: '#d97706',
  NEGOTIATION: '#ea580c',
  CLOSING: '#db2777',
  WON: '#16a34a',
  LOST: '#dc2626',
  MAINTENANCE: '#0d9488',
}

const AVATAR_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#6366f1',
  '#14b8a6',
]

const getAvatarBg = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const PER_STAGE = 50

export default function Pipeline() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNavigate()
  const staff = isStaff(user)

  const [counts, setCounts] = useState<PipelineBoardRow[]>([])
  const [cards, setCards] = useState<Partial<Record<Stage, Prospect[]>>>({})
  const [owner, setOwner] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState('')
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board')

  const load = async () => {
    setLoading(true)
    try {
      const b = await dashApi.pipeline({ owner: owner || undefined })
      const arr: PipelineBoardRow[] = Array.isArray(b) ? b : []
      setCounts(arr)
      const detail: Partial<Record<Stage, Prospect[]>> = {}
      const failed: string[] = []
      await Promise.all(
        arr
          .filter((s: PipelineBoardRow) => Number(s.count) > 0)
          .map(async (s: PipelineBoardRow) => {
            try {
              const r = await prospectApi.list({
                stage: s.stage,
                pageSize: PER_STAGE,
                sort: 'potentialValue:desc',
                owner: owner || undefined,
              })
              detail[s.stage] = r.rows
            } catch {
              detail[s.stage] = []
              failed.push(STAGE_LABEL[s.stage] ?? s.stage)
            }
          })
      )
      setCards(detail)
      if (failed.length > 0) {
        toast.warning(
          failed.length === 1
            ? `Kolom ${failed[0]} gagal dimuat. Klik Segarkan untuk mencoba lagi.`
            : `${failed.length} kolom (${failed.slice(0, 3).join(', ')}) gagal dimuat. Klik Segarkan untuk mencoba lagi.`,
        )
      }
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat pipeline.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [owner])

  useEffect(() => {
    if (staff) {
      userApi
        .list({})
        .then((u) => setUsers(u.rows))
        .catch(() => {})
    }
  }, [staff])

  const move = async (p: Prospect) => {
    const target = NEXT[p.stage]
    if (!target) {
      toast.error(`"${p.accountName}" sudah di stage akhir (${STAGE_LABEL[p.stage]}). Tidak ada stage lanjutan via tombol ini — gunakan aksi Won/Lost di detail prospek.`)
      return
    }
    const ok = await confirm({
      title: 'Pindah Stage',
      message: `Pindahkan "${p.accountName}" ke ${STAGE_LABEL[target]}?`,
      confirmLabel: 'Ya, Pindahkan',
    })
    if (!ok) return
    setMoving(p.id)
    try {
      await prospectApi.stage(p.id, target, p.version)
      toast.success(`Berhasil dipindahkan ke ${STAGE_LABEL[target]}.`)
      load()
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memindahkan stage. Kemungkinan perpindahan tidak valid atau data diubah pengguna lain — muat ulang lalu coba lagi.'))
    } finally {
      setMoving('')
    }
  }

  const match = (p: Prospect) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [p.accountName, p.picName, p.city, p.phone].some((v) =>
      (v ?? '').toLowerCase().includes(s)
    )
  }

  const countOf = (s: Stage) =>
    Number(counts.find((x: PipelineBoardRow) => x.stage === s)?.count ?? 0)

  const boardOf = (s: Stage): PipelineBoardRow | undefined =>
    counts.find((x: PipelineBoardRow) => x.stage === s)

  const valueOf = (s: Stage) => {
    const b = boardOf(s)
    if (s === 'WON' && Number(b?.closingValue ?? 0) > 0) return Number(b?.closingValue)
    return Number(b?.totalValue ?? 0)
  }

  const ACTIVE_STAGES: Stage[] = [
    'NEW',
    'FOLLOW_UP',
    'OPPORTUNITY',
    'QUOTATION',
    'NEGOTIATION',
    'CLOSING',
  ]

  const activeCount = useMemo(
    () => ACTIVE_STAGES.reduce((a: number, s: Stage) => a + countOf(s), 0),
    [counts]
  )

  const grand = useMemo(
    () => STAGES.reduce((a: number, s: Stage) => a + valueOf(s), 0),
    [counts]
  )

  // Flattened prospects list for Table view
  const allProspectsList = useMemo(() => {
    const list: Prospect[] = []
    STAGES.forEach((s) => {
      const items = cards[s] ?? []
      list.push(...items)
    })
    return list.filter(match)
  }, [cards, q])

  // CSV Exporter
  const handleExportCsv = () => {
    if (allProspectsList.length === 0) {
      toast.error('Tidak ada data untuk diekspor. Longgarkan pencarian/filter lalu coba lagi.')
      return
    }
    const headers = [
      'Account Name',
      'Stage',
      'Priority',
      'Nilai Potensi',
      'PIC',
      'Telepon',
      'Kota',
      'Next FU',
    ]
    const rows = allProspectsList.map((p) => [
      `"${(p.accountName || '').replace(/"/g, '""')}"`,
      `"${STAGE_LABEL[p.stage] || p.stage}"`,
      `"${p.priority || ''}"`,
      p.potentialValue || 0,
      `"${(p.picName || '').replace(/"/g, '""')}"`,
      `"${(p.phone || '').replace(/"/g, '""')}"`,
      `"${(p.city || '').replace(/"/g, '""')}"`,
      `"${p.nextFollowUpAt ? fmtDate(p.nextFollowUpAt) : ''}"`,
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `pipeline_deals_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Pipeline berhasil diekspor ke CSV.')
  }

  return (
    <Layout title="Deals Pipeline">
      {/* ══ HEADER: Deals Pipeline + Action Buttons ════════════════════ */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0 text-dark" style={{ letterSpacing: -0.3 }}>
            Deals Pipeline
          </h4>
          <p className="text-secondary small mb-0">
            Kelola tahapan prospek &amp; estimasi konversi penjualan secara real-time
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            style={{ borderRadius: 8, padding: '7px 14px', fontSize: 13 }}
            onClick={load}
            title="Muat ulang data"
          >
            <RefreshCw size={14} className="me-1" /> Segarkan
          </button>
          <button
            type="button"
            className="btn-deals-export"
            onClick={handleExportCsv}
            title="Ekspor daftar deals ke file CSV"
          >
            <Download size={14} /> Export
          </button>
          <button
            type="button"
            className="btn-deals-add"
            onClick={() => nav('/prospects')}
            title="Tambah Prospek / Deal Baru"
          >
            <Plus size={16} /> Add Deal
          </button>
        </div>
      </div>

      {/* ══ SUB-TOOLBAR: Segmented Tabs | Metrics | Search & Filter ══════ */}
      <div
        className="deals-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: '1px solid #ebedf0',
        }}
      >
        {/* Left: Tabs + Separator + Metrics */}
        <div className="d-flex align-items-center flex-wrap gap-3">
          <div className="deals-tabs" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              type="button"
              className={`deals-tab-btn ${viewMode === 'board' ? 'active' : ''}`}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 0 12px 0',
                fontSize: 13.5,
                fontWeight: 600,
                color: viewMode === 'board' ? '#16a34a' : '#6b778c',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                borderBottom:
                  viewMode === 'board' ? '2.5px solid #16a34a' : '2.5px solid transparent',
                marginBottom: -13,
              }}
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid size={15} /> Pipeline
            </button>
            <button
              type="button"
              className={`deals-tab-btn ${viewMode === 'table' ? 'active' : ''}`}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 0 12px 0',
                fontSize: 13.5,
                fontWeight: 600,
                color: viewMode === 'table' ? '#16a34a' : '#6b778c',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                borderBottom:
                  viewMode === 'table' ? '2.5px solid #16a34a' : '2.5px solid transparent',
                marginBottom: -13,
              }}
              onClick={() => setViewMode('table')}
            >
              <List size={15} /> List
            </button>
          </div>

          <div
            className="deals-toolbar-sep d-none d-sm-block"
            style={{ height: 18, width: 1, background: '#dfe1e6', margin: '0 4px' }}
          />

          <div
            className="deals-toolbar-metrics"
            style={{
              fontSize: 13,
              color: '#5e6c84',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>
              Projected Deals: <b style={{ color: '#172b4d', fontWeight: 700 }}>{activeCount}</b>
            </span>
            <span className="text-muted">·</span>
            <span>
              Projected Revenue:{' '}
              <b style={{ color: '#172b4d', fontWeight: 700 }}>{rupiah(grand)}</b>
            </span>
          </div>
        </div>

        {/* Right: Search & Owner Filter */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="input-group input-group-sm" style={{ width: 220 }}>
            <span
              className="input-group-text bg-white border-end-0 text-muted"
              style={{ borderRadius: '8px 0 0 8px' }}
            >
              <Search size={14} />
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              style={{ borderRadius: '0 8px 8px 0', fontSize: 13 }}
              placeholder="Cari deals (nama, PIC, kota)..."
              aria-label="Cari deals"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {staff && (
            <select
              className="form-select form-select-sm"
              style={{ width: 160, borderRadius: 8, fontSize: 13 }}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">Semua Owner</option>
              {users.map((u: User) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* ══ VIEW 1: KANBAN BOARD (Exact 1:1 Match to Photo 3 & 4) ══ */}
          {viewMode === 'board' && (
            <div
              className="deals-board"
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 14,
                overflowX: 'auto',
                paddingBottom: 24,
                alignItems: 'flex-start',
                width: '100%',
              }}
            >
              {STAGES.map((s) => {
                const c = countOf(s)
                const val = valueOf(s)
                const rows = (cards[s] ?? []).filter(match)
                const isWon = s === 'WON'

                return (
                  <div
                    className={`deals-col ${isWon ? 'won' : ''}`}
                    key={s}
                    style={{
                      width: 295,
                      minWidth: 295,
                      maxWidth: 295,
                      background: isWon ? '#edf7ed' : '#f4f5f7',
                      borderRadius: 12,
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    {/* Column Header */}
                    <div className="deals-col-header" style={{ padding: '2px 6px 6px 6px' }}>
                      <div
                        className="deals-col-title"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          color: '#5e6c84',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{ cursor: 'pointer' }}
                          onClick={() => nav(`/prospects?stage=${s}`)}
                          title={`Buka semua prospek ${STAGE_LABEL[s]}`}
                        >
                          {STAGE_LABEL[s]}
                        </span>
                        <button
                          type="button"
                          className="btn btn-link text-muted p-0 border-0"
                          style={{ lineHeight: 1 }}
                          onClick={() => nav(`/prospects?stage=${s}`)}
                          title="Buka daftar"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                      <div
                        className="deals-col-value"
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: '#172b4d',
                          marginTop: 3,
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 6,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <span>{rupiah(val)}</span>
                        <span
                          className="deals-col-count"
                          style={{ fontSize: 11.5, fontWeight: 500, color: '#6b778c' }}
                        >
                          {c} deals
                        </span>
                      </div>
                    </div>

                    {/* Cards List */}
                    {rows.map((p: Prospect) => {
                      const picOrOwner = p.picName || user?.name || 'Sales'
                      const initial = picOrOwner.trim().charAt(0).toUpperCase() || 'P'
                      const avatarBg = getAvatarBg(picOrOwner)

                      // Horizontal tag color based on priority or stage
                      const tagColor =
                        p.priority === 'HOT'
                          ? '#ef4444'
                          : p.priority === 'WARM'
                          ? '#f59e0b'
                          : p.priority === 'COLD'
                          ? '#3b82f6'
                          : COLORS[p.stage] || '#8b5cf6'

                      return (
                        <div
                          className="deals-card"
                          key={p.id}
                          onClick={() => nav(`/prospects/${p.id}`)}
                          style={{
                            background: '#ffffff',
                            borderRadius: 10,
                            padding: '12px 14px',
                            border: '1px solid rgba(9, 30, 66, 0.08)',
                            boxShadow: '0 1px 2px rgba(9, 30, 66, 0.05)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          {/* Top Row: Account Name & More Menu */}
                          <div
                            className="deals-card-top"
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 8,
                            }}
                          >
                            <div
                              className="deals-card-title"
                              style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: '#172b4d',
                                lineHeight: 1.3,
                                margin: 0,
                              }}
                            >
                              {p.accountName}
                            </div>
                            <button
                              type="button"
                              className="btn btn-link text-muted p-0 border-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                nav(`/prospects/${p.id}`)
                              }}
                              title="Detail"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </div>

                          {/* Subtitle: Address / PIC & City */}
                          <div
                            className="deals-card-sub"
                            style={{ fontSize: 11.5, color: '#6b778c', lineHeight: 1.3 }}
                          >
                            {[p.picName, p.city].filter(Boolean).join(' • ') ||
                              p.customerType ||
                              '—'}
                          </div>

                          {/* Colored Accent Tag */}
                          <div
                            className="deals-card-tag"
                            style={{
                              width: 28,
                              height: 3.5,
                              borderRadius: 2,
                              marginTop: 2,
                              backgroundColor: tagColor,
                            }}
                          />

                          {/* Middle Row: Assignee Avatar + Price */}
                          <div
                            className="deals-card-middle"
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingTop: 4,
                            }}
                          >
                            <div
                              className="deals-card-user"
                              title={picOrOwner}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12,
                                color: '#172b4d',
                                fontWeight: 500,
                              }}
                            >
                              <span
                                className="deals-user-avatar"
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  backgroundColor: avatarBg,
                                  color: '#ffffff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {initial}
                              </span>
                              <span className="text-truncate" style={{ maxWidth: 110 }}>
                                {picOrOwner}
                              </span>
                            </div>
                            <div
                              className="deals-card-price"
                              style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: '#172b4d',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {rupiah(p.potentialValue)}
                            </div>
                          </div>

                          {/* Bottom Row: Next FU Date + Move Stage Action */}
                          <div
                            className="deals-card-bottom"
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingTop: 6,
                              borderTop: '1px solid #f4f5f7',
                              marginTop: 2,
                              fontSize: 11,
                              color: '#6b778c',
                            }}
                          >
                            <div
                              className="d-flex align-items-center gap-1 text-muted"
                              style={{ fontSize: 11 }}
                            >
                              <Calendar size={12} />
                              <span>
                                {p.nextFollowUpAt ? fmtDate(p.nextFollowUpAt) : 'Belum FU'}
                              </span>
                            </div>

                            {NEXT[p.stage] && (
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm py-0 px-2 d-flex align-items-center gap-1"
                                style={{ fontSize: 11, borderRadius: 6 }}
                                disabled={moving === p.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  move(p)
                                }}
                                title={`Pindahkan ke ${STAGE_LABEL[NEXT[p.stage] as Stage]}`}
                              >
                                <span>
                                  {moving === p.id
                                    ? '...'
                                    : STAGE_LABEL[NEXT[p.stage] as Stage]}
                                </span>
                                <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Empty Stage State */}
                    {rows.length === 0 && (
                      <div className="text-center py-4 text-muted" style={{ fontSize: 12 }}>
                        Belum ada prospek
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ VIEW 2: LIST / TABLE VIEW (Clean Reference Table) ═════════ */}
          {viewMode === 'table' && (
            <div className="table-card">
              {allProspectsList.length === 0 ? (
                <Empty text="Tidak ada prospek dalam pipeline yang cocok dengan filter." />
              ) : (
                <div className="table-responsive">
                  <table className="table-clean">
                    <thead>
                      <tr>
                        <th style={{ width: 50, textAlign: 'center' }}>No</th>
                        <th>Account Name</th>
                        <th>Stage</th>
                        <th>Priority</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Nilai Potensi</th>
                        <th>PIC &amp; Kontak</th>
                        <th>Kota</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Next FU</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allProspectsList.map((p: Prospect, idx: number) => (
                        <tr
                          key={p.id}
                          className="clickable"
                          onClick={() => nav(`/prospects/${p.id}`)}
                        >
                          <td
                            style={{
                              textAlign: 'center',
                              width: 50,
                              color: '#64748b',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {idx + 1}
                          </td>
                          <td>
                            <div>
                              <span className="tbl-link">{p.accountName}</span>
                              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                {p.customerType ?? 'B2B'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge value={p.stage} />
                          </td>
                          <td>
                            <Badge value={p.priority} />
                          </td>
                          <td
                            className="tabular fw-semibold text-end"
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {rupiah(p.potentialValue)}
                          </td>
                          <td>
                            <div className="fw-medium">{p.picName || '—'}</div>
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>
                              {p.phone || '—'}
                            </div>
                          </td>
                          <td>{p.city || '—'}</td>
                          <td
                            className="tabular text-secondary"
                            style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
                          >
                            {fmtDate(p.nextFollowUpAt)}
                          </td>
                          <td
                            style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className="d-inline-flex align-items-center gap-1 justify-content-end"
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              <button
                                type="button"
                                className="tbl-icon-btn me-1"
                                title="Buka Detail Prospek"
                                onClick={() => nav(`/prospects/${p.id}`)}
                              >
                                <Eye size={18} />
                              </button>
                              {NEXT[p.stage] && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm py-1 px-2"
                                  style={{ fontSize: 12, borderRadius: 6 }}
                                  disabled={moving === p.id}
                                  onClick={() => move(p)}
                                >
                                  <ArrowRight size={13} className="me-1" />
                                  {STAGE_LABEL[NEXT[p.stage] as Stage]}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!loading && (
        <p className="text-secondary small mt-3">
          💡 <b>Tips:</b> Klik pada kartu untuk melihat detail lengkap prospek. Pindahkan kartu
          secara cepat menggunakan tombol stage di sudut kanan bawah kartu.
        </p>
      )}
    </Layout>
  )
}
