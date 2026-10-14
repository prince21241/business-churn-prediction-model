import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Crosshair, Database, LayoutDashboard, Package, SlidersHorizontal, X } from 'lucide-react'
import { useFocusTrap } from '../../lib/a11y'
import { cn } from '../../lib/cn'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/datasets', label: 'Datasets', icon: Database, end: false },
  { to: '/training', label: 'Training', icon: SlidersHorizontal, end: false },
  { to: '/models', label: 'Models', icon: Package, end: false },
  { to: '/predictions', label: 'Predictions', icon: Crosshair, end: false },
]

export function Sidebar({
  open,
  desktop,
  onClose,
}: {
  open: boolean
  desktop: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const overlay = open && !desktop
  useFocusTrap(overlay, ref)

  useEffect(() => {
    if (!overlay) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlay, onClose])

  return (
    <aside
      ref={ref}
      id="app-nav"
      aria-label="Main"
      role={overlay ? 'dialog' : undefined}
      aria-modal={overlay ? true : undefined}
      aria-hidden={!desktop && !open ? true : undefined}
      inert={!desktop && !open ? true : undefined}
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white px-4 py-5',
        desktop || open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link to="/" className="flex items-center gap-3 rounded-lg" onClick={() => { if (!desktop) onClose() }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-sm font-semibold text-white">
            CS
          </span>
          <span>
            <span className="block text-sm font-semibold leading-5 text-ink">Churn Studio</span>
            <span className="block text-xs leading-4 text-ink-soft">SageMaker workspace</span>
          </span>
        </Link>
        {overlay ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-[#f4f7fa]"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Workspace">
        {NAV.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => {
                if (!desktop) onClose()
              }}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold',
                  isActive ? 'bg-accent-soft text-accent-strong' : 'text-ink hover:bg-[#f4f7fa]',
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <p className="border-t border-line pt-4 text-xs leading-5 text-ink-soft">
        <span className="font-semibold text-ink">Local demo.</span> Data stays in this browser. AWS is not contacted.
      </p>
    </aside>
  )
}
