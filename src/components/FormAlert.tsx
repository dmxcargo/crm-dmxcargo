/**
 * Ringkasan error form — presentasi saja (tidak ada logic bisnis).
 *
 * Visual disamakan dengan `alert alert-danger` yang sudah dipakai,
 * jadi tampilan tidak berubah. Tambahannya hanya:
 * - `role="alert"` + `aria-live` agar screen reader & standar Google
 *   (Lighthouse accessibility) membacakan kesalahan,
 * - daftar field yang kurang dalam bentuk list yang mudah dipindai.
 */

interface FormAlertProps {
  /** Judul ringkasan, cth: "Belum bisa disimpan". */
  title?: string
  /** Daftar pesan per-field yang sedang aktif. */
  errors: Record<string, string | undefined>
  /** Pesan umum (mis. dari server) bila ada. */
  general?: string
}

export default function FormAlert({ title = 'Belum bisa disimpan.', errors, general }: FormAlertProps) {
  const list = Object.entries(errors)
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => ({ key: k, message: v as string }))

  if (list.length === 0 && !general) return null

  return (
    <div
      className="alert alert-danger py-2 px-3 mb-3"
      style={{ fontSize: 13, borderRadius: 8 }}
      role="alert"
      aria-live="assertive"
    >
      <strong className="d-block mb-1">{title}</strong>
      {general && <div className="mb-1">{general}</div>}
      {list.length > 0 && (
        <ul className="mb-0 ps-3">
          {list.slice(0, 6).map((item) => (
            <li key={item.key}>{item.message}</li>
          ))}
        </ul>
      )}
      {list.length > 6 && <div className="mt-1 text-muted">…dan {list.length - 6} kolom lainnya.</div>}
    </div>
  )
}
