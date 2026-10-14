import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { MetricList } from '../components/MetricList'
import { BackLink, DemoNote, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { Button, ButtonLink } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState, ProgressBar } from '../components/ui/Feedback'
import { SelectField, TextField } from '../components/ui/Fields'
import { StatusPill } from '../components/ui/StatusPill'
import { useToast } from '../components/ui/toastContext'
import { HOSTING_INSTANCES, SIMULATED_DEPLOY_MS, algorithmLabel } from '../domain/catalog'
import { deploymentProgress } from '../domain/jobs'
import { validateDeploy, type FieldErrors } from '../domain/validate'
import { useMl } from '../demo/mlContext'
import { errorMessage } from '../lib/errors'
import { formatDateTime, slugify } from '../lib/format'
import type { TrainedModel } from '../types'

export function ModelDetailPage() {
  const { modelId } = useParams()
  return (
    <WorkspaceGate label="Loading model">
      {(snapshot) => {
        const model = snapshot.models.find((item) => item.id === modelId)
        if (!model) {
          return (
            <EmptyState
              icon={Inbox}
              title="Model not found"
              body="It may have been cleared from this browser."
              action={<ButtonLink to="/models">Back to models</ButtonLink>}
            />
          )
        }
        return <ModelDetail model={model} now={snapshot.now} datasetExists={snapshot.datasets.some((dataset) => dataset.id === model.datasetId)} />
      }}
    </WorkspaceGate>
  )
}

function ModelDetail({ model, now, datasetExists }: { model: TrainedModel; now: number; datasetExists: boolean }) {
  const endpoint = model.endpoint
  const live = endpoint?.status === 'creating' || endpoint?.status === 'in-service'
  return (
    <>
      <BackLink to="/models">Models</BackLink>
      <div className="mt-3">
        <PageHeader
          title={model.name}
          description={`${algorithmLabel(model.algorithm)} trained on ${model.datasetName}. Evaluation numbers below are simulated.`}
          actions={<StatusPill status={endpoint?.status ?? 'not-deployed'} />}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel className="p-5">
          <h2 className="text-base font-semibold text-ink">Evaluation</h2>
          <div className="mt-4">
            <MetricList metrics={model.metrics} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Training job</dt>
              <dd className="mt-1">
                <Link to={`/training/${model.jobId}`} className="font-semibold underline">
                  {model.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Dataset</dt>
              <dd className="mt-1">
                {datasetExists ? (
                  <Link to={`/datasets/${model.datasetId}`} className="font-semibold underline">
                    {model.datasetName}
                  </Link>
                ) : (
                  model.datasetName
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Target</dt>
              <dd className="mt-1">{model.targetColumn}</dd>
            </div>
          </dl>
        </Panel>
        <div className="space-y-4">
          <DemoNote>Endpoint changes here are labels in this browser. No SageMaker endpoint is created or deleted.</DemoNote>
          {live && endpoint ? <EndpointStatus model={model} now={now} /> : <DeployForm key={`${model.id}-${endpoint?.updatedAt ?? 'new'}`} model={model} />}
        </div>
      </div>
    </>
  )
}

function EndpointStatus({ model, now }: { model: TrainedModel; now: number }) {
  const endpoint = model.endpoint
  const { stopEndpoint } = useMl()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  if (!endpoint) return null
  const creating = endpoint.status === 'creating'
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Demo endpoint</h2>
        <StatusPill status={endpoint.status} />
      </div>
      {creating ? (
        <div className="mt-4">
          <ProgressBar
            id="deploy-progress"
            value={deploymentProgress(endpoint.updatedAt, now, SIMULATED_DEPLOY_MS)}
            label="Simulated provisioning"
          />
        </div>
      ) : null}
      <dl className="mt-4 space-y-3 text-sm">
        <Item label="Name" value={endpoint.name} />
        <Item label="Instance" value={`${endpoint.instanceType} × ${endpoint.instanceCount}`} />
        <Item label="Updated" value={formatDateTime(endpoint.updatedAt)} />
      </dl>
      {endpoint.status === 'in-service' ? (
        <ButtonLink to="/predictions" className="mt-4 w-full">
          Run a simulated prediction
        </ButtonLink>
      ) : null}
      <Button variant="danger" className="mt-2 w-full" onClick={() => setConfirm(true)}>
        Stop demo endpoint
      </Button>
      {confirm ? (
        <Dialog
          title={`Stop ${endpoint.name}?`}
          confirmLabel="Stop demo endpoint"
          tone="danger"
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            try {
              await stopEndpoint(model.id)
              toast.success('Demo endpoint stopped', 'It is marked out of service in this browser only.')
            } catch (error) {
              toast.error('Could not stop the demo endpoint', errorMessage(error, 'Try again.'))
              throw error
            }
          }}
        >
          This marks the local endpoint out of service. It does not delete a SageMaker endpoint.
        </Dialog>
      ) : null}
    </Panel>
  )
}

function DeployForm({ model }: { model: TrainedModel }) {
  const { deployModel } = useMl()
  const toast = useToast()
  const [name, setName] = useState(slugify(model.name))
  const [instanceType, setInstanceType] = useState(HOSTING_INSTANCES[0].id)
  const [instanceCount, setInstanceCount] = useState('1')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)
  const previous = model.endpoint

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateDeploy({ name, instanceType, instanceCount })
    if (!result.ok) {
      setErrors(result.errors)
      const first = Object.keys(result.errors)[0]
      if (first) document.getElementById(first)?.focus()
      return
    }
    setPending(true)
    try {
      await deployModel(model.id, result.value)
      toast.success('Demo deployment started', 'Provisioning is simulated and does not call SageMaker.')
    } catch (error) {
      toast.error('Could not start the demo deployment', errorMessage(error, 'Check the form and try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel className="p-5">
      <h2 className="text-base font-semibold text-ink">Demo deployment</h2>
      {previous ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Previous demo endpoint {previous.name} is {previous.status === 'out-of-service' ? 'out of service' : previous.status}.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-ink-soft">This model has no demo endpoint yet.</p>
      )}
      <form className="mt-4 space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
        <TextField id="name" label="Endpoint name" hint="Letters, numbers, and hyphens. Stored locally." error={errors.name} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        <SelectField id="instanceType" label="Hosting instance" error={errors.instanceType} value={instanceType} onChange={(event) => setInstanceType(event.target.value)}>
          {HOSTING_INSTANCES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · {item.detail}
            </option>
          ))}
        </SelectField>
        <SelectField id="instanceCount" label="Instance count" error={errors.instanceCount} value={instanceCount} onChange={(event) => setInstanceCount(event.target.value)}>
          {['1', '2', '3', '4'].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </SelectField>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Starting…' : 'Start demo deployment'}
        </Button>
      </form>
    </Panel>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  )
}
