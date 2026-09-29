import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye } from 'lucide-react'
import Layout from '../layout'
import { customerApi, masterApi } from '../api/resources'
import { useAuth, useToast } from '../store/app'
import { errMsg, isStaff } from '../utils'
import { Empty, Spinner, Pager, Modal, Field, useDebounce, PageHeader } from '../ui'
import FormAlert from '../components/FormAlert'
import { useCustomerForm } from '../hooks/useCustomers'
import type { Customer, MasterItem } from '../types'

export default function Customers() {
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const staff = isStaff(user)
  const [rows, setRows] = useState<Customer[]>([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [sortC, setSortC] = useState('name-asc')
  const [industries, setIndustries] = useState<MasterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Customer | null>(null)
  const dq = useDebounce(q)

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const r = await customerApi.list({ q: dq || undefined, page, pageSize: 25 })
      setRows(r.rows); setMeta({ page: r.page, pages: r.pages, total: r.total })
    } catch (e) { toast.error(errMsg(e, 'Gagal memuat customer.')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(1) }, [dq])
  useEffect(() => { masterApi.industries().then((s: MasterItem[]) => setIndustries(Array.isArray(s) ? s : [])).catch(() => {}) }, [])
  const indLabel = (code: string | null | undefined) => industries.find((x: MasterItem) => x.code === code)?.label ?? code ?? '—'
  const filtered = rows
    .filter((c: Customer) => !city.trim() || (c.city ?? '').toLowerCase().includes(city.trim().toLowerCase()))
    .sort((a: Customer, b: Customer) => sortC === 'name-desc' ? String(b.accountName).localeCompare(String(a.accountName)) : sortC === 'city' ? String(a.city ?? '').localeCompare(String(b.city ?? '')) : String(a.accountName).localeCompare(String(b.accountName)))

  return (
    <Layout title="Customer">
      <PageHeader
        title="Customer"
        action={
          staff && (
            <button className="btn btn-primary" onClick={() => setModal({} as Customer)}>
              <Plus size={15} /> Tambah Customer
            </button>
          )
        }
      />

      <div className="filter-card">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="input-group" style={{ flex: '1 1 240px', minWidth: 220, maxWidth: 360 }}>
            <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderRadius: '8px 0 0 8px' }}>
              <Search size={15} />
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              style={{ fontSize: 13, borderRadius: '0 8px 8px 0' }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, telepon, email..."
            />
          </div>
          <input
            className="form-control"
            style={{ width: 160, borderRadius: 8, fontSize: 13 }}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter Kota..."
          />
          <select
            className="form-select"
            style={{ width: 160, borderRadius: 8, fontSize: 13 }}
            value={sortC}
            onChange={(e) => setSortC(e.target.value)}
          >
            <option value="name-asc">Urut: Nama A-Z</option>
            <option value="name-desc">Urut: Nama Z-A</option>
            <option value="city">Urut: Kota A-Z</option>
          </select>
          {(q || city) && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              style={{ borderRadius: 8, padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => { setQ(''); setCity('') }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <Empty
            text="Belum ada data customer. Customer terbentuk otomatis dari deal Won."
            action={
              staff && (
                <button className="btn btn-primary btn-sm" onClick={() => setModal({} as Customer)}>
                  <Plus size={13} /> Tambah Customer
                </button>
              )
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th style={{ width: 50, textAlign: 'center' }}>No</th>
                  <th>Account Name</th>
                  <th>Kontak</th>
                  <th>Kota &amp; Provinsi</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right', width: 80 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: Customer, idx: number) => (
                  <tr key={c.id} className="clickable" onClick={() => nav(`/customers/${c.id}`)}>
                    <td
                      style={{
                        textAlign: 'center',
                        width: 50,
                        color: '#64748b',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {(meta.page - 1) * 25 + idx + 1}
                    </td>
                    <td>
                      <div>
                        <span className="tbl-link">{c.accountName}</span>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>{indLabel(c.industryCode)}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5 }} className="tabular">
                        {c.phone ?? '—'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.email ?? ''}</div>
                    </td>
                    <td>
                      {c.city ?? '—'}
                      {c.province ? `, ${c.province}` : ''}
                    </td>
                    <td>
                      <span className={`badge ${c.active === false ? 'b-red' : 'b-green'}`}>
                        {c.active === false ? 'Nonaktif' : 'Pelanggan Aktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="tbl-icon-btn"
                        title="Lihat Detail Customer"
                        onClick={() => nav(`/customers/${c.id}`)}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={meta.page} pages={meta.pages} total={meta.total} onGo={load} />
      </div>
      {modal !== null && <CustomerModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(meta.page) }} />}
    </Layout>
  )
}

interface CustomerModalProps {
  initial: Customer | null
  onClose: () => void
  onSaved: () => void
}

export function CustomerModal({ initial, onClose, onSaved }: CustomerModalProps) {
  const { f, set, errors, busy, save } = useCustomerForm(initial, onSaved)
  return (
    <Modal title={initial ? 'Ubah Customer' : 'Tambah Customer'} onClose={onClose} foot={<><button className="btn btn-outline-secondary" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? 'Menyimpan...' : 'Simpan'}</button></>}>
      <FormAlert errors={errors} />
      <div className="row g-3">
        <Field label="Nama Account" req err={errors.accountName}><input className="form-control" value={f.accountName} onChange={(e) => set({ accountName: e.target.value })} placeholder="Contoh: PT Maju Jaya Abadi" autoComplete="organization" /></Field>
        <Field label="Telepon" err={errors.phone} hint="Nomor aktif. Minimal 9 digit. Contoh: 0812-3456-7890."><input className="form-control" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="08..." inputMode="tel" autoComplete="tel" /></Field>
        <Field label="Email" err={errors.email}><input className="form-control" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="nama@perusahaan.com" inputMode="email" autoComplete="email" /></Field>
        <Field label="Kota" err={errors.city}><input className="form-control" value={f.city} onChange={(e) => set({ city: e.target.value })} placeholder="Contoh: Jakarta" autoComplete="address-level2" /></Field>
        <Field label="Provinsi" err={errors.province}><input className="form-control" value={f.province} onChange={(e) => set({ province: e.target.value })} placeholder="Contoh: DKI Jakarta" /></Field>
        {initial && <Field label="Status"><select className="form-select" value={String(f.isActive)} onChange={(e) => set({ isActive: e.target.value === 'true' })}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></Field>}
      </div>
    </Modal>
  )
}
