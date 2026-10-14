import { SIMULATED_DEPLOY_MS, TRAINING_INSTANCES } from '../domain/catalog'
import { featuresForTraining, targetIssue } from '../domain/csv'
import { deploymentProgress, projectJob } from '../domain/jobs'
import { scorePrediction } from '../domain/score'
import { validateDeploy } from '../domain/validate'
import { createId } from '../lib/id'
import type {
  CreateJobInput,
  Dataset,
  DeployInput,
  ParsedDataset,
  PersistedState,
  Prediction,
  Snapshot,
  TrainedModel,
  TrainingJob,
} from '../types'
import { createSeed, emptyState } from './seed'

const STORAGE_KEY = 'churn-studio.demo.v1'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface DemoApiOptions {
  latencyMs?: number
  mutationMs?: number
  now?: () => number
}

/**
 * Workspace API used by the UI.
 * This repository has no backend. The demo implementation keeps data in the
 * browser and does not call AWS, SageMaker, or S3. A future server adapter
 * can implement the same methods; credentials belong on that server, not here.
 */
export interface MlApi {
  readonly mode: 'demo'
  load(): Promise<Snapshot>
  subscribe(listener: (snapshot: Snapshot) => void): () => void
  addDataset(parsed: ParsedDataset): Promise<Dataset>
  deleteDataset(id: string): Promise<void>
  createJob(input: CreateJobInput): Promise<TrainingJob>
  stopJob(id: string): Promise<void>
  deployModel(id: string, input: DeployInput): Promise<TrainedModel>
  stopEndpoint(id: string): Promise<void>
  predict(modelId: string, inputs: Record<string, string>): Promise<Prediction>
  clear(): Promise<void>
  restore(): Promise<void>
}

export interface DemoApi extends MlApi {
  read(): Snapshot
}

export function createDemoApi(store: KeyValueStore, options: DemoApiOptions = {}): DemoApi {
  const latencyMs = options.latencyMs ?? 420
  const mutationMs = options.mutationMs ?? 180
  const now = options.now ?? (() => Date.now())
  let data: PersistedState | null = null
  let storageWarning: string | null = null
  let lastSignature = ''
  let timer: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<(snapshot: Snapshot) => void>()

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  function parsePersisted(raw: string): PersistedState {
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch {
      throw new Error('Saved demo data could not be read.')
    }
    if (!value || typeof value !== 'object') throw new Error('Saved demo data could not be read.')
    const record = value as Partial<PersistedState>
    if (record.version !== 1) {
      throw new Error('Saved demo data is from an older version of this workspace.')
    }
    if (
      !Array.isArray(record.datasets) ||
      !Array.isArray(record.jobs) ||
      !Array.isArray(record.models) ||
      !Array.isArray(record.predictions)
    ) {
      throw new Error('Saved demo data could not be read.')
    }
    return {
      version: 1,
      datasets: record.datasets,
      jobs: record.jobs,
      models: record.models,
      predictions: record.predictions,
    }
  }

  function persist() {
    if (!data) return
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(data))
      storageWarning = null
    } catch {
      storageWarning = 'This browser could not save the demo workspace. Clear demo data and try again.'
    }
  }

  function hydrate() {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) {
      data = createSeed(now())
      persist()
      return
    }
    data = parsePersisted(raw)
  }

  function ensure() {
    if (!data) hydrate()
  }

  function current(): PersistedState {
    ensure()
    if (!data) throw new Error('Demo workspace is not available.')
    return data
  }

  function modelFromJob(job: TrainingJob): TrainedModel {
    if (!job.metrics) throw new Error('A completed demo job is missing metrics.')
    return {
      id: `model_${job.id}`,
      name: job.name,
      jobId: job.id,
      datasetId: job.datasetId,
      datasetName: job.datasetName,
      targetColumn: job.targetColumn,
      algorithm: job.algorithm,
      createdAt: job.endedAt ?? job.createdAt,
      metrics: job.metrics,
      features: job.features,
      endpoint: null,
      origin: 'local-demo',
    }
  }

  function project(): Snapshot {
    const state = current()
    const timestamp = now()
    let dirty = false
    const jobs = state.jobs.map((job, index) => {
      const next = projectJob(job, timestamp)
      if (next.status === 'completed' && job.status !== 'completed') {
        state.jobs[index] = next
        if (!state.models.some((model) => model.jobId === next.id)) {
          state.models.unshift(modelFromJob(next))
        }
        dirty = true
        return next
      }
      return next
    })

    state.models = state.models.map((model) => {
      if (model.endpoint?.status !== 'creating') return model
      const started = Date.parse(model.endpoint.updatedAt)
      if (!Number.isFinite(started) || timestamp < started + SIMULATED_DEPLOY_MS) return model
      dirty = true
      return {
        ...model,
        endpoint: {
          ...model.endpoint,
          status: 'in-service' as const,
          updatedAt: new Date(started + SIMULATED_DEPLOY_MS).toISOString(),
        },
      }
    })

    if (dirty) persist()

    return {
      now: timestamp,
      datasets: state.datasets,
      jobs,
      models: state.models,
      predictions: state.predictions,
      storageWarning,
    }
  }

  function signature(snapshot: Snapshot): string {
    const jobs = snapshot.jobs.map((job) => `${job.id}:${job.status}:${job.progress}`).join('|')
    const models = snapshot.models
      .map((model) => {
        const endpoint = model.endpoint
        const progress =
          endpoint?.status === 'creating' ? deploymentProgress(endpoint.updatedAt, snapshot.now, SIMULATED_DEPLOY_MS) : 0
        return `${model.id}:${endpoint?.status ?? 'none'}:${progress}`
      })
      .join('|')
    return `${Math.floor(snapshot.now / 30000)}#${jobs}#${models}#${snapshot.datasets.length}#${snapshot.predictions.length}#${snapshot.storageWarning ?? ''}`
  }

  function notify() {
    const snapshot = project()
    lastSignature = signature(snapshot)
    for (const listener of listeners) listener(snapshot)
    syncTimer()
  }

  function tick() {
    const snapshot = project()
    const next = signature(snapshot)
    if (next !== lastSignature) {
      lastSignature = next
      for (const listener of listeners) listener(snapshot)
    }
    syncTimer()
  }

  function syncTimer() {
    if (listeners.size === 0) {
      if (timer) clearInterval(timer)
      timer = null
      return
    }
    if (timer == null) timer = setInterval(tick, 1000)
  }

  async function mutate<T>(work: () => T): Promise<T> {
    await wait(mutationMs)
    const result = work()
    if (storageWarning) throw new Error(storageWarning)
    notify()
    return result
  }

  return {
    mode: 'demo',
    async load() {
      await wait(latencyMs)
      hydrate()
      const snapshot = project()
      lastSignature = signature(snapshot)
      return snapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      syncTimer()
      return () => {
        listeners.delete(listener)
        syncTimer()
      }
    },
    addDataset(parsed) {
      return mutate(() => {
        const dataset: Dataset = {
          id: createId('ds'),
          name: parsed.name,
          fileName: parsed.fileName,
          bytes: parsed.bytes,
          rows: parsed.rows,
          status: 'ready',
          uploadedAt: new Date(now()).toISOString(),
          columns: parsed.columns,
          preview: parsed.preview,
          origin: 'local-demo',
        }
        current().datasets.unshift(dataset)
        persist()
        return dataset
      })
    },
    deleteDataset(id) {
      return mutate(() => {
        const state = current()
        const dataset = state.datasets.find((item) => item.id === id)
        if (!dataset) throw new Error('That dataset is no longer in this browser.')
        state.datasets = state.datasets.filter((item) => item.id !== id)
        persist()
      })
    },
    createJob(input) {
      return mutate(() => {
        const state = current()
        const dataset = state.datasets.find((item) => item.id === input.datasetId)
        if (!dataset || dataset.status !== 'ready') {
          throw new Error('Choose a ready dataset stored in this browser.')
        }
        const column = dataset.columns.find((item) => item.name === input.targetColumn)
        const issue = targetIssue(column)
        if (issue) throw new Error(issue)
        const features = featuresForTraining(dataset.columns, input.targetColumn)
        if (features.length === 0) {
          throw new Error('This dataset has no feature columns besides the target and identifiers.')
        }
        if (!TRAINING_INSTANCES.some((item) => item.id === input.instanceType)) {
          throw new Error('Choose a training instance from the list.')
        }
        const job: TrainingJob = {
          id: createId('job'),
          name: input.name.trim(),
          datasetId: dataset.id,
          datasetName: dataset.name,
          targetColumn: input.targetColumn,
          algorithm: input.algorithm,
          instanceType: input.instanceType,
          hyperparameters: input.hyperparameters,
          status: 'queued',
          progress: 0,
          createdAt: new Date(now()).toISOString(),
          features,
          origin: 'local-demo',
        }
        state.jobs.unshift(job)
        persist()
        return projectJob(job, now())
      })
    },
    stopJob(id) {
      return mutate(() => {
        const state = current()
        const index = state.jobs.findIndex((item) => item.id === id)
        const stored = index >= 0 ? state.jobs[index] : undefined
        if (!stored) throw new Error('That training job is no longer in this browser.')
        const projected = projectJob(stored, now())
        if (projected.status !== 'queued' && projected.status !== 'running') {
          throw new Error('Only a queued or running demo job can be stopped.')
        }
        state.jobs[index] = {
          ...projected,
          status: 'stopped',
          endedAt: new Date(now()).toISOString(),
        }
        persist()
      })
    },
    deployModel(id, input) {
      return mutate(() => {
        const state = current()
        const index = state.models.findIndex((item) => item.id === id)
        const model = index >= 0 ? state.models[index] : undefined
        if (!model) throw new Error('That model is no longer in this browser.')
        if (model.endpoint?.status === 'creating' || model.endpoint?.status === 'in-service') {
          throw new Error('Stop the current demo endpoint before starting another one.')
        }
        const checked = validateDeploy({
          name: input.name,
          instanceType: input.instanceType,
          instanceCount: String(input.instanceCount),
        })
        if (!checked.ok) {
          throw new Error(Object.values(checked.errors)[0] ?? 'Check the deployment settings.')
        }
        const next: TrainedModel = {
          ...model,
          endpoint: {
            name: checked.value.name,
            instanceType: checked.value.instanceType,
            instanceCount: checked.value.instanceCount,
            status: 'creating',
            updatedAt: new Date(now()).toISOString(),
          },
        }
        state.models[index] = next
        persist()
        return next
      })
    },
    stopEndpoint(id) {
      return mutate(() => {
        const state = current()
        const index = state.models.findIndex((item) => item.id === id)
        const model = index >= 0 ? state.models[index] : undefined
        if (!model?.endpoint) throw new Error('This model has no demo endpoint.')
        if (model.endpoint.status !== 'creating' && model.endpoint.status !== 'in-service') {
          throw new Error('This demo endpoint is already stopped.')
        }
        state.models[index] = {
          ...model,
          endpoint: {
            ...model.endpoint,
            status: 'out-of-service',
            updatedAt: new Date(now()).toISOString(),
          },
        }
        persist()
      })
    },
    predict(modelId, inputs) {
      return mutate(() => {
        const snapshot = project()
        const model = snapshot.models.find((item) => item.id === modelId)
        if (!model) throw new Error('That model is no longer in this browser.')
        if (model.endpoint?.status !== 'in-service') {
          throw new Error('Simulated predictions need a demo endpoint that is in service.')
        }
        const prediction: Prediction = {
          id: createId('pred'),
          modelId: model.id,
          modelName: model.name,
          endpointName: model.endpoint.name,
          createdAt: new Date(now()).toISOString(),
          inputs,
          result: scorePrediction(model.features, inputs),
          origin: 'local-demo',
        }
        const state = current()
        state.predictions = [prediction, ...state.predictions].slice(0, 50)
        persist()
        return prediction
      })
    },
    clear() {
      return mutate(() => {
        data = emptyState()
        persist()
      })
    },
    restore() {
      return mutate(() => {
        data = createSeed(now())
        persist()
      })
    },
    read() {
      return project()
    },
  }
}

let singleton: DemoApi | null = null

export function getMlApi(): DemoApi {
  if (!singleton) {
    if (typeof localStorage === 'undefined') {
      throw new Error('Demo storage is only available in the browser.')
    }
    singleton = createDemoApi(localStorage)
  }
  return singleton
}
