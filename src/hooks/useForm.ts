/**
 * Hook form generik: nilai + error inline + status sentuh (touched).
 *
 * Kenapa ada hook ini:
 * - Sebelumnya setiap modal menulis `useState` + `toast.error` sendiri-sendiri,
 *   sehingga pesan "kurang apa" tidak konsisten dan tidak muncul di bawah field.
 * - Dengan hook ini, logic form (state, validasi, submit) terpisah dari
 *   tampilan (JSX), sesuai standar pemisahan view & logic.
 *
 * Visual tidak berubah: hook ini tidak merender apa pun.
 */

import { useCallback, useMemo, useState } from 'react'

export type ErrorBag = Record<string, string | undefined>
export type Validator<T extends object> = (values: T) => ErrorBag

interface UseFormOptions<T extends object> {
  initial: T
  validate?: Validator<T>
  /** Validasi otomatis setiap nilai berubah (default: true agar pesan hilang saat diperbaiki). */
  live?: boolean
}

export function useForm<T extends object>({ initial, validate, live = true }: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<ErrorBag>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const k = String(key)
      setValues((prev) => {
        const next = { ...prev, [key]: value }
        if (live && validate) {
          const nextErrors = validate(next) ?? {}
          const msg = nextErrors[k]
          setErrors((prevErr) => ({ ...prevErr, [k]: msg }))
        }
        return next
      })
      setTouched((prev) => ({ ...prev, [k]: true }))
    },
    [live, validate],
  )

  const setMany = useCallback(
    (patch: Partial<T>) => {
      const keys = Object.keys(patch)
      setValues((prev) => {
        const next = { ...prev, ...patch }
        if (live && validate) {
          const nextErrors = validate(next) ?? {}
          setErrors((prevErr) => {
            const merged: ErrorBag = { ...prevErr }
            keys.forEach((k) => {
              merged[k] = nextErrors[k]
            })
            return merged
          })
        }
        return next
      })
      setTouched((prev) => {
        const next: Record<string, boolean> = { ...prev }
        keys.forEach((k) => {
          next[k] = true
        })
        return next
      })
    },
    [live, validate],
  )

  /** Jalankan validasi penuh. Kembalikan `true` bila valid. */
  const validateAll = useCallback((): boolean => {
    if (!validate) return true
    const next = validate(values) ?? {}
    const cleaned: ErrorBag = {}
    Object.entries(next).forEach(([k, v]) => {
      if (v) cleaned[k] = v
    })
    setErrors(cleaned)
    setSubmitted(true)
    return Object.keys(cleaned).length === 0
  }, [validate, values])

  const setServerErrors = useCallback((server: Record<string, string>) => {
    setErrors((prev) => ({ ...prev, ...server }))
    setSubmitted(true)
  }, [])

  const reset = useCallback(
    (next?: T) => {
      setValues(next ?? initial)
      setErrors({})
      setTouched({})
      setSubmitted(false)
    },
    [initial],
  )

  /** Error yang boleh ditampilkan: sudah disentuh / sudah submit. */
  const visible = useMemo(() => {
    if (submitted) return errors
    const out: ErrorBag = {}
    Object.entries(errors).forEach(([k, v]) => {
      if (v && touched[k]) out[k] = v
    })
    return out
  }, [errors, touched, submitted])

  const hasError = useMemo(() => Object.values(errors).some(Boolean), [errors])

  return { values, errors: visible, allErrors: errors, hasError, set, setMany, validateAll, setServerErrors, reset, setValues }
}

export type UseFormReturn<T extends object> = ReturnType<typeof useForm<T>>
