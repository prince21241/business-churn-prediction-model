import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFocusTrap } from '../../lib/a11y'
import { Button } from './Button'

export function Dialog({
  title,
  children,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  onConfirm: () => Promise<void> | void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const pendingRef = useRef(false)
  const previouslyFocused = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )
  const [pending, setPending] = useState(false)
  const titleId = 'dialog-title'
  const bodyId = 'dialog-body'
  useFocusTrap(true, panelRef)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  useEffect(() => {
    const restoreFocus = previouslyFocused.current
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pendingRef.current) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      restoreFocus?.focus()
    }
  }, [])

  async function confirm() {
    setPending(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-[#10233f]/40" onClick={() => { if (!pending) onClose() }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <div id={bodyId} className="mt-2 text-sm leading-6 text-ink-soft">
          {children}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => void confirm()} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
