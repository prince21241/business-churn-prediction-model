import type { ActivityItem, Snapshot } from '../types'

export function buildActivity(snapshot: Pick<Snapshot, 'datasets' | 'jobs' | 'models' | 'predictions'>): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const dataset of snapshot.datasets) {
    items.push({
      id: `dataset-${dataset.id}`,
      title: dataset.status === 'failed' ? 'Dataset failed' : 'Dataset ready',
      detail: dataset.error ?? `${dataset.fileName} · ${dataset.rows.toLocaleString('en-US')} rows`,
      at: dataset.uploadedAt,
      href: `/datasets/${dataset.id}`,
      tone: dataset.status === 'failed' ? 'danger' : 'neutral',
      kind: 'dataset',
    })
  }

  for (const job of snapshot.jobs) {
    const tone = job.status === 'failed' ? 'danger' : job.status === 'stopped' ? 'warning' : 'neutral'
    const title =
      job.status === 'completed'
        ? 'Training completed'
        : job.status === 'failed'
          ? 'Training failed'
          : job.status === 'stopped'
            ? 'Training stopped'
            : 'Training started'
    items.push({
      id: `job-${job.id}`,
      title,
      detail: `${job.name} · ${job.datasetName}`,
      at: job.endedAt ?? job.createdAt,
      href: `/training/${job.id}`,
      tone,
      kind: 'training',
    })
  }

  for (const model of snapshot.models) {
    if (!model.endpoint) continue
    items.push({
      id: `endpoint-${model.id}`,
      title: model.endpoint.status === 'in-service' ? 'Demo endpoint in service' : 'Demo endpoint updated',
      detail: `${model.endpoint.name} · ${model.name}`,
      at: model.endpoint.updatedAt,
      href: `/models/${model.id}`,
      tone: model.endpoint.status === 'failed' ? 'danger' : 'neutral',
      kind: 'endpoint',
    })
  }

  for (const prediction of snapshot.predictions) {
    items.push({
      id: `prediction-${prediction.id}`,
      title: 'Prediction recorded',
      detail: `${prediction.result.predictedLabel} · ${prediction.modelName}`,
      at: prediction.createdAt,
      href: '/predictions',
      tone: 'neutral',
      kind: 'prediction',
    })
  }

  return items
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 8)
}

export function workspaceIsEmpty(snapshot: Pick<Snapshot, 'datasets' | 'jobs' | 'models' | 'predictions'>): boolean {
  return (
    snapshot.datasets.length === 0 &&
    snapshot.jobs.length === 0 &&
    snapshot.models.length === 0 &&
    snapshot.predictions.length === 0
  )
}
