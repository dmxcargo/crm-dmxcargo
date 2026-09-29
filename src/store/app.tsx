import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { authApi } from '../api/resources'
import { clearToken, getToken, setToken } from '../api/client'
import type { User } from '../types'

// ─── Toast ──────────────────────────────────────────────────────────
export interface ToastApi {
  success: (m: string) => void
  error: (m: string) => void
  warning: (m: string) => void
}

type ToastType = 'ok' | 'err' | 'warn'
interface ToastItem { id: number; type: ToastType; message: string }

const ToastCtx = createContext<ToastApi | null>(null)

export const useToast = (): ToastApi => {
  const v = useContext(ToastCtx)
  if (!v) throw new Error('useToast harus dipakai di dalam <ToastProvider>')
  return v
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const recentRef = useRef<Array<{ type: ToastType; message: string; at: number }>>([])
  const dismiss = useCallback((id: number) => {
    setItems((p) => p.filter((t) => t.id !== id))
  }, [])
  const push = useCallback((type: ToastType, message: string) => {
    const msg = message.trim()
    if (!msg) return
    const now = Date.now()
    recentRef.current = recentRef.current.filter((r) => now - r.at < 5000)
    // Jangan tampilkan yang persis sama dua kali (mis. efek jalan ganda
    // di dev / dua respons gagal berurutan) — cukup satu.
    if (recentRef.current.some((r) => r.type === type && r.message === msg)) return
    recentRef.current.push({ type, message: msg, at: now })
    const id = ++idRef.current
    setItems((p) => [...p.slice(-2), { id, type, message: msg }])
    // Hilang otomatis 5 detik. Klik untuk menutup lebih cepat.
    setTimeout(() => dismiss(id), 5000)
  }, [dismiss])
  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('ok', m),
    error: (m) => push('err', m),
    warning: (m) => push('warn', m),
  }), [push])
  const Icon = { ok: CheckCircle2, err: AlertCircle, warn: AlertTriangle } as const
  const label = { ok: 'Berhasil', err: 'Gagal', warn: 'Perhatian' } as const
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => {
          const I = Icon[t.type]
          return (
            <div
              key={t.id}
              className={`toast show ${t.type}`}
              role="status"
              aria-label={label[t.type]}
              onClick={() => dismiss(t.id)}
              title="Klik untuk menutup"
            >
              <I size={18} aria-hidden="true" />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

// ─── Confirm ────────────────────────────────────────────────────────
export interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}
export type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>

interface ConfirmState extends Required<Omit<ConfirmOptions, 'danger'>> {
  danger: boolean
}

const ConfirmCtx = createContext<ConfirmFn | null>(null)

export const useConfirm = (): ConfirmFn => {
  const v = useContext(ConfirmCtx)
  if (!v) throw new Error('useConfirm harus dipakai di dalam <ConfirmProvider>')
  return v
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const confirm = useCallback<ConfirmFn>((opts = {}) => new Promise<boolean>((res) => {
    resolver.current = res
    setState({ title: 'Konfirmasi', message: 'Apakah Anda yakin?', confirmLabel: 'Ya, Lanjutkan', danger: false, ...opts })
  }), [])
  const close = (v: boolean) => { setState(null); resolver.current?.(v); resolver.current = null }
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <>
          <div className="modal-backdrop show" style={{ zIndex: 1050 }} onClick={() => close(false)} />
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{state.title}</h5>
                </div>
                <div className="modal-body"><p style={{ lineHeight: 1.6 }} className="mb-0">{state.message}</p></div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => close(false)}>Batal</button>
                  <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>{state.confirmLabel}</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </ConfirmCtx.Provider>
  )
}

// ─── Auth ───────────────────────────────────────────────────────────
export interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => Promise<void>
  authed: boolean
}

const AuthCtx = createContext<AuthContextValue | null>(null)

export const useAuth = (): AuthContextValue => {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return v
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = getToken()
    if (!t) { setLoading(false); return }
    authApi.me()
      .then((u) => setUser((u as { user?: User }).user ?? (u as User)))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])
  const login = useCallback(async (loginName: string, password: string) => {
    const res = await authApi.login(loginName, password)
    setToken(res.accessToken)
    setUser(res.user)
  }, [])
  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* abaikan */ }
    clearToken(); setUser(null)
  }, [])
  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, authed: !!user }),
    [user, loading, login, logout],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
