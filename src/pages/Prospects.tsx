import { useState } from 'react'
import {
  Plus, Search, SlidersHorizontal, X, RotateCcw,
  Building2, MapPin, Calendar, User as UserIcon, ChevronDown,
} from 'lucide-react'
import Layout from '../layout'
import type { Prospect, User, MasterItem } from '../types'
import { rupiah, fmtDate, STAGES, STAGE_LABEL, PRIORITIES } from '../utils'
import { Badge, Empty, Spinner, Pager, Modal, Field, RupiahInput, useDebounce, PageHeader } from '../ui'
import FormAlert from '../components/FormAlert'
import { useProspectList, useProspectForm, resetFilters, countAdvFilters } from '../hooks/useProspects'

interface ProspectModalProps {
  initial: Prospect | null
  sources: MasterItem[]
  onClose: () => void
  onSaved: () => void
}

export function ProspectModal({ initial, sources, onClose, onSaved }: ProspectModalProps) {
  const { form, set, errors, busy, dup, industries, save } = useProspectForm(initial)

  return (
    <Modal title={initial ? 'Ubah Prospek' : 'Tambah Prospek'} onClose={onClose} wide foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save(onSaved)}>{busy ? 'Menyimpan...' : 'Simpan Prospek'}</button></>}>
      <FormAlert errors={errors} />
      {dup.length > 0 && <div className="alert alert-warning" role="alert">Ditemukan {dup.length} kemungkinan duplikat. Periksa kembali nomor / email / nama sebelum menyimpan.</div>}
      <div className="row g-3">
        <Field label="Nama Account" req err={errors.accountName}><input className="form-control" value={form.accountName} onChange={(e) => set('accountName', e.target.value)} placeholder="Contoh: PT Maju Jaya Abadi" autoComplete="organization" /></Field>
        <Field label="PIC" err={errors.picName}><input className="form-control" value={form.picName ?? ''} onChange={(e) => set('picName', e.target.value)} placeholder="Nama penanggung jawab" autoComplete="off" /></Field>
        <Field label="Jabatan PIC" err={errors.picPosition}><input className="form-control" value={form.picPosition ?? ''} onChange={(e) => set('picPosition', e.target.value)} placeholder="Contoh: Manager Procurement" /></Field>
        <Field label="No. WhatsApp" req={!initial} err={errors.phone} hint={!initial ? 'Nomor aktif untuk follow-up. Contoh: 0812-3456-7890.' : undefined}><input className="form-control" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="0812..." inputMode="tel" autoComplete="tel" /></Field>
        <Field label="Email" err={errors.email}><input className="form-control" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="nama@perusahaan.com" inputMode="email" autoComplete="email" /></Field>
        <Field label="Kota" err={errors.city}><input className="form-control" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} placeholder="Contoh: Jakarta" autoComplete="address-level2" /></Field>
        <Field label="Provinsi" err={errors.province}><input className="form-control" value={form.province ?? ''} onChange={(e) => set('province', e.target.value)} placeholder="Contoh: DKI Jakarta" /></Field>
        <Field label="Industri" err={errors.industryCode}>
          <select className="form-select" value={form.industryCode ?? ''} onChange={(e) => set('industryCode', e.target.value)}>
            <option value="">— Pilih —</option>
            {industries.map((x: MasterItem) => <option key={x.code} value={x.code}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="Sumber Prospek" req err={errors.sourceCode}>
          <select className="form-select" value={form.sourceCode} onChange={(e) => set('sourceCode', e.target.value)}>
            <option value="">— Pilih —</option>
            {(Array.isArray(sources) ? sources : []).filter((s: MasterItem) => s.active !== false).map((s: MasterItem) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Priority" req err={errors.priority}>
          <div className="d-flex gap-3 flex-wrap">{PRIORITIES.map((p) => <div className="form-check" key={p}><input className="form-check-input" type="radio" name="priority" checked={form.priority === p} onChange={() => set('priority', p)} /><label className="form-check-label">{p}</label></div>)}</div>
        </Field>
        <Field label="Customer Type" req={!initial} err={errors.customerType}>
          <div className="d-flex gap-3 flex-wrap">{['B2B', 'B2C'].map((t) => <div className="form-check" key={t}><input className="form-check-input" type="radio" name="customerType" disabled={!!initial} checked={form.customerType === t} onChange={() => set('customerType', t as 'B2B' | 'B2C')} /><label className="form-check-label">{t}</label></div>)}</div>
        </Field>
        <Field label="Potential Value" err={errors.potentialValue}><RupiahInput value={form.potentialValue} onChange={(v) => set('potentialValue', v)} /></Field>
        <Field label="Catatan" err={errors.notes}>
          <textarea className="form-control" rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Catatan kebutuhan / progres awal prospek..." />
        </Field>
      </div>
    </Modal>
  )
}

const SORTS = [
  ['entryDate:desc', 'Terbaru'], ['entryDate:asc', 'Terlama'],
  ['accountName:asc', 'Nama A-Z'], ['accountName:desc', 'Nama Z-A'], ['potentialValue:desc', 'Nilai Terbesar'],
  ['nextFollowUpAt:asc', 'FU Terdekat'], ['updatedAt:desc', 'Diubah Terakhir'],
]

export default function Prospects() {
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const { rows, meta, f, setF, loading, sources, users, staff, load, del, arch, nav } = useProspectList(dq)
  const [modal, setModal] = useState<Prospect | null>(null)

  const delRow = (row: Prospect) => void del(row, meta.page, load)
  const archRow = (row: Prospect) => void arch(row, meta.page, load)

  const [showAdv, setShowAdv] = useState(false)

  const resetAllFilters = () => {
    setQ('')
    setF(resetFilters())
  }

  const advCount = countAdvFilters(f)

  const hasAnyFilter = Boolean(
    q || f.stage || f.priority || advCount > 0
  )

  return (
    <Layout title="Prospect">
      <PageHeader
        title="Prospect"
        subtitle="Daftar seluruh prospek penjualan, progres tahapan pipeline, dan PIC kontak"
        action={
          <button className="btn btn-primary" onClick={() => setModal({} as Prospect)}>
            <Plus size={15} /> Tambah Prospek
          </button>
        }
      />

      {/* ── 1. Modern Stage Segmented Control / Pill Tabs ────── */}
      <div className="filter-stage-tabs">
        <button
          type="button"
          className={`filter-stage-pill ${!f.stage ? 'active' : ''}`}
          onClick={() => setF({ ...f, stage: '' })}
        >
          Semua Stage
        </button>
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            className={`filter-stage-pill ${f.stage === s ? 'active' : ''}`}
            onClick={() => setF({ ...f, stage: f.stage === s ? '' : s })}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      {/* ── 2. Unified Filter Card ────────────────────────────── */}
      <div className="filter-card">
        {/* Row 1: Search + Quick Priority + Sort + Filter Lanjutan + Reset */}
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
              placeholder="Cari nama akun, PIC, telepon, email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="input-group-text bg-white border-start-0 text-muted"
                style={{ borderRadius: '0 8px 8px 0', cursor: 'pointer' }}
                onClick={() => setQ('')}
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Priority Filter */}
          <select
            className="form-select"
            style={{ width: 150, borderRadius: 8, fontSize: 13 }}
            value={f.priority}
            onChange={(e) => setF({ ...f, priority: e.target.value })}
          >
            <option value="">Semua Prioritas</option>
            <option value="HOT">🔥 Prioritas HOT</option>
            <option value="WARM">⚡ Prioritas WARM</option>
            <option value="COLD">❄️ Prioritas COLD</option>
          </select>

          {/* Sort Dropdown */}
          <select
            className="form-select"
            style={{ width: 165, borderRadius: 8, fontSize: 13 }}
            value={f.sort}
            onChange={(e) => setF({ ...f, sort: e.target.value })}
          >
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                Urut: {l}
              </option>
            ))}
          </select>

          {/* Advanced Filter Toggle Button */}
          <button
            type="button"
            className={`btn ${showAdv || advCount > 0 ? 'btn-primary' : 'btn-outline-secondary'} btn-sm d-inline-flex align-items-center gap-1`}
            style={{ borderRadius: 8, padding: '7px 13px', fontSize: 13 }}
            onClick={() => setShowAdv(!showAdv)}
          >
            <SlidersHorizontal size={14} /> Filter
            {advCount > 0 && (
              <span
                className="badge bg-white text-primary fw-bold"
                style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10 }}
              >
                {advCount}
              </span>
            )}
            <ChevronDown
              size={14}
              style={{
                transform: showAdv ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {/* Reset All Filters Button */}
          {hasAnyFilter && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              style={{ borderRadius: 8, padding: '6px 12px', fontSize: 12.5 }}
              onClick={resetAllFilters}
              title="Kembalikan semua filter ke bawaan"
            >
              <RotateCcw size={13} /> Reset Filter
            </button>
          )}
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdv && (
          <div className="filter-adv-box">
            <div className="row g-3">
              <div className="col-12 col-sm-6 col-lg-3">
                <label className="form-label small fw-semibold text-secondary mb-1 d-flex align-items-center gap-1">
                  <Building2 size={13} /> Sumber Prospek
                </label>
                <select
                  className="form-select form-select-sm"
                  style={{ borderRadius: 6, fontSize: 12.5 }}
                  value={f.sourceCode}
                  onChange={(e) => setF({ ...f, sourceCode: e.target.value })}
                >
                  <option value="">Semua Sumber</option>
                  {(Array.isArray(sources) ? sources : []).map((s: MasterItem) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {staff && (
                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="form-label small fw-semibold text-secondary mb-1 d-flex align-items-center gap-1">
                    <UserIcon size={13} /> Sales PIC
                  </label>
                  <select
                    className="form-select form-select-sm"
                    style={{ borderRadius: 6, fontSize: 12.5 }}
                    value={f.owner}
                    onChange={(e) => setF({ ...f, owner: e.target.value })}
                  >
                    <option value="">Semua Owner</option>
                    {users.map((u: User) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-12 col-sm-6 col-lg-3">
                <label className="form-label small fw-semibold text-secondary mb-1 d-flex align-items-center gap-1">
                  <MapPin size={13} /> Kota Domisili
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  style={{ borderRadius: 6, fontSize: 12.5 }}
                  value={f.city}
                  onChange={(e) => setF({ ...f, city: e.target.value })}
                  placeholder="Contoh: Jakarta, Surabaya..."
                />
              </div>

              <div className="col-12 col-sm-6 col-lg-3">
                <label className="form-label small fw-semibold text-secondary mb-1 d-flex align-items-center gap-1">
                  <Calendar size={13} /> Rentang Tanggal Masuk
                </label>
                <div className="d-flex align-items-center gap-1">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ borderRadius: 6, fontSize: 12 }}
                    value={f.dateFrom}
                    onChange={(e) => setF({ ...f, dateFrom: e.target.value })}
                    title="Tanggal dari"
                  />
                  <span className="text-muted small">-</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ borderRadius: 6, fontSize: 12 }}
                    value={f.dateTo}
                    onChange={(e) => setF({ ...f, dateTo: e.target.value })}
                    title="Tanggal sampai"
                  />
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mt-3 pt-2 border-top flex-wrap gap-2">
              <div className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="includeArchivedCheck"
                  checked={f.includeArchived}
                  onChange={(e) => setF({ ...f, includeArchived: e.target.checked })}
                />
                <label
                  className="form-check-label small text-secondary"
                  htmlFor="includeArchivedCheck"
                  style={{ cursor: 'pointer' }}
                >
                  Tampilkan prospek yang telah diarsipkan
                </label>
              </div>

              {advCount > 0 && (
                <button
                  type="button"
                  className="btn btn-link btn-sm text-secondary p-0 text-decoration-none"
                  style={{ fontSize: 12 }}
                  onClick={() =>
                    setF({
                      ...f,
                      sourceCode: '',
                      owner: '',
                      city: '',
                      dateFrom: '',
                      dateTo: '',
                      includeArchived: false,
                    })
                  }
                >
                  Reset Filter Lanjutan
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 3. Active Filters Pills / Chips ───────────────────── */}
        {hasAnyFilter && (
          <div className="d-flex align-items-center gap-2 flex-wrap mt-2 pt-2 border-top">
            <span className="text-secondary small fw-medium" style={{ fontSize: 12 }}>
              Filter aktif:
            </span>

            {f.stage && (
              <span className="filter-chip">
                Stage: <b>{STAGE_LABEL[f.stage as keyof typeof STAGE_LABEL] || f.stage}</b>
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => setF({ ...f, stage: '' })}
                  title="Hapus filter stage"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {f.priority && (
              <span className="filter-chip">
                Prioritas: <b>{f.priority}</b>
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => setF({ ...f, priority: '' })}
                  title="Hapus filter prioritas"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {f.sourceCode && (
              <span className="filter-chip">
                Sumber: <b>{sources.find((s) => s.code === f.sourceCode)?.label ?? f.sourceCode}</b>
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => setF({ ...f, sourceCode: '' })}
                  title="Hapus filter sumber"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {f.owner && (
              <span className="filter-chip">
                Owner: <b>{users.find((u) => u.id === f.owner)?.name ?? f.owner}</b>
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => setF({ ...f, owner: '' })}
                  title="Hapus filter owner"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {f.city && (
              <span className="filter-chip">
                Kota: <b>{f.city}</b>
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => setF({ ...f, city: '' })}
                  title="Hapus filter kota"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {(f.dateFrom || f.dateTo) && (
              <span className="filter-chip">
                Tanggal: <b>{f.dateFrom || '...'} s/d {f.dateTo || '...'}</b>
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => setF({ ...f, dateFrom: '', dateTo: '' })}
                  title="Hapus filter tanggal"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {f.includeArchived && (
              <span className="filter-chip">
                Termasuk Arsip
                <button
                  type="button"
                  className="filter-chip-remove"
                  onClick={() => setF({ ...f, includeArchived: false })}
                  title="Hapus filter arsip"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-danger text-decoration-none ms-1"
              style={{ fontSize: 11.5, fontWeight: 500 }}
              onClick={resetAllFilters}
            >
              Hapus Semua
            </button>
          </div>
        )}
      </div>
      <div className="table-card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty
            text={
              q
                ? `Tidak ditemukan hasil untuk "${q}". Coba kata kunci lain atau longgarkan filter.`
                : 'Belum ada data prospek. Klik Tambah Prospek untuk membuat yang pertama.'
            }
            action={
              !q && (
                <button className="btn btn-primary btn-sm" onClick={() => setModal({} as Prospect)}>
                  <Plus size={14} /> Tambah Prospek
                </button>
              )
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>No</th>
                  <th>Account Name</th>
                  <th>PIC</th>
                  <th>Kota</th>
                  <th>Stage</th>
                  <th>Priority</th>
                  <th>Tipe</th>
                  {staff && <th>Sales</th>}
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Nilai Potensi</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Next FU</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: Prospect, idx: number) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => nav(`/prospects/${r.id}`)}
                  >
                    <td
                      style={{
                        textAlign: 'center',
                        width: 36,
                        color: '#64748b',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {(meta.page - 1) * 25 + idx + 1}
                    </td>
                    <td>
                      <div>
                        <span className="tbl-link d-inline-block text-truncate" style={{ maxWidth: 170 }}>{r.accountName}</span>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{r.phone || '—'}</div>
                      </div>
                    </td>
                    <td>
                      <span className="d-inline-block text-truncate" style={{ maxWidth: 95 }}>{r.picName || '—'}</span>
                    </td>
                    <td>
                      <span className="d-inline-block text-truncate" style={{ maxWidth: 85 }}>{r.city || '—'}</span>
                    </td>
                    <td>
                      <Badge value={r.stage} />
                    </td>
                    <td>
                      <Badge value={r.priority} />
                    </td>
                    <td>
                      <span className="chip-f" style={{ fontSize: 11, padding: '2px 6px' }}>{r.customerType ?? '—'}</span>
                    </td>
                    {staff && (
                      <td style={{ fontSize: 12, color: '#475569' }}>
                        <span className="d-inline-block text-truncate" style={{ maxWidth: 90 }}>
                          {users.find((u: User) => u.id === r.ownerUserId)?.name ?? '—'}
                        </span>
                      </td>
                    )}
                    <td
                      className="tabular fw-medium text-end"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {rupiah(r.potentialValue)}
                    </td>
                    <td
                      className="tabular text-secondary"
                      style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      {fmtDate(r.nextFollowUpAt)}
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
                          className="tbl-icon-btn"
                          title="Lihat Detail Prospek"
                          aria-label="Lihat Detail Prospek"
                          onClick={() => nav(`/prospects/${r.id}`)}
                        >
                          <i className="bi bi-eye" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="tbl-icon-btn"
                          title="Ubah Prospek"
                          aria-label="Ubah Prospek"
                          onClick={() => setModal(r)}
                        >
                          <i className="bi bi-pencil" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="tbl-icon-btn"
                          title={r.archived ? 'Buka Arsip' : 'Arsip Prospek'}
                          aria-label={r.archived ? 'Buka Arsip' : 'Arsip Prospek'}
                          onClick={() => archRow(r)}
                        >
                          <i className={r.archived ? 'bi bi-box-arrow-up' : 'bi bi-archive'} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="tbl-icon-btn text-danger"
                          title="Hapus Prospek"
                          aria-label="Hapus Prospek"
                          onClick={() => delRow(r)}
                        >
                          <i className="bi bi-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={meta.page} pages={meta.pages} total={meta.total} onGo={load} />
      </div>
      {modal !== null && <ProspectModal initial={modal.id ? modal : null} sources={sources} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(meta.page) }} />}
    </Layout>
  )
}
