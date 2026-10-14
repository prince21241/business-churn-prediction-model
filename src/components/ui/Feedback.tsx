import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-[#e7edf4] motion-reduce:animate-none', className)} />
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-6 h-44 w-full" />
      <Skeleton className="mt-4 h-44 w-full" />
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <Icon className="mx-auto h-6 w-6 text-ink-soft" aria-hidden />
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-soft">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'The workspace could not be loaded',
  message,
  onRetry,
  onRestore,
}: {
  title?: string
  message: string
  onRetry: () => void
  onRestore?: () => void
}) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-white px-6 py-10">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">{message}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onRetry}>Try again</Button>
        {onRestore ? (
          <Button variant="secondary" onClick={onRestore}>
            Restore sample data
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function ProgressBar({
  id,
  value,
  label,
  tone = 'accent',
}: {
  id: string
  value: number
  label: string
  tone?: 'accent' | 'ok' | 'danger'
}) {
  const width = Math.max(0, Math.min(100, Math.round(value)))
  const labelId = `${id}-label`
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-ink-soft">
        <span id={labelId}>{label}</span>
        <span className="tabular-nums">{width}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-labelledby={labelId}
        className="h-2 overflow-hidden rounded-full bg-[#e7edf4]"
      >
        <div
          className={cn('h-full rounded-full', tone === 'ok' && 'bg-ok', tone === 'danger' && 'bg-danger', tone === 'accent' && 'bg-accent')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
