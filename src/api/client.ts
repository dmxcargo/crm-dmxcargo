import axios, { type AxiosResponse, type AxiosError } from 'axios'

const TOKEN_KEY = 'dmx_token'

// Token di localStorage (bukan sessionStorage) agar login bertahan saat
// browser/tab ditutup dan dibuka lagi, sampai kedaluwarsa di server
// (TOKEN_EXPIRATION_MINUTES) atau user logout / sesi dicabut.
export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY)
      // Migrasi sekali jalan dari penyimpanan lama:
      ?? sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export const setToken = (t: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, t)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* abaikan: mode privat tanpa storage */ }
}
export const clearToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* abaikan */ }
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 90000,
})

client.interceptors.request.use((cfg) => {
  const t = getToken()
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

client.interceptors.response.use(
  (r) => r,
  (e: AxiosError) => {
    if (e?.response?.status === 401 && !e.config?.url?.includes('/auth/login')) {
      clearToken()
      sessionStorage.setItem('dmx_session_expired', '1')
      if (!location.pathname.includes('/login')) location.href = '/login'
    }
    return Promise.reject(e)
  }
)

/** Membongkar bentuk standar respons backend `{ data: T }` menjadi `T`. */
export function unwrap<T>(r: AxiosResponse<{ data?: T } | T>): T {
  const body = r?.data as { data?: T } | T
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data
  }
  return body as T
}

export default client
