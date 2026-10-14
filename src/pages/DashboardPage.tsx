import { Crosshair, Database, Package, SlidersHorizontal, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DemoNote, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { Skeleton } from '../components/ui/Feedback'
import { buildActivity, workspaceIsEmpty } from '../domain/overview'
import { formatNumber, formatPercent, formatRelative } from '../lib/format'
import type { ActivityItem, Snapshot } from '../types'

const activityIcons = {
  dataset: Database,
  training: SlidersHorizontal,
  endpoint: Package,
  prediction: Crosshair,
}

export function DashboardPage() {
  return (
    <WorkspaceGate label="Loading dashboard" skeleton={<DashboardSkeleton />}>
      {(snapshot) => <Dashboard snapshot={snapshot} />}
    </WorkspaceGate>
  )
}

function Dashboard({ snapshot }: { snapshot: Snapshot }) {
  const activity = buildActivity(snapshot)
  const ready = snapshot.datasets.filter((dataset) => dataset.status === 'ready').length
  const failed = snapshot.datasets.filter((dataset) => dataset.status === 'failed').length
  const running = snapshot.jobs.filter((job) => job.status === 'running').length
  const queued = snapshot.jobs.filter((job) => job.status === 'queued').length
  const active = running + queued
  const deployed = snapshot.models.filter((model) => model.endpoint?.status === 'in-service').length
  const latest = snapshot.predictions[0]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A local view of churn datasets, training jobs, demo endpoints, and predictions."
        demo={<DemoNote>Sample records live in this browser. Counts update when a simulated job or deployment finishes.</DemoNote>}
      />
      {workspaceIsEmpty(snapshot) ? (
        <Panel className="px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-ink">This workspace is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">
            Upload a CSV to preview it locally, or restore the sample workspace from Demo mode in the header.
          </p>
          <Link to="/datasets" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">
            Go to datasets
          </Link>
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatLink to="/datasets" label="Datasets" value={formatNumber(snapshot.datasets.length)} detail={datasetDetail(ready, failed)} />
            <StatLink to="/training" label="Active training jobs" value={formatNumber(active)} detail={jobDetail(running, queued)} />
            <StatLink to="/models" label="Deployed models" value={formatNumber(deployed)} detail={`${formatNumber(snapshot.models.length)} trained in this browser`} />
            <StatLink
              to="/predictions"
              label="Predictions"
              value={formatNumber(snapshot.predictions.length)}
              detail={
                latest
                  ? `${latest.result.predictedLabel} · ${latest.result.confidence == null ? 'no confidence score' : formatPercent(latest.result.confidence)}`
                  : 'None yet'
              }
            />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Panel className="p-5">
              <h2 className="text-base font-semibold text-ink">Recent activity</h2>
              {activity.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-ink-soft">Activity from datasets, jobs, endpoints, and predictions will show up here.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {activity.map((item) => (
                    <li key={item.id}>
                      <ActivityLink item={item} now={snapshot.now} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="p-5">
              <h2 className="text-base font-semibold text-ink">Quick actions</h2>
              <ul className="mt-3 space-y-2">
                <li>
                  <ActionLink to="/datasets" icon={Upload} title="Upload a dataset" body="Parse a CSV in this browser and preview its columns." />
                </li>
                <li>
                  <ActionLink to="/training" icon={SlidersHorizontal} title="Configure training" body="Choose a target, algorithm, and instance for a simulated job." />
                </li>
                <li>
                  <ActionLink to="/predictions" icon={Crosshair} title="Run a prediction" body="Score an account against a demo endpoint that is in service." />
                </li>
              </ul>
            </Panel>
          </div>
        </>
      )}
    </>
  )
}

function datasetDetail(ready: number, failed: number): string {
  if (ready === 0 && failed === 0) return 'None yet'
  return `${formatNumber(ready)} ready · ${formatNumber(failed)} failed`
}

function jobDetail(running: number, queued: number): string {
  if (running === 0 && queued === 0) return 'None in progress'
  const parts = []
  if (running > 0) parts.push(`${formatNumber(running)} running`)
  if (queued > 0) parts.push(`${formatNumber(queued)} queued`)
  return parts.join(' · ')
}

function StatLink({ to, label, value, detail }: { to: string; label: string; value: string; detail: string }) {
  return (
    <Link to={to} className="block rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(16,35,63,0.04)] hover:border-[#cfd8e3]">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink-soft">{label}</span>
        <span className="text-sm font-semibold text-accent-strong">View</span>
      </span>
      <span className="mt-3 block text-3xl font-semibold tabular-nums tracking-tight text-ink">{value}</span>
      <span className="mt-1 block text-sm leading-5 text-ink-soft">{detail}</span>
    </Link>
  )
}

function ActivityLink({ item, now }: { item: ActivityItem; now: number }) {
  const Icon = activityIcons[item.kind]
  return (
    <Link to={item.href} className="flex gap-3 rounded-lg py-3 hover:bg-[#f7f9fb]">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4f7fa]">
        <Icon className={item.tone === 'danger' ? 'h-4 w-4 text-danger' : item.tone === 'warning' ? 'h-4 w-4 text-warn' : 'h-4 w-4 text-ink'} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{item.title}</span>
        <span className="mt-0.5 block truncate text-sm text-ink-soft">{item.detail}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{formatRelative(item.at, now)}</span>
      </span>
    </Link>
  )
}

function ActionLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string
  icon: typeof Upload
  title: string
  body: string
}) {
  return (
    <Link to={to} className="block rounded-lg border border-line px-3 py-3 hover:bg-[#f7f9fb]">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-accent-strong" aria-hidden />
        {title}
      </span>
      <span className="mt-1 block text-sm leading-5 text-ink-soft">{body}</span>
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading dashboard</p>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}
