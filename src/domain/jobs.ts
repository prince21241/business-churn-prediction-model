import { SIMULATED_QUEUE_MS, SIMULATED_RUN_MS, algorithmLabel } from './catalog'
import type { AlgorithmId, EvaluationMetrics, LogLine, TrainingJob } from '../types'

const BASE_METRICS: Record<AlgorithmId, { tp: number; fp: number; tn: number; fn: number; auc: number }> = {
  xgboost: { tp: 468, fp: 132, tn: 1668, fn: 132, auc: 0.9 },
  linear: { tp: 402, fp: 198, tn: 1602, fn: 198, auc: 0.81 },
  random_forest: { tp: 444, fp: 156, tn: 1644, fn: 156, auc: 0.87 },
  catboost: { tp: 486, fp: 114, tn: 1686, fn: 114, auc: 0.92 },
}

export function buildMetrics(algorithm: AlgorithmId, seed: string): EvaluationMetrics {
  const base = BASE_METRICS[algorithm]
  const jitter = (hash(seed) % 11) - 5
  const shift = (hash(`${seed}:k`) % 9) - 4
  const tp = base.tp + jitter
  const fn = base.fn - jitter
  const fp = base.fp + shift
  const tn = base.tn - shift
  const total = tp + tn + fp + fn
  const precision = tp / (tp + fp)
  const recall = tp / (tp + fn)
  const accuracy = (tp + tn) / total
  const f1 = (2 * precision * recall) / (precision + recall)
  const auc = clamp(base.auc + ((hash(`${seed}:auc`) % 17) - 8) / 1000, 0.5, 0.99)
  return {
    accuracy,
    precision,
    recall,
    f1,
    auc,
    validationRows: total,
    confusion: { tp, fp, tn, fn },
  }
}

export function projectJob(job: TrainingJob, now: number): TrainingJob {
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'stopped') return job
  const created = Date.parse(job.createdAt)
  const start = created + SIMULATED_QUEUE_MS
  if (!Number.isFinite(created) || now < start) {
    return { ...job, status: 'queued', progress: 0 }
  }
  if (now < start + SIMULATED_RUN_MS) {
    const progress = Math.max(1, Math.min(99, Math.round(((now - start) / SIMULATED_RUN_MS) * 100)))
    return {
      ...job,
      status: 'running',
      progress,
      startedAt: new Date(start).toISOString(),
    }
  }
  const ended = new Date(start + SIMULATED_RUN_MS).toISOString()
  return {
    ...job,
    status: 'completed',
    progress: 100,
    startedAt: new Date(start).toISOString(),
    endedAt: ended,
    metrics: buildMetrics(job.algorithm, job.id),
  }
}

export function deploymentProgress(updatedAt: string, now: number, durationMs: number): number {
  const started = Date.parse(updatedAt)
  if (!Number.isFinite(started)) return 0
  return Math.max(0, Math.min(99, Math.round(((now - started) / durationMs) * 100)))
}

export function buildLogs(job: TrainingJob): LogLine[] {
  const label = algorithmLabel(job.algorithm)
  const steps: Array<{ at: number; message: string }> = [
    { at: 0, message: 'Demo job accepted in the browser. No SageMaker training job was created.' },
    { at: 8, message: `Checked column types and the target "${job.targetColumn}".` },
    { at: 22, message: 'Split rows into a simulated train set and validation set.' },
    { at: 45, message: `Fitting ${label} on ${job.instanceType} with a local stand-in. Hyperparameters were stored only in this browser.` },
    { at: 72, message: 'Computed simulated validation metrics from a fixed confusion table.' },
    { at: 100, message: 'Demo job finished. Model artifacts were not uploaded to S3.' },
  ]

  if (job.status === 'queued') {
    return [{ at: job.createdAt, message: 'Waiting in the local demo queue.' }]
  }

  const start = Date.parse(job.startedAt ?? job.createdAt)
  const lines = steps
    .filter((step) => job.progress >= step.at || job.status === 'completed')
    .map((step) => ({
      at: new Date(start + (step.at / 100) * SIMULATED_RUN_MS).toISOString(),
      message: step.message,
    }))

  if (job.status === 'failed' && job.error) {
    lines.push({ at: job.endedAt ?? job.createdAt, message: job.error })
  }
  if (job.status === 'stopped') {
    lines.push({
      at: job.endedAt ?? new Date().toISOString(),
      message: 'Stopped in the browser before the demo job finished.',
    })
  }
  return lines
}

export function jobDurationMs(job: TrainingJob, now: number): number | null {
  if (job.status === 'queued' || !job.startedAt) return null
  const start = Date.parse(job.startedAt)
  if (!Number.isFinite(start)) return null
  const end = job.endedAt ? Date.parse(job.endedAt) : now
  return Math.max(0, end - start)
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
