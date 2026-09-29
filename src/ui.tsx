import { Children, cloneElement, isValidElement, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { STAGE_LABEL, ID_STATUS, formatTitik } from './utils'

export function Badge({ value }: { value: string | null | undefined }) {
  const map: Record<string, string> = {
    HOT: 'b-red', WARM: 'b-amber', COLD: 'b-blue',
    NEW: 'b-purple', FOLLOW_UP: 'b-blue', OPPORTUNITY: 'b-cyan', QUOTATION: 'b-amber',
    NEGOTIATION: 'b-orange', CLOSING: 'b-pink', WON: 'b-green', LOST: 'b-red', MAINTENANCE: 'b-purple',
    LUNAS: 'b-green', OVERDUE: 'b-red', INVOICE: 'b-amber', TERTAGIH: 'b-blue', BELUM_DITAGIH: 'b-gray',
    OPEN: 'b-blue', BERJALAN: 'b-blue', CREATE_NEW: 'b-blue', VALIDATING: 'b-blue', COMMITTING: 'b-blue', PROCESSING: 'b-blue',
    VALID: 'b-green', DONE: 'b-green', SELESAI: 'b-green',
    INVALID: 'b-red', FAILED: 'b-red', CONFLICT: 'b-red', BATAL: 'b-red',
    WARNING: 'b-amber', DUPLICATE: 'b-purple', MERGE_SELECTED_FIELDS: 'b-purple', UPDATE_EXISTING: 'b-cyan', READY: 'b-cyan', STAGED: 'b-cyan',
  }
  const key = String(value ?? '—')
  const label = (STAGE_LABEL as Record<string, string>)[key]
    ?? ID_STATUS[key]
    ?? key.replace(/_/g, ' ')
  return <span className={`badge ${map[key] ?? 'b-gray'}`}>{label}</span>
}

export function Empty({ text = 'Belum ada data.', action }: { text?: string; action?: ReactNode }) {
  return (
    <div className="text-center text-muted py-5">
      <p className="mb-2">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="d-flex justify-content-center my-5" role="status" aria-label="Memuat">
      <div className="spinner-border text-primary" />
    </div>
  )
}

interface PagerProps {
  page: number
  pages: number
  total: number
  onGo: (n: number) => void
  pageSize?: number
}

export function Pager({ page, pages, total, onGo, pageSize = 25 }: PagerProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total ?? 0)
  return (
    <div
      className="d-flex align-items-center justify-content-between px-4 py-3 flex-wrap"
      style={{
        background: '#ffffff',
        borderTop: '1px solid #f1f5f9',
        fontSize: 13,
      }}
    >
      <button
        type="button"
        className="btn btn-link p-0 text-decoration-none"
        style={{
          color: page <= 1 ? '#cbd5e1' : '#64748b',
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
        disabled={page <= 1}
        onClick={() => onGo(page - 1)}
      >
        Previous
      </button>

      <span
        style={{
          color: '#64748b',
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 400,
        }}
      >
        {total === 0 ? '0 of 0' : `${from}-${to} of ${total}`}
      </span>

      <button
        type="button"
        className="btn btn-link p-0 text-decoration-none"
        style={{
          color: page >= pages ? '#cbd5e1' : '#0284c7',
          cursor: page >= pages ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
        disabled={page >= pages}
        onClick={() => onGo(page + 1)}
      >
        Next
      </button>
    </div>
  )
}

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  foot?: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, foot, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const titleId = `modal-${title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`
  return (
    <>
      <div className="modal-backdrop show" style={{ zIndex: 1050 }} onClick={onClose} />
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ zIndex: 1055 }}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${wide ? 'modal-lg' : ''}`} role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={titleId}>{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Tutup" />
            </div>
            <div className="modal-body">{children}</div>
            {foot && <div className="modal-footer">{foot}</div>}
          </div>
        </div>
      </div>
    </>
  )
}

interface FieldProps {
  label: string
  req?: boolean
  err?: string
  children: ReactNode
  col?: string
  /** Id unik untuk menghubungkan <label> dengan input (standar aksesibilitas Google). */
  htmlFor?: string
  /** Teks bantuan non-error (tidak berubah visual selain teks kecil). */
  hint?: string
}

let fieldSeq = 0

export function Field({ label, req, err, children, col = 'col-md-6', htmlFor, hint }: FieldProps) {
  const [autoId] = useState(() => `field-${++fieldSeq}`)
  const inputId = htmlFor ?? autoId
  const errId = err ? `${inputId}-error` : undefined
  const hintId = !err && hint ? `${inputId}-hint` : undefined
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`${col} mb-3`}>
      <label className="form-label" htmlFor={inputId}>
        {label}
        {req && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      {childrenWithA11y(children, inputId, describedBy, Boolean(err))}
      {err && (
        <div className="form-text text-danger" id={errId} role="alert" aria-live="assertive">
          {err}
        </div>
      )}
      {!err && hint && (
        <div className="form-text text-muted" id={hintId}>
          {hint}
        </div>
      )}
    </div>
  )
}

// Menyuntik id/aria ke elemen input tunggal; grup radio/checkbox dibiarkan
// apa adanya agar tampilan dan perilaku tidak berubah.
function childrenWithA11y(children: ReactNode, inputId: string, describedBy: string | undefined, invalid: boolean): ReactNode {
  const arr = Children.toArray(children)
  if (arr.length !== 1) return children
  const only = arr[0]
  if (!isValidElement(only)) return children
  const el = only as { type?: unknown; props?: Record<string, unknown> }
  const tag = typeof el.type === 'string' ? el.type : ''
  if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return children
  const prev = (el.props ?? {}) as Record<string, unknown>
  // Jangan timpa id yang sudah ada (mis. checkbox arsip).
  if (typeof prev.id === 'string' && prev.id) return children
  return cloneElement(only as never, {
    id: inputId,
    ...(invalid ? { 'aria-invalid': true } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  } as never)
}

interface RupiahInputProps {
  value: unknown
  onChange: (v: string) => void
  placeholder?: string
}

export function RupiahInput({ value, onChange, placeholder }: RupiahInputProps) {
  return (
    <input
      className="form-control"
      inputMode="numeric"
      value={formatTitik(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      placeholder={placeholder ?? 'Rp 0'}
    />
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, action, actions }: PageHeaderProps) {
  const act = actions ?? action
  return (
    <div className="d-flex justify-content-between align-items-start gap-3 mb-3 flex-wrap">
      <div>
        <h4 className="fw-bold mb-1">{title}</h4>
        {subtitle && <div className="text-muted">{subtitle}</div>}
      </div>
      {act && <div className="d-flex gap-2 flex-wrap">{act}</div>}
    </div>
  )
}

interface DetailHeaderProps {
  category: string
  title: string
  onBack?: () => void
  actions?: ReactNode
}

export function DetailHeader({ category, title, onBack, actions }: DetailHeaderProps) {
  return (
    <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
      <div className="d-flex align-items-center gap-2">
        {onBack && (
          <button className="btn btn-outline-secondary btn-sm" onClick={onBack} aria-label="Kembali">
            <ChevronLeft size={16} />
          </button>
        )}
        <span className="text-muted">{category}</span>
        <strong>{title}</strong>
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

interface KeyValRowProps {
  label: string
  value?: ReactNode
  children?: ReactNode
}

export function KeyValRow({ label, value, children }: KeyValRowProps) {
  return (
    <div className="row py-1 border-bottom g-0">
      <div className="col-sm-4 text-muted">{label}</div>
      <div className="col-sm-8 fw-semibold">{children ?? value ?? '—'}</div>
    </div>
  )
}

export function useDebounce<T>(v: T, ms = 350): T {
  const [dv, setDv] = useState<T>(v)
  useEffect(() => {
    const t = setTimeout(() => setDv(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return dv
}
