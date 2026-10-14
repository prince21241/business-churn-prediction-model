import { cn } from '../../lib/cn'

const tones = {
  neutral: 'bg-[#eef2f6] text-ink-soft',
  info: 'bg-info-soft text-info',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
} as const

const statuses: Record<string, { label: string; tone: keyof typeof tones }> = {
  ready: { label: 'Ready', tone: 'ok' },
  processing: { label: 'Processing', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  completed: { label: 'Completed', tone: 'ok' },
  stopped: { label: 'Stopped', tone: 'warn' },
  creating: { label: 'Creating', tone: 'info' },
  'in-service': { label: 'In service', tone: 'ok' },
  'out-of-service': { label: 'Out of service', tone: 'neutral' },
  'not-deployed': { label: 'Not deployed', tone: 'neutral' },
}

export function StatusPill({ status }: { status: string }) {
  const item = statuses[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', tones[item.tone])}>
      {item.label}
    </span>
  )
}
