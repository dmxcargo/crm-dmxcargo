import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useLoginForm } from '../hooks/useLoginForm'
import logo from '../asset/logo.svg'

/**
 * VIEW Login — Tampilan Split Screen Modern:
 * - Kiri: Foto kargo & logistik resolusi tinggi dari Unsplash dengan overlay informatif.
 * - Kanan: Form login autentik DMX Cargo tanpa UI dummy (tanpa OAuth, tanpa link palsu).
 * Logic (validasi, submit, state) tetap dikelola oleh `useLoginForm.ts`.
 */
export default function Login() {
  const {
    authed,
    form,
    fieldErrors,
    generalError,
    show,
    busy,
    set,
    setShow,
    setGeneralError,
    submit,
    consumeSessionExpiredFlag,
  } = useLoginForm()

  useEffect(() => {
    const msg = consumeSessionExpiredFlag()
    if (msg) setGeneralError(msg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authed) return <Navigate to="/prospects" replace />

  return (
    <div className="container-fluid p-0" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <div className="row g-0" style={{ minHeight: '100vh' }}>
        {/* ── Sisi Kiri: Visual Operasional Kargo (LOGINASSET.png - Bersih tanpa teks) ── */}
        <div
          className="d-none d-lg-block col-lg-6 col-xl-7 position-relative"
          style={{
            backgroundImage: `url('/LOGINASSET.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '100vh',
          }}
        />

        {/* ── Sisi Kanan: Form Login (Tanpa Dummy UI) ── */}
        <div
          className="col-12 col-lg-6 col-xl-5 d-flex align-items-center justify-content-center p-4 p-sm-5 bg-white"
          style={{ minHeight: '100vh' }}
        >
          <div style={{ width: '100%', maxWidth: 400 }}>
            {/* Logo & Identitas Perusahaan */}
            <div className="d-flex align-items-center gap-3 mb-4">
              <img
                src={logo}
                alt="DMX Cargo"
                style={{ height: 44, width: 'auto', objectFit: 'contain' }}
              />
              <div style={{ lineHeight: 1.2 }}>
                <div className="fw-bold text-dark" style={{ fontSize: 14 }}>
                  PT Dwikarya Mandiri Ekspressindo
                </div>
                <div className="text-muted" style={{ fontSize: 11.5 }}>
                  DMX Cargo Sales Control
                </div>
              </div>
            </div>

            {/* Judul Form */}
            <div className="mb-4">
              <h3 className="fw-bold text-dark mb-1" style={{ fontSize: 24, letterSpacing: -0.3 }}>
                Masuk ke Akun
              </h3>
              <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 0 }}>
                Masukkan kredensial akun Anda untuk mengakses sistem.
              </p>
            </div>

            {/* Pesan Error Sistem */}
            {generalError && (
              <div
                className="alert alert-danger py-2.5 px-3 mb-3"
                style={{ fontSize: 13, borderRadius: 8 }}
                role="alert"
                aria-live="assertive"
              >
                {generalError}
              </div>
            )}

            {/* Form Login (Hanya elemen fungsional murni) */}
            <form onSubmit={(e) => void submit(e)} noValidate={false}>
              {/* Username / Email */}
              <div className="mb-3">
                <label
                  htmlFor="login-username"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: 6,
                  }}
                >
                  Username atau Email
                </label>
                <input
                  id="login-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  className="form-control"
                  style={{
                    fontSize: 14,
                    padding: '11px 14px',
                    borderRadius: 8,
                    borderColor: fieldErrors.login ? '#dc2626' : '#cbd5e1',
                    backgroundColor: '#ffffff',
                  }}
                  value={form.login}
                  onChange={(e) => set('login', e.target.value)}
                  placeholder="Masukkan username atau email"
                  autoFocus
                  required
                  aria-invalid={Boolean(fieldErrors.login)}
                  aria-describedby={fieldErrors.login ? 'login-username-error' : undefined}
                />
                {fieldErrors.login && (
                  <div
                    id="login-username-error"
                    className="form-text text-danger"
                    role="alert"
                    style={{ fontSize: 12, marginTop: 4 }}
                  >
                    {fieldErrors.login}
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="mb-4">
                <label
                  htmlFor="login-password"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: 6,
                  }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={show ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    className="form-control"
                    style={{
                      fontSize: 14,
                      padding: '11px 42px 11px 14px',
                      borderRadius: 8,
                      borderColor: fieldErrors.password ? '#dc2626' : '#cbd5e1',
                      backgroundColor: '#ffffff',
                    }}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="Masukkan password"
                    required
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={show}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <div
                    id="login-password-error"
                    className="form-text text-danger"
                    role="alert"
                    style={{ fontSize: 12, marginTop: 4 }}
                  >
                    {fieldErrors.password}
                  </div>
                )}
              </div>

              {/* Tombol Masuk */}
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={busy}
                style={{
                  padding: '12px',
                  fontSize: 14.5,
                  fontWeight: 600,
                  borderRadius: 8,
                  backgroundColor: '#34347f',
                  borderColor: '#34347f',
                  boxShadow: '0 2px 6px rgba(52, 52, 127, 0.25)',
                }}
              >
                {busy ? 'Memproses Masuk...' : 'Masuk ke Sistem'}
              </button>
            </form>

            {/* Footer Sistem */}
            <div className="text-center mt-5 pt-3 border-top" style={{ fontSize: 11.5, color: '#94a3b8' }}>
              © 2026 PT Dwikarya Mandiri Ekspressindo. Seluruh hak cipta dilindungi.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
