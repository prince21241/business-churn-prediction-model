import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../lib/cn'

function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Churn Studio`
  }, [title])
}

export function PageHeader({
  title,
  description,
  actions,
  demo,
}: {
  title: string
  description: string
  actions?: ReactNode
  demo?: ReactNode
}) {
  usePageTitle(title)
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-pretty text-ink-soft">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {demo ? <div className="mt-4">{demo}</div> : null}
    </div>
  )
}

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-line bg-white px-3 py-2 text-sm leading-6 text-ink-soft">
      <span className="font-semibold text-ink">Demo mode. </span>
      {children}
    </p>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(16,35,63,0.04)]', className)}>
      {children}
    </div>
  )
}
