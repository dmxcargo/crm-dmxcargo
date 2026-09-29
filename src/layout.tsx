import { useEffect, useRef, useState } from 'react'
import type { ReactNode, ComponentType, CSSProperties } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, GitBranch, Users, UserCheck, CalendarClock, Target, BarChart3,
  Settings, LogOut, Menu, X, WifiOff, Shield, ChevronDown,
} from 'lucide-react'
import logo from './asset/logo.svg'
import { useAuth, useConfirm, useToast } from './store/app'
import { authApi } from './api/resources'
import { isStaff, todayID, errMsg } from './utils'

interface LayoutProps {
  title: string
  children: ReactNode
}

interface NavItemProps {
  to: string
  icon: ComponentType<{ size?: number | string; strokeWidth?: number }>
  label: string
  end?: boolean
}

interface SubItemProps {
  to: string
  label: string
  end?: boolean
}

interface GroupProps {
  openSt: boolean
  setOpenSt: (v: boolean) => void
  icon: ComponentType<{ size?: number | string; strokeWidth?: number }>
  label: string
  children: ReactNode
}

// ── Design Tokens ──────────────────────────────────────────────
const SB_BG = 'rgb(52, 52, 127)'
const SB_ACT = 'rgba(255, 255, 255, 0.18)'
const SB_HOV = 'rgba(255, 255, 255, 0.08)'
const SB_TXT = 'rgba(255, 255, 255, 0.75)'
const SB_W = 240
const HDR_H = 58
// ──────────────────────────────────────────────────────────────

export default function Layout({ title, children }: LayoutProps) {
  const { user, logout } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const nav = useNavigate()
  const location = useLocation()

  const [open, setOpen] = useState(false)
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [reportsOpen, setReportsOpen] = useState(location.pathname.startsWith('/reports'))
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/import-export')
  )

  const staff = isStaff(user)
  const initials = (user?.name ?? 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('')

  useEffect(() => {
    document.title = `${title} — DMX Sales Control`
  }, [title])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const out = async () => {
    setUserMenuOpen(false)
    const ok = await confirm({
      title: 'Keluar Aplikasi',
      message: 'Apakah Anda yakin ingin keluar?',
      confirmLabel: 'Ya, Keluar',
    })
    if (!ok) return
    try {
      await logout()
      toast.success('Anda berhasil keluar.')
      nav('/login')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal keluar.'))
    }
  }

  const outAll = async () => {
    setUserMenuOpen(false)
    const ok = await confirm({
      title: 'Cabut Semua Sesi',
      message: 'Keluar dari semua perangkat termasuk sesi ini?',
      confirmLabel: 'Ya, Cabut Semua',
      danger: true,
    })
    if (!ok) return
    try {
      await authApi.revokeAll()
      toast.success('Semua sesi berhasil dicabut.')
    } catch (e) {
      toast.error(errMsg(e, 'Gagal mencabut sesi.'))
    }
    await logout()
    nav('/login')
  }

  const Item = ({ to, icon: I, label, end }: NavItemProps) => (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={() => setOpen(false)}
        className="d-flex align-items-center gap-2 text-decoration-none rounded-3"
        style={({ isActive }): CSSProperties => ({
          padding: '9px 14px',
          fontSize: 13.5,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#ffffff' : SB_TXT,
          background: isActive ? SB_ACT : 'transparent',
          transition: 'background .12s, color .12s',
          fontFamily: "'Poppins', sans-serif",
        })}
      >
        <I size={17} strokeWidth={1.75} />
        <span>{label}</span>
      </NavLink>
    </li>
  )

  const SubItem = ({ to, label, end }: SubItemProps) => (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={() => setOpen(false)}
        className="d-flex align-items-center text-decoration-none rounded-3"
        style={({ isActive }): CSSProperties => ({
          padding: '7px 14px 7px 40px',
          fontSize: 13,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#ffffff' : SB_TXT,
          background: isActive ? SB_ACT : 'transparent',
          transition: 'background .12s, color .12s',
          fontFamily: "'Poppins', sans-serif",
        })}
      >
        {label}
      </NavLink>
    </li>
  )

  const Group = ({ openSt, setOpenSt, icon: I, label, children: ch }: GroupProps) => (
    <li>
      <button
        type="button"
        className="d-flex align-items-center justify-content-between w-100 border-0 rounded-3 text-start"
        style={{
          padding: '9px 14px',
          fontSize: 13.5,
          fontWeight: 400,
          color: SB_TXT,
          background: 'transparent',
          cursor: 'pointer',
          transition: 'background .12s, color .12s',
          fontFamily: "'Poppins', sans-serif",
        }}
        onClick={() => setOpenSt(!openSt)}
        aria-expanded={openSt}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = SB_HOV
          ;(e.currentTarget as HTMLElement).style.color = '#fff'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = SB_TXT
        }}
      >
        <span className="d-flex align-items-center gap-2">
          <I size={17} strokeWidth={1.75} />
          <span>{label}</span>
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          style={{
            opacity: 0.5,
            transform: openSt ? 'rotate(180deg)' : 'none',
            transition: 'transform .18s ease',
          }}
        />
      </button>
      {openSt && (
        <ul className="list-unstyled mb-0 mt-1 d-flex flex-column" style={{ gap: 2 }}>
          {ch}
        </ul>
      )}
    </li>
  )

  const navList = (
    <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0 }}>
      <ul
        className="list-unstyled mb-0 px-2 pt-2 d-flex flex-column flex-grow-1 overflow-auto"
        style={{ gap: 3 }}
        aria-label="Navigasi utama"
      >
        <Item
          to="/dashboard"
          icon={LayoutDashboard}
          label={user?.role === 'SALES' ? 'Dashboard Sales' : 'Dashboard'}
          end
        />
        <Item to="/pipeline" icon={GitBranch} label="Sales Pipeline" />
        <Item to="/prospects" icon={Users} label="Prospect" />
        <Item to="/customers" icon={UserCheck} label="Customer" />
        <Item to="/follow-ups" icon={CalendarClock} label="Follow Up" />
        <Item to="/targets" icon={Target} label={user?.role === 'SALES' ? 'Target Saya' : 'Target Performa'} />
        <li>
          <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '6px 4px' }} />
        </li>
        <Group openSt={reportsOpen} setOpenSt={setReportsOpen} icon={BarChart3} label="Laporan">
          <SubItem to="/reports/performance" label={user?.role === 'SALES' ? 'Performa Saya' : 'Performa'} />
          <SubItem to="/reports/annual" label={user?.role === 'SALES' ? 'Tahunan Saya' : 'Tahunan'} />
        </Group>
        {staff && (
          <Group openSt={adminOpen} setOpenSt={setAdminOpen} icon={Settings} label="Administrasi">
            {/* <SubItem to="/import-export" label="Import / Export" /> */}
            <SubItem to="/admin/users" label="User Management" />
            <SubItem to="/admin/masters" label="Master Data" />
            <SubItem to="/admin/audit" label="Audit Log" />
          </Group>
        )}
      </ul>

      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
        <button
          className="d-flex align-items-center justify-content-center gap-2 w-100 border-0 rounded-3"
          style={{
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 12,
            fontWeight: 500,
            padding: '7px 12px',
            cursor: 'pointer',
            transition: 'all .12s',
            fontFamily: "'Poppins', sans-serif",
          }}
          onClick={outAll}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.5)'
            ;(e.currentTarget as HTMLElement).style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'
          }}
        >
          <Shield size={13} strokeWidth={2} /> Cabut Semua Sesi
        </button>
        <div className="text-center mt-2" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>
          © 2026 DMX Cargo
        </div>
      </div>
    </div>
  )

  const roleBadge = user?.role === 'ADMIN' ? 'b-purple' : user?.role === 'BILLING' ? 'b-amber' : 'b-blue'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
      <a
        href="#konten-utama"
        className="visually-hidden-focusable"
        style={{ position: 'absolute', zIndex: 2000 }}
      >
        Lewati ke konten utama
      </a>
      {/* ══ TOPBAR (Full Width on Top) ═════════════════════════════════════ */}
      <header
        className="d-flex align-items-center justify-content-between px-3 px-md-4 flex-shrink-0"
        style={{
          height: HDR_H,
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          width: '100%',
        }}
      >
        {/* Left: Mobile hamburger + Logo + Company Name + Title */}
        <div className="d-flex align-items-center gap-2 gap-sm-3">
          <button
            className="btn border-0 p-1 d-lg-none"
            style={{ color: '#64748b', lineHeight: 1 }}
            onClick={() => setOpen(!open)}
            aria-label="Menu navigasi"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <div className="d-flex align-items-center gap-2">
            <img src={logo} alt="DMX Cargo" style={{ height: 30, objectFit: 'contain' }} />
            <span
              className="d-none d-sm-block fw-bold text-dark text-nowrap"
              style={{ fontSize: 13, letterSpacing: -0.2 }}
            >
              PT Dwikarya Mandiri Ekspressindo
            </span>
          </div>
          <div className="d-none d-md-block" style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <span className="d-none d-md-inline fw-semibold text-secondary text-nowrap" style={{ fontSize: 14, letterSpacing: -0.015 }}>
            {title}
          </span>
        </div>

        {/* Right: Date + Role + User */}
        <div className="d-flex align-items-center gap-2 gap-md-3">
          <span
            className="d-none d-md-inline text-secondary"
            style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 400 }}
          >
            {todayID()}
          </span>
          <span className={`badge ${roleBadge}`}>{user?.role}</span>

          <div className="position-relative" ref={userMenuRef}>
            <button
              className="d-flex align-items-center gap-2 border-0 rounded-3"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '5px 12px 5px 6px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: '#334155',
                transition: 'background .12s',
                fontFamily: "'Poppins', sans-serif",
              }}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#f8fafc'
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: SB_BG,
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {initials || 'U'}
              </span>
              <span
                className="d-none d-sm-inline text-truncate"
                style={{ maxWidth: 120 }}
                title={user?.name}
              >
                {user?.name}
              </span>
              <ChevronDown
                size={12}
                strokeWidth={2.5}
                style={{
                  opacity: 0.4,
                  transform: userMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .15s',
                }}
              />
            </button>

            {userMenuOpen && (
              <ul
                className="dropdown-menu show"
                style={{
                  position: 'absolute',
                  right: 0,
                  left: 'auto',
                  minWidth: 210,
                  marginTop: 6,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.1)',
                  borderRadius: 10,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <li>
                  <div className="px-3 py-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div className="fw-semibold" style={{ fontSize: 13.5, color: '#0f172a' }}>
                      {user?.name}
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <span className={`badge ${roleBadge}`}>{user?.role}</span>
                      <small className="text-secondary">@{user?.username}</small>
                    </div>
                  </div>
                </li>
                <li>
                  <button
                    className="dropdown-item d-flex align-items-center gap-2 py-2"
                    onClick={out}
                    style={{ fontSize: 13 }}
                  >
                    <LogOut size={14} strokeWidth={2} /> Keluar
                  </button>
                </li>
                <li>
                  <hr className="dropdown-divider my-1" />
                </li>
                <li>
                  <button
                    className="dropdown-item d-flex align-items-center gap-2 py-2 text-danger"
                    onClick={outAll}
                    style={{ fontSize: 13 }}
                  >
                    <Shield size={14} strokeWidth={2} /> Cabut Semua Sesi
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </header>

      {/* ══ BODY (Sidebar + Content row) ════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Desktop Sidebar: sticky right below the topbar */}
        <aside
          className="d-none d-lg-flex flex-column flex-shrink-0"
          style={{
            width: SB_W,
            minWidth: SB_W,
            background: SB_BG,
            position: 'sticky',
            top: HDR_H,
            height: `calc(100vh - ${HDR_H}px)`,
            overflowY: 'auto',
            zIndex: 70,
          }}
        >
          {navList}
        </aside>

        {/* Mobile Offcanvas */}
        {open && (
          <>
            <div
              className="d-lg-none d-flex flex-column"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 1055,
                width: SB_W,
                background: SB_BG,
              }}
            >
              <div
                className="d-flex align-items-center justify-content-between px-3 flex-shrink-0"
                style={{ height: HDR_H, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                  <img
                    src={logo}
                    alt="DMX Cargo"
                    style={{
                      height: 26,
                      objectFit: 'contain',
                      background: '#fff',
                      borderRadius: 5,
                      padding: '2px 7px',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#ffffff',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    PT Dwikarya Mandiri Ekspressindo
                  </span>
                </div>
                <button
                  className="border-0 d-flex align-items-center justify-content-center rounded-2"
                  style={{
                    background: 'rgba(255,255,255,0.09)',
                    color: '#fff',
                    width: 30,
                    height: 30,
                    cursor: 'pointer',
                  }}
                  onClick={() => setOpen(false)}
                  aria-label="Tutup"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              {navList}
            </div>
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1054 }}
              onClick={() => setOpen(false)}
            />
          </>
        )}

        {/* Content Column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!online && (
            <div
              className="d-flex align-items-center gap-2 px-4 py-2 flex-shrink-0"
              role="alert"
              style={{
                background: '#fef3c7',
                borderBottom: '1px solid #fcd34d',
                color: '#92400e',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <WifiOff size={14} strokeWidth={2} /> Tidak tersambung ke internet.
            </div>
          )}
          <main className="container-fluid p-3 p-md-4" id="konten-utama" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </div>
  )
}
