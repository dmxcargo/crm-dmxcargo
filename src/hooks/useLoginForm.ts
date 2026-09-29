/**
 * Logic halaman Login — dipisah dari tampilan (view).
 *
 * View (`pages/Login.tsx`) hanya merender JSX dengan class/style yang sama
 * persis seperti sebelumnya. Semua aturan "kurang apa" ada di sini sehingga
 * mudah diuji dan konsisten.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../store/app'
import { errMsg } from '../utils'
import { backendFieldErrors } from '../lib/formErrors'

export interface LoginFieldErrors {
  login?: string
  password?: string
}

export function validateLogin(values: { login: string; password: string }): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  if (!values.login.trim()) {
    errors.login = 'Username / email wajib diisi. Contoh: budi.sales atau budi@perusahaan.com.'
  }
  if (!values.password) {
    errors.password = 'Password wajib diisi.'
  } else if (values.password.length < 3) {
    errors.password = 'Password terlalu pendek. Periksa kembali caps-lock dan coba lagi.'
  }
  return errors
}

export function useLoginForm() {
  const { authed, login } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  const [form, setForm] = useState({ login: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (key: 'login' | 'password', value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    // Hapus pesan field itu segera setelah user memperbaikinya.
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const check = validateLogin(next)
      return { ...prev, [key]: check[key] }
    })
    if (generalError) setGeneralError('')
  }

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    const errors = validateLogin(form)
    setFieldErrors(errors)
    if (errors.login || errors.password) {
      setGeneralError('Lengkapi kolom yang ditandai di bawah ini, lalu klik Masuk lagi.')
      return
    }
    setBusy(true)
    setGeneralError('')
    try {
      await login(form.login.trim(), form.password)
      toast.success('Selamat datang!')
      nav('/prospects')
    } catch (ex) {
      const serverFields = backendFieldErrors(ex)
      if (serverFields.login || serverFields.password) {
        setFieldErrors({
          login: serverFields.login,
          password: serverFields.password,
        })
      }
      setGeneralError(errMsg(ex, 'Username atau password salah. Periksa kembali lalu coba lagi.'))
    } finally {
      setBusy(false)
    }
  }

  const consumeSessionExpiredFlag = (): string => {
    if (typeof sessionStorage === 'undefined') return ''
    if (sessionStorage.getItem('dmx_session_expired')) {
      sessionStorage.removeItem('dmx_session_expired')
      return 'Sesi Anda telah berakhir karena terlalu lama tidak aktif. Silakan masuk kembali.'
    }
    return ''
  }

  return {
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
  }
}
