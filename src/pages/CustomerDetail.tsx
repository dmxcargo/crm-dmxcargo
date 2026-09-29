import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Pencil, RefreshCw, Power, Search, ArrowUpRight,
  Building2, MapPin, Phone, Mail, X, ArrowRight,
  UserCheck, CreditCard,
} from 'lucide-react'
import Layout from '../layout'
import { customerApi, prospectApi, masterApi, userApi, dealApi } from '../api/resources'
import { useAuth, useConfirm, useToast } from '../store/app'
import { rupiah, fmtDate, fmtDateTime, errMsg, isStaff, parseRupiah, rid } from '../utils'
import { Badge, Empty, Spinner, Modal, Field, RupiahInput, DetailHeader } from '../ui'
import FormAlert from '../components/FormAlert'
import { resolveActorName } from '../lib/actorName'
import { validateRepeatNew } from '../hooks/useDetailForms'
import { backendFieldErrors } from '../lib/formErrors'
import { CustomerModal } from './Customers'
import type {
  Customer, Deal, Prospect, MasterItem, Priority,
  CustomerTypeValue, User, ProspectContact, PaymentStatusValue,
} from '../types'

type PayHistRow = {
  id?: string
  dealId: string
  dealNumber: string
  fromStatus?: string
  toStatus?: string
  actorUserId?: string
  actorName?: string
  createdAt: string
}

export default function CustomerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const staff = isStaff(user)

  const [c, setC] = useState<Customer | null>(null)
  const [missing, setMissing] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [contacts, setContacts] = useState<ProspectContact[]>([])
  const [industries, setIndustries] = useState<MasterItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [payHist, setPayHist] = useState<PayHistRow[]>([])
  const [histFailed, setHistFailed] = useState(false)
  const [histDeletedAll, setHistDeletedAll] = useState(false)

  const [edit, setEdit] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [payDeal, setPayDeal] = useState<Deal | null>(null)

  // Top navigation tabs (Matching Reference: Summary, Financial, Billing, History)
  const [tab, setTab] = useState<'summary' | 'financial' | 'billing' | 'history'>('summary')

  // Search, filter, and pagination for deals
  const [dealSearch, setDealSearch] = useState('')
  const [dealFilter, setDealFilter] = useState<'all' | 'won' | 'open' | 'outstanding' | 'lunas'>('all')
  const [dealsPage, setDealsPage] = useState(1)
  const DEALS_PER_PAGE = 5

  // Search & filter for transaction history
  const [histSearch, setHistSearch] = useState('')
  const [histStatusFilter, setHistStatusFilter] = useState('')

  const load = async () => {
    if (!id) return
    try {
      const [customerData, industryData, userData] = await Promise.all([
        customerApi.get(id),
        masterApi.industries().catch(() => [] as MasterItem[]),
        userApi.list({ pageSize: 100 }).catch(() => ({ rows: [] as User[] })),
      ])

      setC(customerData)
      setIndustries(industryData)
      const uList = userData.rows || []
      setUsers(uList)

      // Fetch real customer deals from backend
      const dealList = await customerApi.deals(id)
      const dlArr = Array.isArray(dealList) ? dealList : []
      setDeals(dlArr)

      // Fetch real contacts from linked prospect if available
      const firstProspectId = dlArr[0]?.prospectId
      if (firstProspectId) {
        try {
          const pr = await prospectApi.get(firstProspectId)
          if (pr?.contacts && Array.isArray(pr.contacts)) {
            setContacts(pr.contacts)
          }
        } catch {
          // Ignore if prospect view restricted
        }
      }

      // Fetch real payment status change logs from backend for all customer deals
      let histFailed = 0
      let histDeleted = 0
      const histPromises = dlArr.slice(0, 20).map(async (deal) => {
        try {
          const ph = await dealApi.paymentHistory(deal.id)
          return (ph || []).map((entry) => {
            return {
              id: entry.id,
              dealId: deal.id,
              dealNumber: deal.dealNumber ?? deal.id.slice(0, 8),
              fromStatus: entry.fromStatus,
              toStatus: entry.toStatus,
              actorUserId: entry.actorUserId,
              actorName: resolveActorName(entry.actorUserId, user, uList),
              createdAt: entry.createdAt,
            }
          })
        } catch {
          histFailed += 1
          // Bedakan penyebab: prospek asal sudah dihapus (backend menolak
          // riwayat bila prospeknya terhapus) vs kegagalan lain.
          try {
            await prospectApi.get(deal.prospectId)
          } catch (pe) {
            if ((pe as { response?: { status?: number } })?.response?.status === 404) histDeleted += 1
          }
          return []
        }
      })

      const histories = await Promise.all(histPromises)
      const flat = histories.flat()
      flat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setPayHist(flat)
      setHistFailed(histFailed > 0)
      setHistDeletedAll(histFailed > 0 && flat.length === 0 && histDeleted === histFailed)
      if (histFailed > 0 && dlArr.length > 0) {
        if (flat.length === 0 && histDeleted === histFailed) {
          toast.warning(
            `Riwayat pembayaran (${histFailed} transaksi) tidak tersedia karena prospek asalnya sudah dihapus. Data transaksi tetap tampil.`,
          )
        } else if (flat.length === 0) {
          toast.warning(
            `Riwayat pembayaran (${histFailed} transaksi) gagal dimuat. Data transaksi tetap tampil — muat ulang halaman untuk mencoba lagi.`,
          )
        } else {
          toast.warning(
            `Sebagian riwayat pembayaran (${histFailed} transaksi) gagal dimuat. Data yang tampil mungkin belum lengkap.`,
          )
        }
      }
    } catch (e) {
      const err = e as { response?: { status?: number } }
      if (err?.response?.status === 404) setMissing(true)
      else toast.error(errMsg(e, 'Gagal memuat data customer.'))
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const toggle = async () => {
    if (!c) return
    const to = c.active === false
    const ok = await confirm({
      title: to ? 'Aktifkan Customer' : 'Nonaktifkan Customer',
      message: `${to ? 'Aktifkan' : 'Nonaktifkan'} "${c.accountName}"? Data riwayat tetap tersimpan.`,
      confirmLabel: 'Ya, Lanjutkan',
      danger: !to,
    })
    if (!ok) return
    try {
      await customerApi.update(c.id, { isActive: to, version: c.version })
      toast.success(to ? 'Customer berhasil diaktifkan.' : 'Customer berhasil dinonaktifkan.')
      load()
    } catch (e) {
      toast.error(errMsg(e, 'Gagal mengubah status customer.'))
    }
  }

  if (missing) {
    return (
      <Layout title="Detail Customer">
        <div className="card shadow-sm">
          <div className="card-body">
            <Empty
              text="Customer tidak ditemukan."
              action={
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => nav('/customers')}>
                  Kembali ke Daftar
                </button>
              }
            />
          </div>
        </div>
      </Layout>
    )
  }

  if (!c) {
    return (
      <Layout title="Detail Customer">
        <Spinner />
      </Layout>
    )
  }

  // Pure real backend calculations
  const won = deals.filter((d) => d.status === 'WON')
  const openDeals = deals.filter((d) => d.status === 'OPEN')
  const totalClosing = won.reduce((a, d) => a + Number(d.closingValue ?? 0), 0)
  const outstandingDeals = deals.filter((d) => ['INVOICE', 'TERTAGIH', 'OVERDUE'].includes(d.paymentStatus ?? ''))
  const totalOutstanding = outstandingDeals.reduce(
    (a, d) => a + Number(d.closingValue ?? d.quotationValue ?? d.potentialValue ?? 0),
    0
  )
  const lunasDeals = deals.filter((d) => d.paymentStatus === 'LUNAS')

  // Real filtered deals
  const filteredDeals = deals.filter((d) => {
    if (dealFilter === 'won' && d.status !== 'WON') return false
    if (dealFilter === 'open' && d.status !== 'OPEN') return false
    if (dealFilter === 'outstanding' && !['INVOICE', 'TERTAGIH', 'OVERDUE'].includes(d.paymentStatus ?? '')) return false
    if (dealFilter === 'lunas' && d.paymentStatus !== 'LUNAS') return false

    if (!dealSearch.trim()) return true
    const s = dealSearch.trim().toLowerCase()
    const ownerName = users.find((u) => u.id === d.closingOwnerId)?.name ?? ''
    return (
      (d.dealNumber ?? '').toLowerCase().includes(s) ||
      (d.quotationNumber ?? '').toLowerCase().includes(s) ||
      ownerName.toLowerCase().includes(s)
    )
  })

  // Pagination for deals table (Reference matching)
  const totalDealPages = Math.max(1, Math.ceil(filteredDeals.length / DEALS_PER_PAGE))
  const pagedDeals = filteredDeals.slice((dealsPage - 1) * DEALS_PER_PAGE, dealsPage * DEALS_PER_PAGE)

  // Real filtered transaction history
  const filteredHist = payHist.filter((h) => {
    if (histStatusFilter && h.toStatus !== histStatusFilter) return false
    if (!histSearch.trim()) return true
    const s = histSearch.trim().toLowerCase()
    return (
      (h.dealNumber ?? '').toLowerCase().includes(s) ||
      (h.fromStatus ?? '').toLowerCase().includes(s) ||
      (h.toStatus ?? '').toLowerCase().includes(s) ||
      (h.actorName ?? '').toLowerCase().includes(s)
    )
  })

  return (
    <Layout title={c.accountName}>
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <DetailHeader
        category="Customer"
        title={c.accountName}
        onBack={() => nav('/customers')}
        actions={
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn-green-action"
              onClick={() => setRepeat(true)}
              title="Buat repeat order transaksi baru"
            >
              <RefreshCw size={14} /> + New Repeat Order
            </button>
            {staff && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                style={{ borderRadius: 8, padding: '7px 14px', fontSize: 13 }}
                onClick={() => setEdit(true)}
              >
                <Pencil size={13} className="me-1" /> Ubah Data
              </button>
            )}
            {staff && (
              <button
                type="button"
                className={`btn ${c.active === false ? 'btn-outline-secondary' : 'btn-outline-danger'} btn-sm`}
                style={{ borderRadius: 8, padding: '7px 14px', fontSize: 13 }}
                onClick={toggle}
              >
                <Power size={13} className="me-1" /> {c.active === false ? 'Aktifkan' : 'Nonaktifkan'}
              </button>
            )}
          </div>
        }
      />

      {/* ── 1. TOP SEGMENTED PILL TABS (Reference Style) ────────── */}
      <div className="detail-nav-pills">
        <button
          type="button"
          className={`detail-nav-pill-btn ${tab === 'summary' ? 'active' : ''}`}
          onClick={() => setTab('summary')}
        >
          Summary
        </button>
        <button
          type="button"
          className={`detail-nav-pill-btn ${tab === 'financial' ? 'active' : ''}`}
          onClick={() => setTab('financial')}
        >
          Financial ({deals.length})
        </button>
        <button
          type="button"
          className={`detail-nav-pill-btn ${tab === 'billing' ? 'active' : ''}`}
          onClick={() => setTab('billing')}
        >
          Billing &amp; Invoice
        </button>
        <button
          type="button"
          className={`detail-nav-pill-btn ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          Transaction History ({payHist.length})
        </button>
      </div>

      {/* ── 2. METRIC / STAT BANNER (Exact Reference Style) ──────── */}
      <div className="detail-stat-banner">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>
            Total Outstanding -{' '}
            <b className="text-danger fw-bold tabular fs-5">{rupiah(totalOutstanding)}</b>
          </span>
          <span className="text-muted d-none d-sm-inline">|</span>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Total Belanja (LTV):{' '}
            <b className="text-dark fw-bold tabular">{rupiah(totalClosing)}</b>
          </span>
          <span className="text-muted d-none d-sm-inline">·</span>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Deal Won:{' '}
            <b className="text-success fw-bold tabular">{won.length}</b> dari {deals.length} transaksi
          </span>
        </div>
        <span className={`badge ${c.active === false ? 'b-red' : 'b-green'}`}>
          {c.active === false ? 'Nonaktif' : 'Pelanggan Aktif'}
        </span>
      </div>

      {/* ── 3. TAB CONTENT ──────────────────────────────────────── */}

      {/* TAB 1: SUMMARY (RINGKASAN PROFIL & KONTAK) */}
      {tab === 'summary' && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-lg-8">
            <div className="detail-summary-card h-100">
              <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                <Building2 size={16} className="text-primary" /> Profil Pelanggan
              </h6>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="detail-info-row">
                    <span className="detail-info-label">Nama Akun</span>
                    <span className="detail-info-val fw-bold text-dark">{c.accountName}</span>
                  </div>
                  <div className="detail-info-row">
                    <span className="detail-info-label">Bidang Industri</span>
                    <span className="detail-info-val">
                      {industries.find((x) => x.code === c.industryCode)?.label ?? c.industryCode ?? '—'}
                    </span>
                  </div>
                  <div className="detail-info-row">
                    <span className="detail-info-label">
                      <MapPin size={13} className="me-1" /> Kota &amp; Provinsi
                    </span>
                    <span className="detail-info-val">
                      {[c.city, c.province].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                </div>

                <div className="col-12 col-md-6 border-start-md">
                  <div className="detail-info-row">
                    <span className="detail-info-label">
                      <Phone size={13} className="me-1" /> No. Telepon
                    </span>
                    <span className="detail-info-val tabular">
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
                    </span>
                  </div>
                  <div className="detail-info-row">
                    <span className="detail-info-label">
                      <Mail size={13} className="me-1" /> Alamat Email
                    </span>
                    <span className="detail-info-val text-truncate">{c.email || '—'}</span>
                  </div>
                  <div className="detail-info-row">
                    <span className="detail-info-label">Status Akun</span>
                    <span className="detail-info-val">
                      <span className={`badge ${c.active === false ? 'b-red' : 'b-green'}`}>
                        {c.active === false ? 'Nonaktif' : 'Aktif'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Real Contacts from Prospect */}
              <div className="mt-4 pt-3 border-top">
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2" style={{ fontSize: 13.5 }}>
                  <UserCheck size={15} className="text-secondary" /> Kontak PIC Perusahaan
                </h6>
                {contacts.length === 0 ? (
                  <p className="text-muted small mb-0">Belum ada data kontak PIC tersimpan pada prospek klien ini.</p>
                ) : (
                  <div className="table-responsive mt-2">
                    <table className="table table-sm table-borderless align-middle mb-0" style={{ fontSize: 12.5 }}>
                      <thead className="text-secondary border-bottom">
                        <tr>
                          <th>Nama PIC</th>
                          <th>Jabatan</th>
                          <th>No. Kontak</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((contact) => (
                          <tr key={contact.id}>
                            <td className="fw-semibold text-dark">{contact.name}</td>
                            <td className="text-muted">{contact.position || '—'}</td>
                            <td className="tabular">
                              {contact.phone ? (
                                <a
                                  href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="tbl-link"
                                >
                                  {contact.phone}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="text-muted">{contact.email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="detail-summary-card h-100">
              <h6 className="fw-bold text-dark mb-3">Aksi Cepat Transaksi</h6>
              <p className="text-secondary small mb-3">
                Buat repeat order untuk klien ini. Transaksi baru otomatis tertaut ke profil riwayat pelanggan ini.
              </p>
              <button
                type="button"
                className="btn btn-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2"
                style={{ borderRadius: 8, padding: '9px 16px', fontWeight: 600 }}
                onClick={() => setRepeat(true)}
              >
                <RefreshCw size={15} /> Buat Repeat Order
              </button>
              {deals[0] && (
                <div className="border rounded p-3 mt-3 bg-light">
                  <small className="text-muted fw-bold text-uppercase d-block" style={{ fontSize: 10.5 }}>
                    Transaksi Terakhir
                  </small>
                  <div className="fw-semibold text-dark mt-1" style={{ fontSize: 13.5 }}>
                    {deals[0].dealNumber ?? 'Deal Terakhir'}
                  </div>
                  <div className="text-secondary tabular small mt-1">
                    {deals[0].closingDate ? fmtDate(deals[0].closingDate) : '—'} •{' '}
                    <span className="fw-bold text-dark">
                      {rupiah(deals[0].closingValue ?? deals[0].quotationValue)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Badge value={deals[0].paymentStatus ?? 'BELUM_DITAGIH'} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL & DEALS (Exact Reference Structure) */}
      {(tab === 'financial' || tab === 'summary') && (
        <div className="mb-4">
          {/* Sub-toolbar: Segmented sub-tabs on left, Search input on right */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div className="segmented-dark-tabs">
              <button
                type="button"
                className={`segmented-dark-btn ${dealFilter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setDealFilter('all')
                  setDealsPage(1)
                }}
              >
                Semua Deal ({deals.length})
              </button>
              <button
                type="button"
                className={`segmented-dark-btn ${dealFilter === 'won' ? 'active' : ''}`}
                onClick={() => {
                  setDealFilter('won')
                  setDealsPage(1)
                }}
              >
                Won ({won.length})
              </button>
              <button
                type="button"
                className={`segmented-dark-btn ${dealFilter === 'open' ? 'active' : ''}`}
                onClick={() => {
                  setDealFilter('open')
                  setDealsPage(1)
                }}
              >
                Berjalan ({openDeals.length})
              </button>
              <button
                type="button"
                className={`segmented-dark-btn ${dealFilter === 'outstanding' ? 'active' : ''}`}
                onClick={() => {
                  setDealFilter('outstanding')
                  setDealsPage(1)
                }}
              >
                Belum Lunas ({outstandingDeals.length})
              </button>
            </div>

            <div className="input-group" style={{ width: 260 }}>
              <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderRadius: '50rem 0 0 50rem' }}>
                <Search size={14} />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                style={{ borderRadius: '0 50rem 50rem 0', fontSize: 12.5 }}
                placeholder="Cari no. deal / quotation..."
                value={dealSearch}
                onChange={(e) => {
                  setDealSearch(e.target.value)
                  setDealsPage(1)
                }}
              />
              {dealSearch && (
                <button
                  type="button"
                  className="input-group-text bg-white border-start-0 text-muted"
                  onClick={() => {
                    setDealSearch('')
                    setDealsPage(1)
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Clean Data Table (Exact Reference Style) */}
          <div className="table-card">
            {filteredDeals.length === 0 ? (
              <Empty
                text={
                  dealSearch
                    ? `Tidak ditemukan transaksi dengan kata kunci "${dealSearch}".`
                    : 'Belum ada transaksi pada kategori ini.'
                }
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setRepeat(true)}
                  >
                    <RefreshCw size={13} className="me-1" /> Buat Repeat Order
                  </button>
                }
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table-clean">
                    <thead>
                      <tr>
                        <th>No. Deal</th>
                        <th>Quotation</th>
                        <th>Status Deal</th>
                        <th>Status Bayar</th>
                        <th>Sales PIC</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Nilai Penawaran</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Nilai Closing</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Tanggal Closing</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedDeals.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <span className="tbl-link">{d.dealNumber ?? d.id.slice(0, 8)}</span>
                          </td>
                          <td>
                            <span className="text-secondary tabular" style={{ fontSize: 12.5 }}>
                              {d.quotationNumber || '—'}
                            </span>
                          </td>
                          <td>
                            <Badge value={d.status} />
                          </td>
                          <td>
                            <Badge value={d.paymentStatus ?? 'BELUM_DITAGIH'} />
                          </td>
                          <td style={{ fontSize: 12.5 }}>
                            {users.find((u) => u.id === d.closingOwnerId)?.name ?? '—'}
                          </td>
                          <td className="tabular text-end text-muted" style={{ whiteSpace: 'nowrap' }}>
                            {rupiah(d.quotationValue ?? d.potentialValue)}
                          </td>
                          <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                            {rupiah(d.closingValue)}
                          </td>
                          <td className="tabular text-secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            {fmtDate(d.closingDate)}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div className="d-inline-flex align-items-center justify-content-end" style={{ gap: 10 }}>
                              <button
                                type="button"
                                className="btn-orange-action"
                                onClick={() => d.prospectId && nav(`/prospects/${d.prospectId}`)}
                                title="Buka detail prospek deal ini"
                              >
                                Buka Prospek <ArrowUpRight size={12} />
                              </button>
                              {staff && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  style={{ borderRadius: 6, padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                  onClick={() => setPayDeal(d)}
                                  title="Perbarui status pembayaran"
                                >
                                  <CreditCard size={12} /> Update Bayar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer / Pagination (Clearly Visible & High Contrast) */}
                <div className="d-flex align-items-center justify-content-between px-3 py-2.5 border-top bg-light" style={{ borderRadius: '0 0 10px 10px' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      borderRadius: 6,
                      padding: '5px 16px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: dealsPage <= 1 ? '#64748b' : '#0f172a',
                      background: dealsPage <= 1 ? '#f1f5f9' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      opacity: dealsPage <= 1 ? 0.7 : 1,
                      cursor: dealsPage <= 1 ? 'not-allowed' : 'pointer',
                      boxShadow: dealsPage <= 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                    disabled={dealsPage <= 1}
                    onClick={() => setDealsPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <span className="fw-semibold text-secondary" style={{ fontSize: 12.5 }}>
                    {filteredDeals.length > 0
                      ? `${(dealsPage - 1) * DEALS_PER_PAGE + 1}-${Math.min(dealsPage * DEALS_PER_PAGE, filteredDeals.length)} of ${filteredDeals.length}`
                      : '0 of 0'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      borderRadius: 6,
                      padding: '5px 16px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: dealsPage >= totalDealPages ? '#64748b' : '#0f172a',
                      background: dealsPage >= totalDealPages ? '#f1f5f9' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      opacity: dealsPage >= totalDealPages ? 0.7 : 1,
                      cursor: dealsPage >= totalDealPages ? 'not-allowed' : 'pointer',
                      boxShadow: dealsPage >= totalDealPages ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                    disabled={dealsPage >= totalDealPages}
                    onClick={() => setDealsPage((p) => Math.min(totalDealPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BILLING & INVOICE */}
      {tab === 'billing' && (
        <div className="mb-4">
          <div className="row g-3 mb-3">
            <div className="col-6 col-md-3">
              <div className="card shadow-sm p-3 border-0 bg-white">
                <span className="text-muted small fw-bold">TOTAL OUTSTANDING</span>
                <span className="fs-5 fw-bold text-danger tabular mt-1">{rupiah(totalOutstanding)}</span>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card shadow-sm p-3 border-0 bg-white">
                <span className="text-muted small fw-bold">TOTAL TERBAYAR (LUNAS)</span>
                <span className="fs-5 fw-bold text-success tabular mt-1">{rupiah(totalClosing)}</span>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card shadow-sm p-3 border-0 bg-white">
                <span className="text-muted small fw-bold">TAGIHAN MENUNGGU</span>
                <span className="fs-5 fw-bold text-primary tabular mt-1">{outstandingDeals.length} Transaksi</span>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card shadow-sm p-3 border-0 bg-white">
                <span className="text-muted small fw-bold">TRANSAKSI LUNAS</span>
                <span className="fs-5 fw-bold text-dark tabular mt-1">{lunasDeals.length} Transaksi</span>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="p-3 border-bottom bg-light d-flex justify-content-between align-items-center">
              <h6 className="fw-bold text-dark mb-0">Rincian Status Pembayaran per Transaksi</h6>
            </div>
            <div className="table-responsive">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>No. Deal</th>
                    <th>Quotation</th>
                    <th>Status Deal</th>
                    <th>Status Pembayaran</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Nilai Tagihan</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Tanggal Transaksi</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="tbl-link">{d.dealNumber ?? d.id.slice(0, 8)}</span>
                      </td>
                      <td>{d.quotationNumber || '—'}</td>
                      <td>
                        <Badge value={d.status} />
                      </td>
                      <td>
                        <Badge value={d.paymentStatus ?? 'BELUM_DITAGIH'} />
                      </td>
                      <td className="tabular text-end fw-semibold text-dark" style={{ whiteSpace: 'nowrap' }}>
                        {rupiah(d.closingValue ?? d.quotationValue ?? d.potentialValue)}
                      </td>
                      <td className="tabular text-secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(d.closingDate)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="d-inline-flex align-items-center justify-content-end" style={{ gap: 8 }}>
                          {staff && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              style={{ padding: '3px 9px', fontSize: 12, borderRadius: 6 }}
                              onClick={() => setPayDeal(d)}
                            >
                              Update Status
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            style={{ padding: '3px 9px', fontSize: 12, borderRadius: 6 }}
                            onClick={() => d.prospectId && nav(`/prospects/${d.prospectId}`)}
                          >
                            Detail Prospek
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. TRANSACTION HISTORY SECTION (Exact Reference Lower Section) ── */}
      <div className="mt-4 pt-2">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h5 className="fw-bold text-dark mb-0" style={{ letterSpacing: -0.2 }}>
            Transaction History
          </h5>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="input-group" style={{ width: 220 }}>
              <span className="input-group-text bg-white border-end-0 text-muted" style={{ borderRadius: '50rem 0 0 50rem' }}>
                <Search size={13} />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                style={{ borderRadius: '0 50rem 50rem 0', fontSize: 12 }}
                placeholder="Search..."
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
              />
            </div>

            <select
              className="form-select form-select-sm"
              style={{ width: 140, borderRadius: '50rem', fontSize: 12 }}
              value={histStatusFilter}
              onChange={(e) => setHistStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="BELUM_DITAGIH">BELUM DITAGIH</option>
              <option value="INVOICE">INVOICE</option>
              <option value="TERTAGIH">TERTAGIH</option>
              <option value="LUNAS">LUNAS</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>
        </div>

        <div className="table-card">
          {filteredHist.length === 0 ? (
            <div className="p-4 text-center text-muted" style={{ fontSize: 13, background: '#ffffff' }}>
              {histDeletedAll
                ? 'Riwayat pembayaran tidak tersedia karena prospek asal sudah dihapus.'
                : histFailed && deals.length > 0 && !histSearch.trim() && !histStatusFilter
                  ? 'Riwayat pembayaran gagal dimuat. Muat ulang halaman untuk mencoba lagi.'
                  : histSearch.trim() || histStatusFilter
                    ? `Tidak ada riwayat yang cocok dengan filter.`
                    : 'Belum ada riwayat pembayaran tercatat.'}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Waktu Catat</th>
                    <th>No. Deal</th>
                    <th>Status Sebelumnya</th>
                    <th style={{ width: 30, textAlign: 'center' }}></th>
                    <th>Status Diperbarui</th>
                    <th>Petugas / User</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHist.map((h, i) => (
                    <tr key={i}>
                      <td className="tabular text-secondary" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(h.createdAt)}
                      </td>
                      <td>
                        <span className="tbl-link">{h.dealNumber}</span>
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
                      <td className="text-secondary" style={{ fontSize: 12.5 }}>
                        {h.actorName || 'Sistem'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────── */}
      {edit && (
        <CustomerModal
          initial={c}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false)
            load()
          }}
        />
      )}

      {repeat && (
        <RepeatDlg
          customer={c}
          onClose={() => setRepeat(false)}
          onDone={() => {
            setRepeat(false)
            load()
          }}
        />
      )}

      {payDeal && (
        <PayDlg
          deal={payDeal}
          onClose={() => setPayDeal(null)}
          onDone={() => {
            setPayDeal(null)
            load()
          }}
        />
      )}
    </Layout>
  )
}

// ── PayDlg: Ubah Status Pembayaran Deal ─────────────────────────────
interface PayDlgProps {
  deal: Deal
  onClose: () => void
  onDone: () => void
}

function PayDlg({ deal, onClose, onDone }: PayDlgProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const [st, setSt] = useState<PaymentStatusValue>(deal.paymentStatus ?? 'BELUM_DITAGIH')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (st === deal.paymentStatus) {
      toast.error('Status belum berubah. Pilih status pembayaran yang berbeda dulu, lalu klik Simpan.')
      return
    }
    const ok = await confirm({
      title: 'Update Status Pembayaran',
      message: `Ubah status pembayaran transaksi "${deal.dealNumber ?? deal.id.slice(0, 8)}" dari ${deal.paymentStatus ?? 'BELUM_DITAGIH'} menjadi ${st}?`,
      confirmLabel: 'Ya, Simpan',
    })
    if (!ok) return
    setBusy(true)
    try {
      await dealApi.payment(deal.id, st)
      toast.success(`Status pembayaran berhasil diubah menjadi ${st}.`)
      onDone()
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memperbarui status pembayaran. Muat ulang lalu coba lagi.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Ubah Status Pembayaran"
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </>
      }
    >
      <div className="mb-3 p-2 bg-light rounded">
        <small className="text-muted d-block" style={{ fontSize: 11 }}>TRANSAKSI DEAL</small>
        <span className="fw-bold text-dark">{deal.dealNumber ?? deal.id}</span>
      </div>
      <Field label="Pilih Status Pembayaran">
        <select
          className="form-select"
          value={st}
          onChange={(e) => setSt(e.target.value as PaymentStatusValue)}
        >
          {(['BELUM_DITAGIH', 'INVOICE', 'TERTAGIH', 'LUNAS', 'OVERDUE'] as PaymentStatusValue[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  )
}

// ── RepeatDlg: Buat Repeat Order ──────────────────────────────────
interface RepeatDlgProps {
  customer: Customer
  onClose: () => void
  onDone: () => void
}

interface RepeatForm {
  city: string
  phone: string
  potentialValue: string
  notes: string
  sourceCode: string
  priority: Priority
  customerType: CustomerTypeValue
}

function RepeatDlg({ customer, onClose, onDone }: RepeatDlgProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'new' | 'link'>('new')
  const [q, setQ] = useState<string>(customer.accountName ?? '')
  const [rows, setRows] = useState<Prospect[]>([])
  const [sel, setSel] = useState<string>('')
  const [sources, setSources] = useState<MasterItem[]>([])
  const [f, setF] = useState<RepeatForm>({
    city: customer.city ?? '',
    phone: customer.phone ?? '',
    potentialValue: '',
    notes: '',
    sourceCode: '',
    priority: 'HOT',
    customerType: 'B2B',
  })
  const [busy, setBusy] = useState(false)
  const keyRef = useRef<string | null>(null)
  if (!keyRef.current) keyRef.current = rid()

  useEffect(() => {
    masterApi
      .sources()
      .then((s: MasterItem[]) => {
        const arr: MasterItem[] = s
        setSources(arr)
        setF((p) => ({
          ...p,
          sourceCode:
            p.sourceCode ||
            (arr.find((x: MasterItem) => /DATABASE|EST/i.test(x.code))?.code ??
              arr.find((x: MasterItem) => (x as MasterItem & { active?: boolean }).active !== false)?.code ??
              ''),
        }))
      })
      .catch(() => {})
  }, [])

  const search = async () => {
    try {
      const res = await prospectApi.list({ q, pageSize: 10 })
      setRows(res.rows)
      if (res.rows[0]) setSel(res.rows[0].id)
    } catch (e) {
      toast.error(errMsg(e, 'Gagal mencari prospek.'))
    }
  }

  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({})

  const submit = async () => {
    if (mode === 'link') {
      if (!sel) {
        toast.error('Pilih dulu prospek yang akan dihubungkan. Cari dengan kata kunci, lalu klik salah satu hasil.')
        return
      }
      const chosen = rows.find((r) => r.id === sel)
      const ok = await confirm({
        title: 'Hubungkan Repeat Order',
        message: `Hubungkan prospek "${chosen?.accountName ?? 'terpilih'}" sebagai repeat order "${customer.accountName}"?`,
        confirmLabel: 'Ya, Hubungkan',
      })
      if (!ok) return
      setBusy(true)
      try {
        await customerApi.repeatOrder(customer.id, sel)
        toast.success('Repeat order berhasil dihubungkan.')
        onDone()
      } catch (e) {
        toast.error(errMsg(e, 'Gagal menghubungkan repeat order. Prospek mungkin sudah terhubung — muat ulang.'))
      } finally {
        setBusy(false)
      }
      return
    }

    const check = validateRepeatNew(f.sourceCode, f.phone || String(customer.phone ?? ''), f.potentialValue)
    setFormErrors(check)
    if (Object.keys(check).length > 0) {
      toast.error(Object.values(check)[0] as string)
      return
    }
    const val = parseRupiah(f.potentialValue)
    if (val !== undefined && val < 0) {
      toast.error('Nilai Potensi tidak boleh negatif. Isi 0 atau lebih. Contoh: 100.000.000.')
      return
    }
    const ok = await confirm({
      title: 'Buat Repeat Order Baru',
      message: `Buat prospek & repeat order baru untuk "${customer.accountName}"?`,
      confirmLabel: 'Ya, Buat',
    })
    if (!ok) return
    setBusy(true)
    try {
      const p = await prospectApi.create(
        {
          accountName: customer.accountName,
          city: f.city || undefined,
          phone: f.phone || customer.phone || '-',
          potentialValue: val,
          notes: f.notes || undefined,
          sourceCode: f.sourceCode,
          priority: f.priority,
          customerType: f.customerType,
        },
        keyRef.current || undefined
      )
      await customerApi.repeatOrder(customer.id, p.id)
      toast.success('Repeat order & prospek baru berhasil dibuat.')
      onDone()
    } catch (e) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) {
        setFormErrors(server)
        toast.error('Server menolak isian. Periksa pesan merah di form.')
      } else {
        toast.error(errMsg(e, 'Gagal membuat repeat order. Periksa koneksi lalu coba lagi.'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Repeat Order Pelanggan"
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Menyimpan...' : 'Simpan Repeat Order'}
          </button>
        </>
      }
    >
      <div className="btn-group w-100 mb-3" role="group">
        <button
          type="button"
          className={`btn btn-sm ${mode === 'new' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setMode('new')}
        >
          Buat Prospek Baru
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'link' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => {
            setMode('link')
            if (rows.length === 0) search()
          }}
        >
          Hubungkan Prospek Ada
        </button>
      </div>

      {mode === 'new' ? (
        <div className="row g-2">
          <div className="col-12">
            <FormAlert errors={formErrors} title="Belum bisa membuat repeat order." />
          </div>
          <div className="col-12">
            <Field label="Nama Account Pelanggan">
              <input className="form-control" value={customer.accountName} disabled />
            </Field>
          </div>
          <div className="col-12 col-md-6">
            <Field label="No. Telepon / WA" err={formErrors.phone}>
              <input
                className="form-control"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
                placeholder="08..."
              />
            </Field>
          </div>
          <div className="col-12 col-md-6">
            <Field label="Kota">
              <input
                className="form-control"
                value={f.city}
                onChange={(e) => setF({ ...f, city: e.target.value })}
                placeholder="Kota domisili"
              />
            </Field>
          </div>
          <div className="col-12 col-md-6">
            <Field label="Sumber Prospek" req err={formErrors.sourceCode}>
              <select
                className="form-select"
                value={f.sourceCode}
                onChange={(e) => setF({ ...f, sourceCode: e.target.value })}
              >
                <option value="">Pilih Sumber...</option>
                {sources.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="col-12 col-md-6">
            <Field label="Prioritas">
              <select
                className="form-select"
                value={f.priority}
                onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}
              >
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COLD">COLD</option>
              </select>
            </Field>
          </div>
          <div className="col-12">
            <Field label="Nilai Potensi Repeat Order" err={formErrors.potentialValue}>
              <RupiahInput
                value={f.potentialValue}
                onChange={(v) => setF({ ...f, potentialValue: v })}
                placeholder="0"
              />
            </Field>
          </div>
          <div className="col-12">
            <Field label="Catatan Transaksi">
              <textarea
                className="form-control"
                rows={2}
                value={f.notes}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
                placeholder="Catatan kebutuhan repeat order..."
              />
            </Field>
          </div>
        </div>
      ) : (
        <div>
          <div className="d-flex gap-2 mb-3">
            <input
              className="form-control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Saring kata kunci..."
            />
            <button type="button" className="btn btn-outline-secondary" onClick={search}>
              Saring
            </button>
          </div>
          {rows.map((r) => (
            <label key={r.id} className="form-check d-flex gap-2 p-2" style={{ fontSize: 13 }}>
              <input
                className="form-check-input"
                type="radio"
                name="repeat-prospect"
                checked={sel === r.id}
                onChange={() => setSel(r.id)}
              />
              <span className="form-check-label">
                {r.accountName} — {r.city ?? '—'} — {r.stage}
              </span>
            </label>
          ))}
          {rows.length === 0 && (
            <p className="muted">Tidak ada prospek cocok. Coba kata kunci lain atau buat prospek baru.</p>
          )}
        </div>
      )}
    </Modal>
  )
}
