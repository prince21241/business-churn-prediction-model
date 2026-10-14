import { describe, expect, it } from 'vitest'
import { SIMULATED_QUEUE_MS, SIMULATED_RUN_MS } from './catalog'
import { buildLogs, buildMetrics, projectJob } from './jobs'
import type { TrainingJob } from '../types'

function queuedJob(createdAt: string): TrainingJob {
  return {
    id: 'job_test',
    name: 'test-job',
    datasetId: 'ds_q3',
    datasetName: 'Accounts Q3 2026',
    targetColumn: 'churned',
    algorithm: 'xgboost',
    instanceType: 'ml.m5.large',
    hyperparameters: { max_depth: 6 },
    status: 'queued',
    progress: 0,
    createdAt,
    features: [],
    origin: 'local-demo',
  }
}

describe('buildMetrics', () => {
  it('derives precision and recall from the confusion counts', () => {
    const metrics = buildMetrics('xgboost', 'job_test')
    const { tp, fp, tn, fn } = metrics.confusion
    expect(metrics.precision).toBeCloseTo(tp / (tp + fp))
    expect(metrics.recall).toBeCloseTo(tp / (tp + fn))
    expect(metrics.accuracy).toBeCloseTo((tp + tn) / metrics.validationRows)
    expect(buildMetrics('xgboost', 'job_test')).toEqual(metrics)
  })
})

describe('projectJob', () => {
  it('moves a demo job from queue to completion without leaving the browser clock', () => {
    const created = Date.parse('2026-10-14T12:00:00.000Z')
    const job = queuedJob(new Date(created).toISOString())
    expect(projectJob(job, created + 200).status).toBe('queued')
    const running = projectJob(job, created + SIMULATED_QUEUE_MS + 1000)
    expect(running.status).toBe('running')
    expect(running.progress).toBeGreaterThan(0)
    expect(running.progress).toBeLessThan(100)
    const done = projectJob(job, created + SIMULATED_QUEUE_MS + SIMULATED_RUN_MS + 10)
    expect(done.status).toBe('completed')
    expect(done.metrics?.auc).toBeGreaterThan(0.5)
    expect(buildLogs(done).at(-1)?.message).toMatch(/not uploaded to S3/)
  })
})
