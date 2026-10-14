import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { createId } from '../../lib/id'
import { cn } from '../../lib/cn'
import { ToastContext, type ToastApi } from './toastContext'

interface ToastItem {
  id: string
  tone: 'success' | 'error' | 'info'
  title: string
  message?: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastItem['tone'], title: string, message?: string) => {
      const id = createId('toast')
      setToasts((current) => [...current, { id, tone, title, message }].slice(-4))
      if (tone !== 'error') {
        const timer = window.setTimeout(() => dismiss(id), 7000)
        timers.current.set(id, timer)
      }
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-label="Notifications" className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto rounded-xl border bg-white p-3 shadow-lg',
              toast.tone === 'error' ? 'border-danger/30' : 'border-line',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{toast.title}</p>
                {toast.message ? <p className="mt-1 text-sm leading-5 text-ink-soft">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink hover:bg-[#eef2f6]"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
