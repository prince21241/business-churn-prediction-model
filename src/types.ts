export const ALGORITHM_IDS = ['xgboost', 'linear', 'random_forest', 'catboost'] as const
export type AlgorithmId = (typeof ALGORITHM_IDS)[number]

export type DatasetStatus = 'ready' | 'processing' | 'failed'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'
export type EndpointStatus = 'creating' | 'in-service' | 'out-of-service' | 'failed'
export type ColumnType = 'number' | 'text' | 'boolean'
export type FeatureKind = 'number' | 'text' | 'boolean' | 'select'

export interface DatasetColumn {
  name: string
  type: ColumnType
  missing: number
  unique: number
  uniqueCapped: boolean
  examples: string[]
  options?: string[]
}

export interface Dataset {
  id: string
  name: string
  fileName: string
  bytes: number
  rows: number
  status: DatasetStatus
  uploadedAt: string
  columns: DatasetColumn[]
  preview: string[][]
  error?: string
  origin: 'local-demo'
}

export interface FeatureSpec {
  name: string
  label: string
  kind: FeatureKind
  sample: string
  hint?: string
  options?: string[]
  min?: number
  max?: number
  integer?: boolean
}

export interface EvaluationMetrics {
  accuracy: number
  precision: number
  recall: number
  f1: number
  auc: number
  validationRows: number
  confusion: {
    tp: number
    fp: number
    tn: number
    fn: number
  }
}

export interface TrainingJob {
  id: string
  name: string
  datasetId: string
  datasetName: string
  targetColumn: string
  algorithm: AlgorithmId
  instanceType: string
  hyperparameters: Record<string, number>
  status: JobStatus
  progress: number
  createdAt: string
  startedAt?: string
  endedAt?: string
  error?: string
  metrics?: EvaluationMetrics
  features: FeatureSpec[]
  origin: 'local-demo'
}

export interface EndpointState {
  name: string
  instanceType: string
  instanceCount: number
  status: EndpointStatus
  updatedAt: string
}

export interface TrainedModel {
  id: string
  name: string
  jobId: string
  datasetId: string
  datasetName: string
  targetColumn: string
  algorithm: AlgorithmId
  createdAt: string
  metrics: EvaluationMetrics
  features: FeatureSpec[]
  endpoint: EndpointState | null
  origin: 'local-demo'
}

export interface PredictionFactor {
  label: string
  direction: 'up' | 'down'
}

export interface PredictionResult {
  predictedLabel: string
  confidence?: number
  probabilities?: { label: string; value: number }[]
  factors: PredictionFactor[]
  note: string
}

export interface Prediction {
  id: string
  modelId: string
  modelName: string
  endpointName: string
  createdAt: string
  inputs: Record<string, string>
  result: PredictionResult
  origin: 'local-demo'
}

export interface ActivityItem {
  id: string
  title: string
  detail: string
  at: string
  href: string
  tone: 'neutral' | 'warning' | 'danger'
  kind: 'dataset' | 'training' | 'endpoint' | 'prediction'
}

export interface Snapshot {
  now: number
  datasets: Dataset[]
  jobs: TrainingJob[]
  models: TrainedModel[]
  predictions: Prediction[]
  storageWarning: string | null
}

export interface PersistedState {
  version: 1
  datasets: Dataset[]
  jobs: TrainingJob[]
  models: TrainedModel[]
  predictions: Prediction[]
}

export interface ParsedDataset {
  name: string
  fileName: string
  bytes: number
  rows: number
  columns: DatasetColumn[]
  preview: string[][]
}

export interface CreateJobInput {
  name: string
  datasetId: string
  targetColumn: string
  algorithm: AlgorithmId
  instanceType: string
  hyperparameters: Record<string, number>
}

export interface DeployInput {
  name: string
  instanceType: string
  instanceCount: number
}

export interface LogLine {
  at: string
  message: string
}
