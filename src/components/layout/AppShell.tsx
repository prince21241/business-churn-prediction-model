import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMl } from '../../demo/mlContext'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

function useDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setDesktop(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return desktop
}

export function AppShell() {
  const desktop = useDesktop()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const { snapshot } = useMl()
  const firstPath = useRef(true)

  useEffect(() => {
    if (desktop) setOpen(false)
  }, [desktop])

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false
      return
    }
    setOpen(false)
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      document.getElementById('main')?.focus()
    }
  }, [location.pathname])

  useEffect(() => {
    if (!open || desktop) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, desktop])

  function closeNav() {
    setOpen(false)
    menuRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      {open && !desktop ? <div className="fixed inset-0 z-30 bg-[#10233f]/40 lg:hidden" onClick={closeNav} /> : null}
      <Sidebar open={open} desktop={desktop} onClose={closeNav} />
      <div className="lg:pl-64">
        <TopBar menuOpen={open} onMenu={() => setOpen(true)} menuRef={menuRef} />
        <main id="main" tabIndex={-1} className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            {snapshot?.storageWarning ? (
              <p role="alert" className="mb-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm leading-6 text-danger">
                {snapshot.storageWarning}
              </p>
            ) : null}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
