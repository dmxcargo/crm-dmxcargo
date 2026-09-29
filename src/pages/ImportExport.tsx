import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import Layout from '../layout'
import client from '../api/client'
import { importApi, exportApi, downloadExport, userApi } from '../api/resources'
import type { ExportProspectsPayload, ExportPerformancePayload, ImportReviewItem } from '../api/resources'
import { useAuth, useConfirm, useToast } from '../store/app'
import { errMsg, STAGES, STAGE_LABEL, PRIORITIES, ID_STATUS, fmtDateTime, isStaff } from '../utils'
import { Badge, Modal, PageHeader } from '../ui'
import type {
  ImportJob, ImportRow, ImportDecision, ImportRowStatus,
  ExportJob, User, Stage, Priority, PeriodType,
} from '../types'
import { Download, FileDown, BarChart3, Users, Check, AlertCircle, RefreshCw } from 'lucide-react'

const asArr = (v: unknown): ImportRow[] => {
  if (Array.isArray(v)) return v as ImportRow[]
  if (v && typeof v === 'object') {
    const o = v as { data?: unknown; rows?: unknown }
    if (Array.isArray(o.data)) return o.data as ImportRow[]
    if (Array.isArray(o.rows)) return o.rows as ImportRow[]
  }
  return []
}
// Import constants — preserved for when import UI is re-enabled
const _DECISIONS: ImportDecision[] = ['SKIP', 'CREATE_NEW', 'UPDATE_EXISTING', 'MERGE_SELECTED_FIELDS']
const _MERGE_FIELDS = ['accountName', 'picName', 'picPosition', 'phone', 'email', 'city', 'province', 'industryCode', 'lastProgress', 'nextFollowUpAt', 'nextAction', 'potentialValue', 'paymentStatus', 'notes']
const _ROW_STATUSES: ImportRowStatus[] = ['VALID', 'WARNING', 'INVALID', 'DUPLICATE', 'IMPORTED', 'SKIPPED']
const TERMINAL_EXP = ['DONE', 'FAILED']

interface ExpFilter {
  q: string
  stage: Stage | ''
  priority: Priority | ''
  periodType: PeriodType
  period: string
  owner: string
}

export default function ImportExport() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const staff = isStaff(user)

  // ── Import state (preserved but UI hidden) ─────────────────────────────
  const [step, setStep] = useState<number>(1)
  const [job, setJob] = useState<ImportJob | null>(null)
  const [_fileName, setFileName] = useState<string>('')
  const [preview, setPreview] = useState<string[][]>([])
  const [busy, setBusy] = useState<boolean>(false)
  const [reviewRows, setReviewRows] = useState<ImportRow[]>([])
  const [decisions, setDecisions] = useState<Record<number, ImportDecision>>({})
  const [fields, setFields] = useState<Record<number, string>>({})
  const [_browseStatus, setBrowseStatus] = useState<ImportRowStatus>('WARNING')
  const [browseRows, setBrowseRows] = useState<ImportRow[]>([])
  const [showCommit, setShowCommit] = useState<boolean>(false)

  // ── Export state ───────────────────────────────────────────────────────
  const [expType, setExpType] = useState<'prospects' | 'performance'>('prospects')
  const [expF, setExpF] = useState<ExpFilter>({
    q: '', stage: '', priority: '', periodType: 'MONTH',
    period: new Date().toISOString().slice(0, 7), owner: '',
  })
  const [users, setUsers] = useState<User[]>([])
  const [expJob, setExpJob] = useState<ExportJob | null>(null)
  const [expBusy, setExpBusy] = useState<boolean>(false)

  useEffect(() => { userApi.list({}).then((u) => setUsers(u.rows)).catch(() => {}) }, [])

  // ── Import handlers (intact, UI hidden) ────────────────────────────────
  const resetImport = (): void => { setJob(null); setFileName(''); setPreview([]); setReviewRows([]); setBrowseRows([]); setStep(1) }

  const pick = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) { toast.error('File harus berformat CSV.'); return }
    if (f.size > 20 * 1024 * 1024) { toast.error(`Ukuran file melebihi batas 20 MB.`); return }
    const text = await f.text()
    const lines = text.split(/\r?\n/).filter((l: string) => l.trim() !== '')
    if (lines.length < 2) { toast.error('File kosong atau hanya berisi header.'); return }
    if (lines.length - 1 > 100000) { toast.error(`Baris melebihi batas 100.000.`); return }
    setFileName(f.name)
    setPreview(lines.slice(0, 21).map((l: string) => l.split(',')))
    setBusy(true)
    try {
      const j: ImportJob = await importApi.create(f.name, text)
      setJob(j)
      if (j?.counters?.duplicateFile) toast.warning('File ini pernah diimpor sebelumnya.')
      else toast.success('File berhasil diunggah.')
      setStep(2)
    } catch (ex) { toast.error(errMsg(ex, 'Gagal mengunggah file.')) }
    finally { setBusy(false) }
  }

  const loadReview = async (j: ImportJob | null = job): Promise<void> => {
    const id = j?.id ?? job?.id
    if (!id) return
    try {
      const [w, d] = await Promise.all([importApi.rows(id, { status: 'WARNING', pageSize: 100 }), importApi.rows(id, { status: 'DUPLICATE', pageSize: 100 })])
      const all: ImportRow[] = [...asArr(w), ...asArr(d)]
      setReviewRows(all)
      const init: Record<number, ImportDecision> = {}, fl: Record<number, string> = {}
      all.forEach((r) => { init[r.rowNumber] = r.decision ?? 'SKIP'; fl[r.rowNumber] = (r.approvedFields ?? []).join(', ') })
      setDecisions(init); setFields(fl)
    } catch (e) { toast.error(errMsg(e, 'Gagal memuat baris review.')) }
  }

  const validate = async (): Promise<void> => {
    if (!job) return
    const jobId = job.id
    const ok = await confirm({ title: 'Validasi Import', message: 'Jalankan validasi server untuk file ini?', confirmLabel: 'Ya, Validasi' })
    if (!ok) return
    setBusy(true)
    try {
      await importApi.validate(jobId)
      let cur: ImportJob = job
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        cur = await importApi.show(jobId)
        setJob(cur)
        if (!['VALIDATING', 'PENDING', 'PROCESSING'].includes(String(cur?.status ?? '').toUpperCase())) break
      }
      await loadReview(cur)
      if (!['VALIDATING', 'PENDING', 'PROCESSING'].includes(String(cur?.status ?? '').toUpperCase())) {
        toast.success('Validasi selesai.'); setStep(3); void browse('WARNING')
      } else { toast.warning('Validasi masih berjalan.') }
    } catch (e) { toast.error(errMsg(e, 'Gagal memvalidasi.')) }
    finally { setBusy(false) }
  }

  const refreshStatus = async (): Promise<void> => {
    if (!job) return
    setBusy(true)
    try {
      const s: ImportJob = await importApi.show(job.id)
      setJob(s)
      if (!['VALIDATING', 'PENDING', 'PROCESSING'].includes(String(s?.status ?? '').toUpperCase())) {
        await loadReview(s); toast.success('Validasi selesai.'); setStep(3)
      } else toast.warning('Validasi masih berjalan.')
    } catch (e) { toast.error(errMsg(e, 'Gagal memuat status.')) }
    finally { setBusy(false) }
  }

  const browse = async (st: ImportRowStatus): Promise<void> => {
    setBrowseStatus(st)
    if (!job) return
    setBusy(true)
    try { const res = await importApi.rows(job.id, { status: st, pageSize: 100 }); setBrowseRows(asArr(res)) }
    catch (e) { toast.error(errMsg(e, 'Gagal memuat baris.')) }
    finally { setBusy(false) }
  }

  const bulk = async (dec: ImportDecision): Promise<void> => {
    const ok = await confirm({ title: dec === 'SKIP' ? 'Lewati Semua' : 'Setujui Semua', message: `Terapkan "${ID_STATUS[dec] ?? dec}" ke ${reviewRows.length} baris?`, confirmLabel: 'Ya, Terapkan' })
    if (!ok) return
    const next: Record<number, ImportDecision> = {}
    reviewRows.forEach((r) => { next[r.rowNumber] = dec })
    setDecisions(next)
    toast.success('Keputusan massal diterapkan.')
  }

  const submitReview = async (): Promise<void> => {
    const id = job?.id
    if (!id) return
    const changed = reviewRows.filter((r) => {
      const dec = decisions[r.rowNumber] ?? 'SKIP'
      const fl = (fields[r.rowNumber] ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
      return !(dec === (r.decision ?? 'SKIP')) || (dec === 'MERGE_SELECTED_FIELDS' && JSON.stringify(fl) !== JSON.stringify(r.approvedFields ?? []))
    })
    if (changed.length === 0) { toast.warning('Tidak ada perubahan keputusan.'); return }
    const bad = changed.find((r) => (decisions[r.rowNumber] ?? '') === 'MERGE_SELECTED_FIELDS' && !(fields[r.rowNumber] ?? '').trim())
    if (bad) { toast.error(`Baris ${bad.rowNumber}: pilih minimal 1 field.`); return }
    const ok = await confirm({ title: 'Simpan Review', message: `Simpan ${changed.length} keputusan?`, confirmLabel: 'Ya, Simpan' })
    if (!ok) return
    setBusy(true)
    try {
      for (let i = 0; i < changed.length; i += 500) {
        await importApi.review(id, changed.slice(i, i + 500).map((r): ImportReviewItem => {
          const fl = (fields[r.rowNumber] ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
          const item: ImportReviewItem = { rowNumber: r.rowNumber, decision: decisions[r.rowNumber] ?? 'SKIP', version: r.version }
          if (item.decision === 'MERGE_SELECTED_FIELDS') item.approvedFields = fl
          return item
        }))
      }
      toast.success('Review berhasil disimpan.')
      await loadReview()
    } catch (e) { toast.error(errMsg(e, 'Gagal menyimpan review.')) }
    finally { setBusy(false) }
  }

  const pendingRaw = job?.reconciliation?.pending ?? job?.counters?.pending
  const pending: number = typeof pendingRaw === 'number' ? pendingRaw : 0

  const commit = async (): Promise<void> => {
    if (!job) return
    setBusy(true)
    try {
      await importApi.commit(job.id)
      const s: ImportJob = await importApi.show(job.id)
      setJob(s)
      toast.success('Import berhasil di-commit.')
      setStep(4); setShowCommit(false)
    } catch (e) { toast.error(errMsg(e, 'Gagal commit import.')) }
    finally { setBusy(false) }
  }

  const cancel = async (): Promise<void> => {
    if (!job) return
    const ok = await confirm({ title: 'Batalkan Import', message: 'Batalkan job import ini?', confirmLabel: 'Ya, Batalkan', danger: true })
    if (!ok) return
    try { await importApi.cancel(job.id); toast.success('Import dibatalkan.'); resetImport() }
    catch (e) { toast.error(errMsg(e, 'Gagal membatalkan import.')) }
  }

  const dl = async (getter: () => Promise<{ data: unknown }>, name: string): Promise<void> => {
    const ok = await confirm({ title: 'Download File', message: `Download ${name}?`, confirmLabel: 'Ya, Download' })
    if (!ok) return
    try {
      const r = await getter()
      const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url); toast.success('File berhasil diunduh.')
    } catch (e) { toast.error(errMsg(e, 'Gagal mengunduh file.')) }
  }

  // ── Export handlers ────────────────────────────────────────────────────
  const requestExport = async (): Promise<void> => {
    if (expType === 'performance') {
      if (!expF.period.trim()) { toast.error('Periode wajib diisi.'); return }
      if (expF.periodType === 'MONTH' && !/^\d{4}-\d{2}$/.test(expF.period.trim())) { toast.error('Format periode bulanan: YYYY-MM.'); return }
      if (expF.periodType === 'YEAR' && !/^\d{4}$/.test(expF.period.trim())) { toast.error('Format periode tahunan: YYYY.'); return }
    }
    const ok = await confirm({
      title: 'Buat File Export',
      message: expType === 'prospects' ? 'Buat file export prospek sesuai filter saat ini?' : `Buat rekap performa periode ${expF.period}?`,
      confirmLabel: 'Ya, Buat',
    })
    if (!ok) return
    setExpBusy(true)
    try {
      let j: ExportJob
      if (expType === 'prospects') {
        const body: ExportProspectsPayload = { q: expF.q || undefined, stage: (expF.stage || undefined) as Stage | undefined, priority: (expF.priority || undefined) as Priority | undefined }
        j = await exportApi.prospects(body)
      } else {
        const body: ExportPerformancePayload = { periodType: expF.periodType, period: expF.period.trim(), owner: expF.owner || undefined }
        j = await exportApi.performance(body)
      }
      setExpJob(j)
      toast.success('Export diminta. Menunggu server...')
      for (let i = 0; i < 40; i++) {
        await new Promise((x) => setTimeout(x, 3000))
        const s: ExportJob = await exportApi.show(j.id)
        j = s; setExpJob(j)
        if (TERMINAL_EXP.includes(String(j?.status ?? '').toUpperCase())) break
      }
      if (String(j?.status).toUpperCase() === 'DONE') toast.success('Export selesai. Klik Download.')
      else if (String(j?.status).toUpperCase() === 'FAILED') toast.error('Export gagal diproses.')
      else toast.warning('Export masih diproses. Tunggu ±1 menit.')
    } catch (e) { toast.error(errMsg(e, 'Gagal membuat export.')) }
    finally { setExpBusy(false) }
  }

  const dlExport = async (): Promise<void> => {
    if (!expJob) return
    if (String(expJob.status).toUpperCase() !== 'DONE') { toast.warning('Export belum selesai.'); return }
    const ok = await confirm({ title: 'Download File', message: 'Unduh file export ini?', confirmLabel: 'Ya, Download' })
    if (!ok) return
    try {
      const r = await downloadExport(expJob.id)
      const url = URL.createObjectURL(new Blob([(r as unknown as { data: BlobPart }).data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = expType === 'prospects' ? `ekspor-prospek-${Date.now()}.csv` : `rekap-performa-${expF.period}-${Date.now()}.csv`
      a.click(); URL.revokeObjectURL(url)
      toast.success('File berhasil diunduh.')
    } catch (e) { toast.error(errMsg(e, 'Gagal mengunduh file.')) }
  }

  const expDone = String(expJob?.status ?? '').toUpperCase() === 'DONE'
  const expFailed = String(expJob?.status ?? '').toUpperCase() === 'FAILED'
  const expProcessing = !expDone && !expFailed && expJob != null

  // ── Derived summary line ───────────────────────────────────────────────
  const summaryLine = expType === 'prospects'
    ? [expF.stage && `Stage: ${STAGE_LABEL[expF.stage as Stage] ?? expF.stage}`, expF.priority && `Prioritas: ${expF.priority}`, expF.q && `"${expF.q}"`].filter(Boolean).join(' · ') || 'Semua prospek'
    : `${expF.periodType === 'MONTH' ? 'Bulanan' : 'Tahunan'}${expF.owner && users.length ? ` · ${users.find(u => u.id === expF.owner)?.name ?? expF.owner}` : ' · Semua Sales'}`

  return (
    <Layout title="Export Data">
      <style>{`@keyframes exp-spin { to { transform: rotate(360deg); } } .exp-spinning { animation: exp-spin 1.1s linear infinite; }`}</style>

      <PageHeader
        title="Export Data"
        subtitle="Unduh data prospek atau rekap performa dalam format CSV"
      />

      {/* ── Section 1: Pilih Tipe ─────────────────────────────────────── */}
      <div className="filter-card mb-3">
        <div className="mb-2" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8' }}>
          Tipe Export
        </div>
        <div className="filter-stage-tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`filter-stage-pill${expType === 'prospects' ? ' active' : ''}`}
            onClick={() => { setExpType('prospects'); setExpJob(null) }}
          >
            <Users size={13} strokeWidth={2} />
            Data Prospek
          </button>
          <button
            type="button"
            className={`filter-stage-pill${expType === 'performance' ? ' active' : ''}`}
            onClick={() => { setExpType('performance'); setExpJob(null) }}
          >
            <BarChart3 size={13} strokeWidth={2} />
            Rekap Performa
          </button>
        </div>
      </div>

      {/* ── Section 2: Filter ─────────────────────────────────────────── */}
      <div className="filter-card mb-3">
        <div className="mb-3" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8' }}>
          Filter
        </div>

        {expType === 'prospects' ? (
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Kata Kunci</label>
              <input
                className="form-control"
                style={{ fontSize: 13 }}
                value={expF.q}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setExpF({ ...expF, q: e.target.value })}
                placeholder="Nama perusahaan, kota, PIC..."
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Stage</label>
              <select
                className="form-select"
                style={{ fontSize: 13 }}
                value={expF.stage}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setExpF({ ...expF, stage: e.target.value as Stage | '' })}
              >
                <option value="">Semua</option>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Prioritas</label>
              <select
                className="form-select"
                style={{ fontSize: 13 }}
                value={expF.priority}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setExpF({ ...expF, priority: e.target.value as Priority | '' })}
              >
                <option value="">Semua</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="row g-3">
            <div className="col-6 col-md-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Tipe Periode</label>
              <select
                className="form-select"
                style={{ fontSize: 13 }}
                value={expF.periodType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setExpF({ ...expF, periodType: e.target.value as PeriodType })}
              >
                <option value="MONTH">Bulanan</option>
                <option value="YEAR">Tahunan</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                Periode
                <span className="text-muted ms-1 fw-normal" style={{ fontSize: 11 }}>
                  {expF.periodType === 'MONTH' ? 'YYYY-MM' : 'YYYY'}
                </span>
              </label>
              <input
                className="form-control"
                style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                value={expF.period}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setExpF({ ...expF, period: e.target.value })}
                placeholder={expF.periodType === 'MONTH' ? '2026-09' : '2026'}
              />
            </div>
            {staff && (
              <div className="col-12 col-md-6">
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Sales</label>
                <select
                  className="form-select"
                  style={{ fontSize: 13 }}
                  value={expF.owner}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setExpF({ ...expF, owner: e.target.value })}
                >
                  <option value="">Semua Sales</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 3: Ringkasan + Aksi ───────────────────────────────── */}
      <div className="detail-summary-card">
        {/* Top row: info + CTA */}
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <div className="fw-semibold mb-1" style={{ fontSize: 14, color: '#0f172a' }}>
              {expType === 'prospects' ? 'Export Data Prospek' : 'Export Rekap Performa'}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b' }}>
              {summaryLine}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            style={{ fontSize: 13.5, fontWeight: 600, borderRadius: 8, padding: '8px 18px' }}
            disabled={expBusy}
            onClick={requestExport}
          >
            {expBusy
              ? <><RefreshCw size={14} strokeWidth={2} className="exp-spinning" />Memproses...</>
              : <><FileDown size={14} strokeWidth={2} />Buat File Export</>
            }
          </button>
        </div>

        {/* Result row — visible after job created */}
        {expJob && (
          <>
            <hr style={{ borderColor: '#f1f5f9', margin: '18px 0' }} />
            <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
              {/* Job meta */}
              <div className="detail-info-row mb-0" style={{ flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="detail-info-label" style={{ width: 'auto' }}>Job ID</span>
                  <span className="detail-info-val tabular" style={{ fontFamily: 'monospace', fontSize: 12.5 }}>
                    {String(expJob.id).slice(0, 8)}…
                  </span>
                  <Badge value={expJob.status ?? 'PROCESSING'} />
                </div>
                {expJob.expiresAt && (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Berlaku hingga {fmtDateTime(expJob.expiresAt)}
                  </div>
                )}
              </div>

              {/* Download */}
              <button
                type="button"
                className={`btn d-inline-flex align-items-center gap-2 ${expDone ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: 13.5, fontWeight: 600, borderRadius: 8, padding: '8px 18px' }}
                disabled={!expDone}
                onClick={dlExport}
              >
                <Download size={14} strokeWidth={2} />
                Download CSV
              </button>
            </div>

            {/* Status hints */}
            {expProcessing && (
              <div className="d-flex align-items-center gap-2 mt-3 px-3 py-2 rounded-3"
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12.5, color: '#1d4ed8' }}>
                <RefreshCw size={12} strokeWidth={2} className="exp-spinning" />
                Server sedang memproses data — halaman akan otomatis terupdate.
              </div>
            )}
            {expFailed && (
              <div className="d-flex align-items-center gap-2 mt-3 px-3 py-2 rounded-3"
                style={{ background: '#fff1f2', border: '1px solid #fecdd3', fontSize: 12.5, color: '#b91c1c' }}>
                <AlertCircle size={12} strokeWidth={2} />
                Export gagal. Coba ubah filter atau periode, lalu buat ulang.
              </div>
            )}
            {expDone && (
              <div className="d-flex align-items-center gap-2 mt-3 px-3 py-2 rounded-3"
                style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12.5, color: '#047857' }}>
                <Check size={12} strokeWidth={2.5} />
                File siap diunduh. Segera download sebelum kedaluwarsa.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Info strip ────────────────────────────────────────────────── */}
      <div className="d-flex align-items-start gap-2 mt-3 px-3 py-2 rounded-3"
        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
        <FileDown size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          File dihasilkan dalam format <b className="text-secondary">CSV UTF-8</b>.
          Download segera setelah status <b style={{ color: '#047857' }}>Selesai</b> karena file tersimpan sementara di server.
        </span>
      </div>

      {/* ── Import commit modal (logic preserved) ─────────────────────── */}
      {showCommit && (
        <Modal
          title="Commit Import"
          onClose={() => setShowCommit(false)}
          foot={
            <>
              <button className="btn btn-outline-secondary" onClick={() => setShowCommit(false)}>Batal</button>
              <button className="btn btn-primary" disabled={busy} onClick={commit}>{busy ? 'Memproses...' : 'Ya, Commit'}</button>
            </>
          }
        >
          <p>Data valid akan dimasukkan ke produksi. Tindakan ini tidak dapat dibatalkan. Lanjutkan?</p>
        </Modal>
      )}

      {/* Dead-code keeper — preserves all import-related logic for future re-enable */}
      {false && (
        <span
          data-ref={String(step + preview.length + browseRows.length + reviewRows.length + pending + _DECISIONS.length + _MERGE_FIELDS.length + _ROW_STATUSES.length)}
          onClick={() => {
            void validate(); void refreshStatus(); void browse('VALID'); void bulk('SKIP')
            void submitReview(); void cancel(); void loadReview()
            void dl(() => client.get(`/imports/${job?.id}/errors.csv`, { responseType: 'blob' }), 'e.csv')
            resetImport(); pick({ target: { files: null } } as ChangeEvent<HTMLInputElement>)
            setDecisions({}); setFields({}); setBrowseStatus('WARNING')
          }}
          hidden
        />
      )}
    </Layout>
  )
}
