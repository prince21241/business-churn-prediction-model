import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { DemoNote, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { EmptyState } from '../components/ui/Feedback'
import { SegmentedFilter } from '../components/ui/SegmentedFilter'
import { StatusPill } from '../components/ui/StatusPill'
import { algorithmLabel } from '../domain/catalog'
import { formatDateTime, formatDecimal, formatPercent } from '../lib/format'
import type { Snapshot, TrainedModel } from '../types'

type ModelFilter = 'all' | 'deployed' | 'idle'

const FILTERS: { value: ModelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'idle', label: 'Not deployed' },
]

export function ModelsPage() {
  return (
    <WorkspaceGate label="Loading models">
      {(snapshot) => <Models snapshot={snapshot} />}
    </WorkspaceGate>
  )
}

function Models({ snapshot }: { snapshot: Snapshot }) {
  const [filter, setFilter] = useState<ModelFilter>('all')
  const filtered = snapshot.models.filter((model) => {
    const deployed = model.endpoint?.status === 'in-service'
    if (filter === 'deployed') return deployed
    if (filter === 'idle') return !deployed
    return true
  })

  return (
    <>
      <PageHeader
        title="Models"
        description="Review simulated evaluation results and the status of demo endpoints."
        demo={<DemoNote>Deployment controls on a model update this browser only. They do not create SageMaker endpoints.</DemoNote>}
      />
      <div className="mb-4">
        <SegmentedFilter label="Deployment" value={filter} options={FILTERS} onChange={setFilter} />
      </div>
      <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'model' : 'models'}
      </p>
      {snapshot.models.length === 0 ? (
        <EmptyState icon={Inbox} title="No trained models yet" body="A model appears here when a simulated training job finishes." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="No models match this filter" body="Choose another deployment filter to see the rest of the models." />
      ) : (
        <Panel>
          <ul className="divide-y divide-line">
            {filtered.map((model) => (
              <li key={model.id}>
                <ModelRow model={model} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}

function ModelRow({ model }: { model: TrainedModel }) {
  return (
    <Link to={`/models/${model.id}`} className="block px-4 py-4 hover:bg-[#f7f9fb]">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{model.name}</span>
        <StatusPill status={model.endpoint?.status ?? 'not-deployed'} />
      </span>
      <span className="mt-1 block text-sm text-ink-soft">
        {algorithmLabel(model.algorithm)} · {model.datasetName} · target {model.targetColumn}
      </span>
      <span className="mt-1 block text-sm text-ink">
        AUC {formatDecimal(model.metrics.auc)} · F1 {formatPercent(model.metrics.f1, 1)} · Accuracy {formatPercent(model.metrics.accuracy, 1)}
      </span>
      <span className="mt-1 block text-xs text-ink-soft">
        {model.endpoint ? `${model.endpoint.name} · ${model.endpoint.instanceType} × ${model.endpoint.instanceCount}` : `Trained ${formatDateTime(model.createdAt)}`}
      </span>
    </Link>
  )
}
