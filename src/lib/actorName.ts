/**
 * Penyelesai nama aktor/pengguna untuk tampilan.
 *
 * Masalah yang diperbaiki: halaman detail memuat daftar user lewat
 * `GET /users` yang butuh izin `users.manage` (ADMIN/BILLING). Penonton
 * role SALES selalu 403 sehingga daftar kosong dan semua nama jatuh ke
 * potongan UUID acak ("1eedfe09"). Helper ini memperbaiki CARA PASSING-nya:
 * cocokkan dulu dengan akun yang sedang login (kasus paling umum: pelaku
 * adalah penonton sendiri), baru daftar user, terakhir label ramah —
 * TIDAK PERNAH potongan UUID.
 */

interface PersonLike {
  id?: string
  name?: string | null
}

interface MeLike {
  id?: string
  name?: string | null
}

/**
 * Kembalikan nama tampilan untuk `actorId`.
 * - `null`/kosong -> `fallbackNull` ("Sistem" untuk aksi otomatis).
 * - Sama dengan akun login -> "Nama (Anda)".
 * - Ketemu di daftar -> nama dari daftar.
 * - Selain itu -> `fallbackUnknown` ("Pengguna lain"), bukan potongan UUID.
 */
export function resolveActorName(
  actorId: string | null | undefined,
  me: MeLike | null | undefined,
  users: PersonLike[] | undefined,
  fallbackUnknown = 'Pengguna lain',
  fallbackNull = 'Sistem',
): string {
  if (!actorId) return fallbackNull
  if (me?.id === actorId && me?.name) return `${me.name} (Anda)`
  const found = (Array.isArray(users) ? users : []).find((u) => u?.id === actorId)?.name
  if (found) return found
  return fallbackUnknown
}
