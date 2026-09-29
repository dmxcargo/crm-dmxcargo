import { useEffect, useRef, useState } from 'react'
import Layout from '../layout'
import { userApi, masterApi, auditApi, roleApi } from '../api/resources'
import { useAuth, useConfirm, useToast } from '../store/app'
import { fmtDateTime, errMsg, rid } from '../utils'
import { Empty, Spinner, Pager, Modal, Field, Badge, useDebounce, PageHeader } from '../ui'
import FormAlert from '../components/FormAlert'
import { validateMasterForm, validateUserForm } from '../hooks/useAdminForms'
import { backendFieldErrors } from '../lib/formErrors'
import { resolveActorName } from '../lib/actorName'
import { Plus, Search, Layers, Database, Activity } from 'lucide-react'
import type { User, MasterItem } from '../types'
import type { AuditLogEntry, RoleInfo } from '../api/resources'

// ─────────────────────────────────────────────────────────────────────────────
// 1. USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export function Users() {
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<User[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<User | null>(null)
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const dq = useDebounce(q)

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const r = await userApi.list({ q: dq || undefined, page, pageSize: 25 })
      setRows(r.rows)
      setMeta({ page: r.page, pages: r.pages, total: r.total })
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat user.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [dq])
  useEffect(() => { roleApi.list().then((r: RoleInfo[]) => setRoles(r)).catch(() => {}) }, [])

  const toggle = async (u: User) => {
    const ok = await confirm({
      title: u.isActive ? 'Nonaktifkan User' : 'Aktifkan User',
      message: `${u.isActive ? 'Nonaktifkan' : 'Aktifkan'} "${u.name}"?`,
      confirmLabel: 'Ya, Lanjutkan',
      danger: u.isActive
    })
    if (!ok) return
    try {
      await userApi.update(u.id, { isActive: !u.isActive, version: u.version })
      toast.success(u.isActive ? 'User berhasil dinonaktifkan.' : 'User berhasil diaktifkan.')
      load()
    } catch (e) {
      toast.error(errMsg(e, 'Gagal mengubah status user.'))
    }
  }

  const revoke = async (u: User) => {
    const ok = await confirm({
      title: 'Cabut Sesi',
      message: `Cabut semua sesi "${u.name}"?`,
      confirmLabel: 'Ya, Cabut',
      danger: true
    })
    if (!ok) return
    try {
      await userApi.revokeAll(u.id)
      toast.success('Semua sesi berhasil dicabut.')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal mencabut sesi.'))
    }
  }

  return (
    <Layout title="User Management">
      <PageHeader
        title="User Management"
        subtitle="Kelola akun pengguna, peran hak akses, dan status sesi"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setModal({} as User)}>
            <Plus size={14} /> Tambah User
          </button>
        }
      />

      <div className="filter-card mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="input-group" style={{ maxWidth: 360 }}>
            <span className="input-group-text bg-white border-end-0 text-muted">
              <Search size={16} />
            </span>
            <input
              className="form-control border-start-0"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, username, email..."
            />
            {q && (
              <button
                type="button"
                className="btn btn-link text-muted p-0 px-2"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 5 }}
                onClick={() => setQ('')}
              >
                &times;
              </button>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="chip-f">{meta.total} User</span>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => load(meta.page)}>
              Muat Ulang
            </button>
          </div>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty
            text={q ? `Tidak ditemukan hasil untuk "${q}".` : 'Belum ada user. Tambahkan akun sales atau admin baru.'}
            action={
              !q && (
                <button className="btn btn-primary btn-sm" onClick={() => setModal({} as User)}>
                  <Plus size={14} /> Tambah User
                </button>
              )
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="tbl-link" style={{ cursor: 'pointer' }} onClick={() => setModal(u)}>
                        {u.name}
                      </span>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{u.email}</div>
                    </td>
                    <td>{u.username}</td>
                    <td>
                      <Badge value={u.role} />
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'b-green' : 'b-red'}`}>
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="d-inline-flex align-items-center gap-1 justify-content-end" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
                          onClick={() => setModal(u)}
                        >
                          Ubah
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
                          onClick={() => toggle(u)}
                        >
                          {u.isActive ? 'Nonaktif' : 'Aktif'}
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
                          onClick={() => revoke(u)}
                        >
                          Cabut Sesi
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

      {roles.length > 0 && (
        <div className="detail-summary-card" style={{ marginTop: 20 }}>
          <h5 className="fw-bold text-dark mb-1" style={{ fontSize: 14 }}>
            Matriks Hak Akses Peran
          </h5>
          <p className="text-muted mb-3" style={{ fontSize: 12 }}>
            Daftar kewenangan operasional per peran pengguna
          </p>
          <div className="row g-3">
            {roles.map((r, i) => (
              <div className="col-12 col-md-4" key={i}>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    background: '#ffffff',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="fw-bold text-dark" style={{ fontSize: 13 }}>
                      {r.role ?? r.name}
                    </span>
                    <Badge value={r.role ?? r.name} />
                  </div>
                  {r.description && (
                    <div className="text-muted mb-2" style={{ fontSize: 12, lineHeight: 1.4 }}>
                      {r.description}
                    </div>
                  )}
                  <div className="d-flex flex-wrap gap-1 mt-auto pt-2">
                    {(Array.isArray(r.permissions) ? r.permissions : []).slice(0, 8).map((p: { name?: string } | string, j: number) => (
                      <span key={j} className="chip-f" style={{ fontSize: 10.5 }}>
                        {String(typeof p === 'string' ? p : (p.name ?? p))}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal !== null && (
        <UserModal
          initial={(modal as User).id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </Layout>
  )
}

interface UserModalProps {
  initial: User | null
  onClose: () => void
  onSaved: () => void
}

function UserModal({ initial, onClose, onSaved }: UserModalProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const [f, setF] = useState({
    name: initial?.name ?? '',
    username: initial?.username ?? '',
    email: initial?.email ?? '',
    password: '',
    role: initial?.role ?? 'SALES'
  })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const keyRef = useRef<string | null>(null)
  if (!keyRef.current) keyRef.current = rid()

  const save = async () => {
    const check = validateUserForm(f, Boolean(initial))
    setErrors(check)
    if (Object.keys(check).length > 0) {
      const first = Object.values(check)[0] as string
      toast.error(Object.keys(check).length === 1 ? first : `Ada ${Object.keys(check).length} kolom yang perlu diperbaiki. ${first}`)
      return
    }
    const ok = await confirm({
      title: initial ? 'Ubah User' : 'Tambah User',
      message: initial
        ? `Simpan perubahan user "${f.name.trim()}"?`
        : `Tambah user baru "${f.name.trim()}" dengan peran ${f.role}?`,
      confirmLabel: 'Ya, Simpan'
    })
    if (!ok) return
    setBusy(true)
    try {
      if (initial) {
        const b: { name: string; email: string; role: string; version: number; password?: string } = {
          name: f.name.trim(),
          email: f.email.trim(),
          role: f.role,
          version: initial.version
        }
        if (f.password) b.password = f.password
        await userApi.update(initial.id, b)
      } else {
        await userApi.create(
          { name: f.name.trim(), username: f.username.trim(), email: f.email.trim(), password: f.password, role: f.role },
          keyRef.current ?? undefined
        )
      }
      toast.success(initial ? 'User berhasil diperbarui.' : 'User berhasil ditambahkan.')
      onSaved()
    } catch (e) {
      const server = backendFieldErrors(e)
      if (Object.keys(server).length > 0) {
        setErrors(server)
        toast.error('Server menolak isian. Periksa pesan merah di bawah kolom (mis. username/email sudah dipakai).')
      } else {
        toast.error(errMsg(e, 'Gagal menyimpan user. Username/email mungkin sudah dipakai — coba yang lain.'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Ubah User' : 'Tambah User'}
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Menyimpan...' : 'Simpan'}
          </button>
        </>
      }
    >
      <FormAlert errors={errors} title="Belum bisa menyimpan user." />
      <div className="row g-3">
        <Field label="Nama" req err={errors.name}>
          <input
            className="form-control"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Contoh: Budi Santoso"
            autoComplete="name"
          />
        </Field>
        <Field
          label="Username"
          req
          err={errors.username}
          hint={initial ? 'Username tidak bisa diubah setelah dibuat.' : 'Huruf kecil, tanpa spasi. Contoh: budi.sales.'}
        >
          <input
            className="form-control"
            disabled={!!initial}
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })}
            placeholder="budi.sales"
            autoComplete="username"
          />
        </Field>
        <Field label="Email" req err={errors.email}>
          <input
            className="form-control"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value.toLowerCase() })}
            placeholder="budi@perusahaan.com"
            inputMode="email"
            autoComplete="email"
          />
        </Field>
        <Field label="Role" req err={errors.role} hint="SALES: kelola prospek sendiri. BILLING/ADMIN: akses lebih luas.">
          <select
            className="form-select"
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value as User['role'] })}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="BILLING">BILLING</option>
            <option value="SALES">SALES</option>
          </select>
        </Field>
        <div className="col-12 mb-3">
          <label className="form-label" htmlFor="user-password">
            Password {!initial && <b>*</b>}
          </label>
          <input
            id="user-password"
            className="form-control"
            type="password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder={initial ? '(kosongkan jika tidak diubah)' : 'Minimal 12 karakter'}
            autoComplete={initial ? 'new-password' : 'new-password'}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'user-password-error' : undefined}
          />
          {errors.password ? (
            <div id="user-password-error" className="form-text text-danger" role="alert">
              {errors.password}
            </div>
          ) : (
            <div className="form-text text-muted">
              Minimal 12 karakter. Gunakan kombinasi huruf, angka, dan simbol.
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MASTER DATA
// ─────────────────────────────────────────────────────────────────────────────

type MasterGroup = 'sources' | 'industries' | 'reasons'
type MasterModalState = { code?: string; label?: string; active?: boolean; isActive?: boolean; group?: string }

export function Masters() {
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<string>('all')
  const [all, setAll] = useState<{ sources: MasterItem[]; industries: MasterItem[]; reasons: MasterItem[] }>({
    sources: [],
    industries: [],
    reasons: []
  })
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<MasterModalState | null>(null)
  const [search, setSearch] = useState('')

  const cfg: Record<MasterGroup, { list: (opts?: { all?: boolean }) => Promise<unknown>; create: (p: { code: string; label: string }) => Promise<unknown>; update: (code: string, p: { label?: string; isActive?: boolean }) => Promise<unknown>; title: string; desc: string }> = {
    sources: {
      list: masterApi.sources,
      create: masterApi.createSource,
      update: masterApi.updateSource,
      title: 'Sumber Prospek',
      desc: 'Kanal asal prospek seperti Website, Direct Sales, Referral, atau Iklan'
    },
    industries: {
      list: masterApi.industries,
      create: masterApi.createIndustry,
      update: masterApi.updateIndustry,
      title: 'Industri',
      desc: 'Sektor bisnis akun prospek seperti Logistik, Manufaktur, Ritel, atau F&B'
    },
    reasons: {
      list: masterApi.reasons,
      create: masterApi.createReason,
      update: masterApi.updateReason,
      title: 'Alasan Lost',
      desc: 'Katalog faktor kegagalan penutupan prospek seperti Harga, Fitur, atau Kompetitor'
    }
  }

  const isOn = (r: MasterItem & { isActive?: boolean }): boolean => (r.active ?? r.isActive ?? true)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, i, r] = await Promise.all([
        masterApi.sources({ all: true }),
        masterApi.industries({ all: true }),
        masterApi.reasons({ all: true })
      ])
      setAll({ sources: asArrM(s), industries: asArrM(i), reasons: asArrM(r) })
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat master data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const save = async (group: string, f: { code: string; label: string; isActive: boolean }) => {
    const g = group as MasterGroup
    const c = cfg[g]
    const modalCode = modal?.code
    const cur = modalCode ? all[g].find((x: MasterItem) => x.code === modalCode) : null
    if (cur && isOn(cur) && f.isActive === false) {
      const ok = await confirm({
        title: 'Nonaktifkan Master',
        message: `Nonaktifkan "${f.label}"? Kode ini ditolak untuk prospek baru, data lama tetap aman.`,
        confirmLabel: 'Ya, Nonaktifkan',
        danger: true
      })
      if (!ok) return
    }
    try {
      if (modal?.code) {
        await c.update(modal.code, { label: f.label, isActive: f.isActive })
      } else {
        await c.create({ code: f.code, label: f.label })
      }
      toast.success('Master data berhasil disimpan.')
      setModal(null)
      loadAll()
    } catch (e) {
      const server = backendFieldErrors(e)
      const first = Object.values(server)[0]
      toast.error(first ? `Gagal menyimpan: ${first}` : errMsg(e, 'Gagal menyimpan master data. Kode mungkin sudah dipakai — gunakan kode lain.'))
    }
  }

  const rows: MasterItem[] = tab === 'all' ? [] : all[tab as MasterGroup]
  const filtered = rows.filter((r: MasterItem) => {
    const s = search.trim().toLowerCase()
    return !s || `${r.code} ${r.label}`.toLowerCase().includes(s)
  })

  const tabDefs: Array<[string, string]> = [
    ['all', 'Semua'],
    ['sources', 'Sumber Prospek'],
    ['industries', 'Industri'],
    ['reasons', 'Alasan Lost']
  ]

  return (
    <Layout title="Master Data">
      <PageHeader
        title="Master Data"
        subtitle="Konfigurasi referensi sumber prospek, kategori industri, dan alasan lost deal"
        actions={
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={loadAll}>
              Muat Ulang
            </button>
            {tab !== 'all' && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal({ group: tab })}>
                <Plus size={14} /> Tambah Data
              </button>
            )}
          </div>
        }
      />

      <div className="filter-stage-tabs">
        {tabDefs.map(([v, l]) => {
          const count = v === 'all'
            ? all.sources.length + all.industries.length + all.reasons.length
            : all[v as MasterGroup]?.length ?? 0
          return (
            <button
              key={v}
              type="button"
              className={`filter-stage-pill ${tab === v ? 'active' : ''}`}
              onClick={() => { setTab(v); setSearch('') }}
            >
              <span>{l}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: tab === v ? '#0284c7' : '#e2e8f0',
                  color: tab === v ? '#ffffff' : '#475569',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <Spinner />
      ) : tab === 'all' ? (
        <div className="row g-3 mb-4">
          {(Object.entries(cfg) as Array<[MasterGroup, { title: string; desc: string }]>).map(([k, c]) => {
            const list = all[k]
            const activeItems = list.filter((x) => isOn(x)).length
            const inactiveItems = list.length - activeItems
            const icon = k === 'sources' ? <Layers size={20} className="text-primary" />
              : k === 'industries' ? <Database size={20} className="text-success" />
              : <Activity size={20} className="text-danger" />

            return (
              <div className="col-12 col-md-4" key={k}>
                <div
                  className="detail-summary-card h-100"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginBottom: 0
                  }}
                  onClick={() => setTab(k)}
                >
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {icon}
                    </div>
                    <span className="chip-f" style={{ fontSize: 11.5 }}>
                      Kelola Data &rarr;
                    </span>
                  </div>

                  <h5 className="fw-bold text-dark mb-1" style={{ fontSize: 15 }}>
                    {c.title}
                  </h5>
                  <p className="text-muted mb-3" style={{ fontSize: 12, minHeight: 34 }}>
                    {c.desc}
                  </p>

                  <div className="d-flex align-items-baseline gap-2 mb-2">
                    <span className="fs-2 fw-bold text-dark tabular">{list.length}</span>
                    <span className="text-muted" style={{ fontSize: 13 }}>data</span>
                  </div>

                  <div className="d-flex align-items-center gap-2 pt-2 border-top">
                    <span className="badge b-green" style={{ fontSize: 10.5 }}>
                      {activeItems} Aktif
                    </span>
                    {inactiveItems > 0 && (
                      <span className="badge b-gray" style={{ fontSize: 10.5 }}>
                        {inactiveItems} Nonaktif
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div className="filter-card mb-3">
            <div className="d-flex align-items-center gap-2 flex-wrap justify-content-between">
              <div className="input-group" style={{ maxWidth: 360 }}>
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Cari kode / label..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="btn btn-link text-muted p-0 px-2"
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 5 }}
                    onClick={() => setSearch('')}
                  >
                    &times;
                  </button>
                )}
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="chip-f">
                  {filtered.length} Data
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setModal({ group: tab })}
                >
                  <Plus size={14} /> Tambah Data
                </button>
              </div>
            </div>
          </div>

          <div className="table-card mb-4">
            {filtered.length === 0 ? (
              <Empty
                text={
                  search
                    ? `Tidak ada hasil untuk "${search}".`
                    : `Belum ada data ${cfg[tab as MasterGroup].title.toLowerCase()}. Klik Tambah untuk membuat yang pertama.`
                }
                action={
                  !search && (
                    <button className="btn btn-primary btn-sm" onClick={() => setModal({ group: tab })}>
                      <Plus size={14} /> Tambah Data
                    </button>
                  )
                }
              />
            ) : (
              <div className="table-responsive">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Label</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.code}
                        onDoubleClick={() => setModal({ ...r, group: tab })}
                        style={!isOn(r) ? { opacity: 0.65 } : undefined}
                      >
                        <td>
                          <span
                            className="tbl-link"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModal({ ...r, group: tab })}
                          >
                            {r.code}
                          </span>
                        </td>
                        <td>
                          <span className="fw-semibold text-dark">{r.label}</span>
                        </td>
                        <td>
                          <span className={`badge ${isOn(r) ? 'b-green' : 'b-red'}`}>
                            {isOn(r) ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
                            onClick={() => setModal({ ...r, group: tab })}
                          >
                            Ubah
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {modal !== null && (
        <MasterModal
          initial={modal.code ? modal : null}
          onClose={() => setModal(null)}
          onSave={(f: { code: string; label: string; isActive: boolean }) => save(modal.group ?? tab, f)}
        />
      )}
    </Layout>
  )
}

function asArrM(v: unknown): MasterItem[] {
  return Array.isArray(v) ? (v as MasterItem[]) : ((v as { data?: MasterItem[] })?.data ?? [])
}

interface MasterModalProps {
  initial: { code?: string; label?: string; active?: boolean; isActive?: boolean } | null
  onClose: () => void
  onSave: (f: { code: string; label: string; isActive: boolean }) => void
}

function MasterModal({ initial, onClose, onSave }: MasterModalProps) {
  const toast = useToast()
  const [f, setF] = useState({
    code: initial?.code ?? '',
    label: initial?.label ?? '',
    isActive: (initial?.active ?? initial?.isActive ?? true) as boolean
  })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  const submit = () => {
    const check = validateMasterForm({ code: f.code, label: f.label })
    if (initial) delete check.code
    setErrors(check)
    if (Object.keys(check).length > 0) {
      toast.error(Object.values(check)[0] as string)
      return
    }
    onSave(f)
  }

  return (
    <Modal
      title={initial ? 'Ubah Master' : 'Tambah Master'}
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            Simpan
          </button>
        </>
      }
    >
      <FormAlert errors={errors} title="Belum bisa menyimpan." />
      <div className="row g-3">
        <Field
          label="Kode"
          req
          err={errors.code}
          hint={initial ? 'Kode tidak bisa diubah setelah dibuat.' : 'Huruf kapital tanpa spasi. Contoh: SHOPEE.'}
        >
          <input
            className="form-control"
            disabled={!!initial}
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            placeholder="CONTOH_KODE"
          />
        </Field>
        <Field label="Label" req err={errors.label} hint="Nama yang tampil di dropdown. Contoh: Shopee.">
          <input
            className="form-control"
            value={f.label}
            onChange={(e) => setF({ ...f, label: e.target.value })}
            placeholder="Contoh: Shopee"
          />
        </Field>
        {initial && (
          <Field label="Status">
            <select
              className="form-select"
              value={String(f.isActive)}
              onChange={(e) => setF({ ...f, isActive: e.target.value === 'true' })}
            >
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </Field>
        )}
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

export function Audit() {
  const toast = useToast()
  const { user: me } = useAuth()
  const [rows, setRows] = useState<AuditLogEntry[]>([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const [f, setF] = useState({
    action: '',
    entity: '',
    actor: '',
    trace: '',
    from: '',
    to: '',
    pageSize: 25
  })
  const [users, setUsers] = useState<User[]>([])
  const [detail, setDetail] = useState<AuditLogEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    userApi.list({ pageSize: 100 }).then((u) => setUsers(u.rows)).catch(() => {})
  }, [])

  const actorName = (id?: string | null): string => resolveActorName(id, me, users)

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const r = await auditApi.list({ action: f.action || undefined, page, pageSize: f.pageSize })
      let list: AuditLogEntry[] = r.rows
      if (f.entity) list = list.filter((a) => String(a.entityType ?? '').toLowerCase() === f.entity.toLowerCase())
      if (f.actor) list = list.filter((a) => a.actorUserId === f.actor)
      if (f.trace) list = list.filter((a) => String(a.traceId ?? '').toLowerCase().includes(f.trace.toLowerCase()))
      if (f.from) list = list.filter((a) => String(a.createdAt ?? '') >= f.from)
      if (f.to) list = list.filter((a) => String(a.createdAt ?? '') <= `${f.to}T23:59:59`)
      setRows(list)
      setMeta({ page, pages: r.pages, total: r.total })
    } catch (e) {
      toast.error(errMsg(e, 'Gagal memuat audit log.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [f.action, f.pageSize])

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t)
      toast.success('Trace ID berhasil disalin.')
    } catch {
      toast.error('Gagal menyalin Trace ID.')
    }
  }

  const resetFilters = () => {
    setF({
      action: '',
      entity: '',
      actor: '',
      trace: '',
      from: '',
      to: '',
      pageSize: 25
    })
  }

  return (
    <Layout title="Audit Log">
      <PageHeader
        title="Audit Log"
        subtitle="Pencatatan riwayat aktivitas pengguna, perubahan data, dan jejak trace audit sistem"
      />

      <div className="filter-card mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <input
            className="form-control"
            style={{ width: 180, fontSize: 13 }}
            value={f.action}
            onChange={(e) => setF({ ...f, action: e.target.value })}
            placeholder="Aksi, cth: prospect.created"
          />
          <select
            className="form-select"
            style={{ width: 140, fontSize: 13 }}
            value={f.entity}
            onChange={(e) => setF({ ...f, entity: e.target.value })}
          >
            <option value="">Semua Entitas</option>
            {['prospect', 'deal', 'activity', 'followup', 'customer', 'user', 'target', 'import', 'export', 'auth', 'archive', 'master'].map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 160, fontSize: 13 }}
            value={f.actor}
            onChange={(e) => setF({ ...f, actor: e.target.value })}
          >
            <option value="">Semua Aktor</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <input
            className="form-control"
            style={{ width: 150, fontSize: 13 }}
            value={f.trace}
            onChange={(e) => setF({ ...f, trace: e.target.value })}
            placeholder="Trace ID"
          />
          <input
            className="form-control"
            style={{ width: 140, fontSize: 13 }}
            type="date"
            value={f.from}
            onChange={(e) => setF({ ...f, from: e.target.value })}
            title="Dari"
          />
          <input
            className="form-control"
            style={{ width: 140, fontSize: 13 }}
            type="date"
            value={f.to}
            onChange={(e) => setF({ ...f, to: e.target.value })}
            title="Sampai"
          />
          <select
            className="form-select"
            style={{ width: 90, fontSize: 13 }}
            value={f.pageSize}
            onChange={(e) => setF({ ...f, pageSize: Number(e.target.value) })}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => load(1)}>
            Terapkan
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty text="Belum ada audit log. Setiap perubahan data tercatat otomatis di sini." />
        ) : (
          <div className="table-responsive">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aktor</th>
                  <th>Aksi</th>
                  <th>Entitas</th>
                  <th>Trace ID</th>
                  <th style={{ textAlign: 'right' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.id ?? i}>
                    <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtDateTime(a.createdAt)}</td>
                    <td className="fw-semibold">{actorName(a.actorUserId)}</td>
                    <td>
                      <Badge value={a.action} />
                    </td>
                    <td>
                      <span className="badge b-gray">{a.entityType ?? '—'}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {a.traceId ? (
                        <>
                          <span className="tabular text-secondary fw-semibold" style={{ fontSize: 12 }}>
                            {String(a.traceId).slice(0, 8)}
                          </span>{' '}
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm py-0 px-2"
                            onClick={() => copy(a.traceId as string)}
                          >
                            Salin
                          </button>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}
                        onClick={() => setDetail(a)}
                      >
                        Lihat
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

      {detail && (
        <Modal title="Detail Audit" onClose={() => setDetail(null)} wide>
          <table className="table table-sm table-borderless mb-0">
            <tbody>
              <tr>
                <th style={{ width: 120, color: '#64748b' }}>Aktor</th>
                <td className="fw-semibold">{actorName(detail.actorUserId)}</td>
              </tr>
              <tr>
                <th style={{ color: '#64748b' }}>Aksi</th>
                <td><Badge value={detail.action} /></td>
              </tr>
              <tr>
                <th style={{ color: '#64748b' }}>Entitas</th>
                <td>{detail.entityType ?? '—'} {detail.entityId ?? ''}</td>
              </tr>
              <tr>
                <th style={{ color: '#64748b' }}>IP Address</th>
                <td className="font-monospace">{detail.ipAddress ?? '—'}</td>
              </tr>
              <tr>
                <th style={{ color: '#64748b' }}>Trace ID</th>
                <td className="tabular font-monospace" style={{ fontSize: 12 }}>{detail.traceId ?? '—'}</td>
              </tr>
              <tr>
                <th style={{ color: '#64748b' }}>Waktu</th>
                <td>{fmtDateTime(detail.createdAt)}</td>
              </tr>
            </tbody>
          </table>
          <div className="row g-3" style={{ marginTop: 12 }}>
            <div className="col-12 col-md-6">
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                Before
              </label>
              <pre
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: 10,
                  borderRadius: 8,
                  fontSize: 11,
                  maxHeight: 220,
                  overflow: 'auto',
                  fontFamily: 'monospace'
                }}
              >
                {JSON.stringify(detail.beforeData ?? null, null, 2)}
              </pre>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                After
              </label>
              <pre
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: 10,
                  borderRadius: 8,
                  fontSize: 11,
                  maxHeight: 220,
                  overflow: 'auto',
                  fontFamily: 'monospace'
                }}
              >
                {JSON.stringify(detail.afterData ?? null, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  )
}
