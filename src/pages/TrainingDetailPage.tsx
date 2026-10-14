import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { MetricList } from '../components/MetricList'
import { BackLink, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { Button, ButtonLink } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState, ProgressBar } from '../components/ui/Feedback'
import { StatusPill } from '../components/ui/StatusPill'
import { useToast } from '../components/ui/toastContext'
import { algorithmLabel } from '../domain/catalog'
import { buildLogs, jobDurationMs } from '../domain/jobs'
import { useMl } from '../demo/mlContext'
import { errorMessage } from '../lib/errors'
import { formatDateTime, formatDuration } from '../lib/format'
import type { TrainingJob } from '../types'

export function TrainingDetailPage() {
  const { jobId } = useParams()
  return (
    <WorkspaceGate label="Loading training job">
      {(snapshot) => {
        const job = snapshot.jobs.find((item) => item.id === jobId)
        if (!job) {
          return (
            <EmptyState
              icon={Inbox}
              title="Training job not found"
              body="It may have been cleared from this browser."
              action={<ButtonLink to="/training">Back to training</ButtonLink>}
            />
          )
        }
        const model = snapshot.models.find((item) => item.jobId === job.id)
        return <TrainingDetail job={job} now={snapshot.now} modelId={model?.id} datasetExists={snapshot.datasets.some((dataset) => dataset.id === job.datasetId)} />
      }}
    </WorkspaceGate>
  )
}

function TrainingDetail({
  job,
  now,
  modelId,
  datasetExists,
}: {
  job: TrainingJob
  now: number
  modelId?: string
  datasetExists: boolean
}) {
  const { stopJob } = useMl()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const logs = buildLogs(job)
  const active = job.status === 'queued' || job.status === 'running'
  const tone = job.status === 'failed' ? 'danger' : job.status === 'completed' ? 'ok' : 'accent'

  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(logs.map((line) => `${formatDateTime(line.at)}  ${line.message}`).join('\n'))
      toast.success('Logs copied', 'The simulated transcript is on the clipboard.')
    } catch {
      toast.error('Could not copy logs', 'Your browser blocked clipboard access.')
    }
  }

  return (
    <>
      <BackLink to="/training">Training</BackLink>
      <div className="mt-3">
        <PageHeader
          title={job.name}
          description={`${algorithmLabel(job.algorithm)} on ${job.instanceType}. This transcript is generated locally.`}
          actions={
            <>
              <StatusPill status={job.status} />
              {active ? (
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  Stop demo job
                </Button>
              ) : null}
              {modelId ? (
                <ButtonLink to={`/models/${modelId}`} variant="secondary">
                  View model
                </ButtonLink>
              ) : null}
            </>
          }
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Panel className="p-5">
            <ProgressBar
              id="job-progress"
              value={job.progress}
              label={active ? 'Simulated progress' : job.status === 'completed' ? 'Demo job finished' : 'Progress when stopped'}
              tone={tone}
            />
            {job.error ? <p className="mt-3 text-sm leading-6 text-danger">{job.error}</p> : null}
          </Panel>
          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">Logs</h2>
              <Button variant="secondary" size="sm" onClick={() => void copyLogs()}>
                Copy logs
              </Button>
            </div>
            <p className="mt-1 text-sm text-ink-soft">Generated in the browser to show how a job transcript would read.</p>
            <ol className="mt-3 max-h-80 space-y-2 overflow-auto rounded-lg bg-navy px-4 py-3 font-mono text-xs leading-5 text-[#e8eef5]" aria-label="Simulated training logs">
              {logs.map((line) => (
                <li key={`${line.at}-${line.message}`}>
                  <time dateTime={line.at}>{formatDateTime(line.at)}</time>
                  <span> — {line.message}</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-ink">Evaluation</h2>
            {job.metrics ? (
              <div className="mt-4">
                <MetricList metrics={job.metrics} />
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {active ? 'Metrics appear when the simulated job finishes.' : 'This demo job did not produce metrics.'}
              </p>
            )}
          </Panel>
        </div>
        <Panel className="h-fit p-5">
          <h2 className="text-base font-semibold text-ink">Configuration</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <ConfigItem label="Dataset">
              {datasetExists ? <Link to={`/datasets/${job.datasetId}`} className="font-semibold underline">{job.datasetName}</Link> : job.datasetName}
            </ConfigItem>
            <ConfigItem label="Target">{job.targetColumn}</ConfigItem>
            <ConfigItem label="Algorithm">{algorithmLabel(job.algorithm)}</ConfigItem>
            <ConfigItem label="Instance">{job.instanceType}</ConfigItem>
            <ConfigItem label="Created">{formatDateTime(job.createdAt)}</ConfigItem>
            <ConfigItem label="Started">{job.startedAt ? formatDateTime(job.startedAt) : '—'}</ConfigItem>
            <ConfigItem label="Ended">{job.endedAt ? formatDateTime(job.endedAt) : '—'}</ConfigItem>
            <ConfigItem label="Duration">{formatDuration(jobDurationMs(job, now))}</ConfigItem>
          </dl>
          <h3 className="mt-5 text-sm font-semibold text-ink">Hyperparameters</h3>
          <dl className="mt-2 space-y-2 text-sm">
            {Object.entries(job.hyperparameters).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">{key}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      {confirm ? (
        <Dialog
          title={`Stop ${job.name}?`}
          confirmLabel="Stop demo job"
          tone="danger"
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            try {
              await stopJob(job.id)
              toast.success('Demo job stopped', 'The local simulation ended. AWS was not involved.')
            } catch (error) {
              toast.error('Could not stop the demo job', errorMessage(error, 'Try again.'))
              throw error
            }
          }}
        >
          This only stops the timer in this browser. It does not stop a SageMaker training job.
        </Dialog>
      ) : null}
    </>
  )
}

function ConfigItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  )
}
