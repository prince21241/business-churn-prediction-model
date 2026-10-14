import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { DemoNote, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState, ProgressBar } from '../components/ui/Feedback'
import { SelectField, TextField } from '../components/ui/Fields'
import { SegmentedFilter } from '../components/ui/SegmentedFilter'
import { StatusPill } from '../components/ui/StatusPill'
import { useToast } from '../components/ui/toastContext'
import { ALGORITHMS, TRAINING_INSTANCES, algorithmLabel, defaultHyperparameters } from '../domain/catalog'
import { suggestTarget } from '../domain/csv'
import { isAlgorithm } from '../domain/algorithms'
import { jobDurationMs } from '../domain/jobs'
import { validateTraining, type FieldErrors } from '../domain/validate'
import { useMl } from '../demo/mlContext'
import { errorMessage } from '../lib/errors'
import { formatDateTime, formatDuration, formatNumber } from '../lib/format'
import type { AlgorithmId, Dataset, JobStatus, Snapshot, TrainingJob } from '../types'

const JOB_FILTERS: { value: 'all' | JobStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'stopped', label: 'Stopped' },
]

export function TrainingPage() {
  return (
    <WorkspaceGate label="Loading training jobs">
      {(snapshot) => <Training snapshot={snapshot} />}
    </WorkspaceGate>
  )
}

function Training({ snapshot }: { snapshot: Snapshot }) {
  const [status, setStatus] = useState<(typeof JOB_FILTERS)[number]['value']>('all')
  const ready = snapshot.datasets.filter((dataset) => dataset.status === 'ready')
  const filtered = snapshot.jobs.filter((job) => status === 'all' || job.status === status)

  return (
    <>
      <PageHeader
        title="Training"
        description="Configure a binary classification job and follow its simulated progress."
        demo={<DemoNote>Starting a job runs a local timer and writes simulated metrics. It does not call SageMaker.</DemoNote>}
      />
      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {ready.length === 0 ? (
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-ink">No ready dataset</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Upload a CSV with a header and at least two columns before starting a demo job.</p>
            <ButtonLink to="/datasets" variant="secondary" className="mt-4">
              Go to datasets
            </ButtonLink>
          </Panel>
        ) : (
          <TrainingForm key={ready.map((dataset) => dataset.id).join('|')} datasets={snapshot.datasets} />
        )}
        <div className="min-w-0">
          <div className="mb-3">
            <SegmentedFilter label="Job status" value={status} options={JOB_FILTERS} onChange={setStatus} />
          </div>
          <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
          </p>
          {snapshot.jobs.length === 0 ? (
            <EmptyState icon={Inbox} title="No training jobs yet" body="Start a simulated job from a ready dataset. The timer and metrics stay in this browser." />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Inbox} title="No jobs match this status" body="Choose another status to see the rest of the demo jobs." />
          ) : (
            <Panel>
              <ul className="divide-y divide-line">
                {filtered.map((job) => (
                  <li key={job.id}>
                    <JobRow job={job} now={snapshot.now} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

function JobRow({ job, now }: { job: TrainingJob; now: number }) {
  return (
    <Link to={`/training/${job.id}`} className="block px-4 py-4 hover:bg-[#f7f9fb]">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{job.name}</span>
        <StatusPill status={job.status} />
      </span>
      <span className="mt-1 block text-sm text-ink-soft">
        {algorithmLabel(job.algorithm)} · {job.datasetName} · target {job.targetColumn}
      </span>
      <span className="mt-1 block text-xs text-ink-soft">
        Started {formatDateTime(job.createdAt)} · Duration {formatDuration(jobDurationMs(job, now))}
      </span>
      {job.status === 'running' || job.status === 'queued' ? (
        <span className="mt-3 block">
          <ProgressBar id={`job-${job.id}`} value={job.progress} label={job.status === 'queued' ? 'Waiting to start' : 'Simulated progress'} />
        </span>
      ) : null}
    </Link>
  )
}

function TrainingForm({ datasets }: { datasets: Dataset[] }) {
  const ready = datasets.filter((dataset) => dataset.status === 'ready')
  const first = ready[0]
  const { createJob } = useMl()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(first ? `xgboost-${first.name}` : '')
  const [datasetId, setDatasetId] = useState(first?.id ?? '')
  const [targetColumn, setTargetColumn] = useState(first ? suggestTarget(first.columns) : '')
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('xgboost')
  const [instanceType, setInstanceType] = useState(TRAINING_INSTANCES[1]?.id ?? TRAINING_INSTANCES[0].id)
  const [hyperparameters, setHyperparameters] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(defaultHyperparameters('xgboost')).map(([key, value]) => [key, String(value)])),
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)
  const dataset = datasets.find((item) => item.id === datasetId)
  const spec = ALGORITHMS[algorithm]

  function onDataset(id: string) {
    setDatasetId(id)
    const next = datasets.find((item) => item.id === id)
    setTargetColumn(next ? suggestTarget(next.columns) : '')
  }

  function onAlgorithm(value: string) {
    if (!isAlgorithm(value)) return
    setAlgorithm(value)
    setHyperparameters(Object.fromEntries(Object.entries(defaultHyperparameters(value)).map(([key, item]) => [key, String(item)])))
    if (dataset) setName(`${value}-${dataset.name}`.slice(0, 48))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateTraining({ name, datasetId, targetColumn, algorithm, instanceType, hyperparameters }, datasets)
    if (!result.ok) {
      setErrors(result.errors)
      const firstError = Object.keys(result.errors)[0]
      if (firstError) document.getElementById(firstError)?.focus()
      return
    }
    setErrors({})
    setPending(true)
    try {
      const job = await createJob(result.value)
      toast.success('Simulated job started', `${job.name} stays in this browser and does not call SageMaker.`)
      navigate(`/training/${job.id}`)
    } catch (error) {
      toast.error('Could not start the demo job', errorMessage(error, 'Check the form and try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel className="h-fit p-5">
      <h2 className="text-base font-semibold text-ink">New training job</h2>
      <p className="mt-1 text-sm leading-6 text-ink-soft">Binary classification against the column you choose. Defaults are editable.</p>
      <form className="mt-4 space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
        {Object.keys(errors).length > 0 ? (
          <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            Fix the highlighted fields before starting the demo job.
          </p>
        ) : null}
        <TextField id="name" label="Job name" value={name} error={errors.name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        <SelectField
          id="datasetId"
          label="Dataset"
          hint="Only ready datasets can be used."
          error={errors.datasetId}
          value={datasetId}
          onChange={(event) => onDataset(event.target.value)}
        >
          {ready.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {formatNumber(item.rows)} rows
            </option>
          ))}
        </SelectField>
        <SelectField
          id="targetColumn"
          label="Target column"
          hint="The label the classifier learns to predict."
          error={errors.targetColumn}
          value={targetColumn}
          onChange={(event) => setTargetColumn(event.target.value)}
        >
          <option value="">Select a column</option>
          {dataset?.columns.map((column) => (
            <option key={column.name} value={column.name}>
              {column.name} · {column.uniqueCapped ? 'many values' : `${formatNumber(column.unique)} distinct`}
            </option>
          ))}
        </SelectField>
        <SelectField id="algorithm" label="Algorithm" hint={spec.summary} error={errors.algorithm} value={algorithm} onChange={(event) => onAlgorithm(event.target.value)}>
          {Object.values(ALGORITHMS).map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <SelectField id="instanceType" label="Instance type" hint="Recorded for the demo. No instance is launched." error={errors.instanceType} value={instanceType} onChange={(event) => setInstanceType(event.target.value)}>
          {TRAINING_INSTANCES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · {item.detail}
            </option>
          ))}
        </SelectField>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">Hyperparameters</legend>
          {spec.hyperparameters.map((item) => (
            <TextField
              key={item.key}
              id={`hp:${item.key}`}
              label={item.label}
              hint={item.hint}
              error={errors[`hp:${item.key}`]}
              inputMode={item.integer ? 'numeric' : 'decimal'}
              value={hyperparameters[item.key] ?? ''}
              onChange={(event) => setHyperparameters((current) => ({ ...current, [item.key]: event.target.value }))}
            />
          ))}
        </fieldset>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Starting…' : 'Start simulated training'}
        </Button>
      </form>
    </Panel>
  )
}
