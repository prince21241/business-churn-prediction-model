import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Menu } from 'lucide-react'
import { useMl } from '../../demo/mlContext'
import { errorMessage } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { useToast } from '../ui/toastContext'

export function TopBar({
  menuOpen,
  onMenu,
  menuRef,
}: {
  menuOpen: boolean
  onMenu: () => void
  menuRef: RefObject<HTMLButtonElement | null>
}) {
  const { snapshot, status, clear, restore } = useMl()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'clear' | 'restore' | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const datasets = snapshot?.datasets.length ?? 0
  const active = snapshot?.jobs.filter((job) => job.status === 'queued' || job.status === 'running').length ?? 0
  const deployed = snapshot?.models.filter((model) => model.endpoint?.status === 'in-service').length ?? 0
  const summary =
    status === 'loading'
      ? 'Loading workspace'
      : status === 'error'
        ? 'Workspace unavailable'
        : `${datasets} datasets · ${active} active ${active === 1 ? 'job' : 'jobs'} · ${deployed} deployed`

  async function run(action: 'clear' | 'restore') {
    try {
      if (action === 'clear') {
        await clear()
        toast.success('Demo data cleared', 'Datasets, jobs, models, and predictions were removed from this browser.')
      } else {
        await restore()
        toast.success('Sample data restored', 'The original demo workspace replaced what was stored in this browser.')
      }
    } catch (error) {
      toast.error('The workspace could not be updated', errorMessage(error, 'Try again.'))
      throw error
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuRef}
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink lg:hidden"
          aria-label="Open navigation"
          aria-controls="app-nav"
          aria-expanded={menuOpen}
          onClick={onMenu}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <p className="hidden truncate text-sm text-ink-soft sm:block">{summary}</p>
      </div>
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          Demo mode
        </button>
        {open ? (
          <div id={panelId} className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-white p-4 shadow-lg">
            <p className="text-sm leading-6 text-ink-soft">
              Uploads, training, deployment, and predictions stay in this browser. They do not create SageMaker jobs, endpoints, or S3 objects.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false)
                  setConfirm('restore')
                }}
              >
                Restore sample data
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false)
                  setConfirm('clear')
                }}
              >
                Clear demo data
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {confirm ? (
        <Dialog
          title={confirm === 'clear' ? 'Clear demo data?' : 'Restore sample data?'}
          confirmLabel={confirm === 'clear' ? 'Clear demo data' : 'Restore sample data'}
          tone={confirm === 'clear' ? 'danger' : 'primary'}
          onClose={() => setConfirm(null)}
          onConfirm={() => run(confirm)}
        >
          {confirm === 'clear'
            ? 'This removes datasets, jobs, models, and predictions stored in this browser. Nothing is deleted from AWS, because this demo never contacts AWS.'
            : 'This replaces the current browser workspace with the original sample datasets, jobs, and models. Uploads you added here will be removed.'}
        </Dialog>
      ) : null}
    </header>
  )
}
