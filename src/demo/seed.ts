import { CHURN_FEATURES, defaultHyperparameters } from '../domain/catalog'
import { buildMetrics } from '../domain/jobs'
import { scorePrediction } from '../domain/score'
import type { Dataset, DatasetColumn, PersistedState, Prediction, TrainingJob, TrainedModel } from '../types'

function column(
  name: string,
  type: DatasetColumn['type'],
  unique: number,
  examples: string[],
  options?: string[],
  missing = 0,
): DatasetColumn {
  return { name, type, missing, unique, uniqueCapped: false, examples, options }
}

function churnColumns(rows: number, missingNps = 0): DatasetColumn[] {
  return [
    column('account_id', 'text', rows, ['A-1044', 'A-1102', 'A-1188']),
    column('company_name', 'text', rows, ['Northwind Analytics', 'Brightline Payroll', 'Paperkite Retail']),
    column('industry', 'text', 6, ['Software', 'Finance', 'Retail'], ['Education', 'Finance', 'Healthcare', 'Logistics', 'Retail', 'Software']),
    column('plan', 'text', 3, ['growth', 'enterprise', 'starter'], ['enterprise', 'growth', 'starter']),
    column('seats', 'number', Math.min(rows, 420), ['42', '310', '6']),
    column('monthly_revenue', 'number', Math.min(rows, 3600), ['4800', '18200', '320']),
    column('tenure_months', 'number', 86, ['18', '40', '3']),
    column('support_tickets_90d', 'number', 18, ['1', '0', '7']),
    column('nps_score', 'number', 11, ['8', '9', '4'], undefined, missingNps),
    column('last_login_days', 'number', 120, ['2', '1', '28']),
    column('feature_adoption', 'number', 92, ['0.71', '0.84', '0.18']),
    column('contract_term', 'text', 2, ['annual', 'monthly'], ['annual', 'monthly']),
    column('auto_renew', 'boolean', 2, ['true', 'false'], ['false', 'true']),
    column('churned', 'boolean', 2, ['no', 'yes'], ['no', 'yes']),
  ]
}

const previewQ3 = [
  ['A-1044', 'Northwind Analytics', 'Software', 'growth', '42', '4800', '18', '1', '8', '2', '0.71', 'annual', 'true', 'no'],
  ['A-1102', 'Brightline Payroll', 'Finance', 'enterprise', '310', '18200', '40', '0', '9', '1', '0.84', 'annual', 'true', 'no'],
  ['A-1188', 'Paperkite Retail', 'Retail', 'starter', '6', '320', '3', '7', '4', '28', '0.18', 'monthly', 'false', 'yes'],
  ['A-1210', 'Harbor Clinics', 'Healthcare', 'growth', '28', '2100', '11', '2', '7', '6', '0.46', 'annual', 'true', 'no'],
  ['A-1304', 'Sable Freight', 'Logistics', 'starter', '15', '900', '5', '6', '5', '24', '0.22', 'monthly', 'false', 'yes'],
]

const previewQ2 = [
  ['A-0881', 'Oak and Ledger', 'Finance', 'enterprise', '140', '9600', '27', '1', '9', '3', '0.77', 'annual', 'true', 'no'],
  ['A-0904', 'Kindred Clinics', 'Healthcare', 'growth', '36', '2500', '9', '3', '6', '12', '0.41', 'monthly', 'true', 'no'],
  ['A-0933', 'Pebble HR', 'Software', 'starter', '8', '410', '2', '8', '3', '31', '0.12', 'monthly', 'false', 'yes'],
  ['A-0970', 'Marlowe Security', 'Software', 'growth', '54', '5100', '16', '2', '8', '4', '0.66', 'annual', 'true', 'no'],
  ['A-0991', 'Lumenfield', 'Education', 'starter', '12', '700', '4', '5', '5', '19', '0.29', 'monthly', 'false', 'yes'],
]

const previewEmea = [
  ['E-2201', 'Northline GmbH', 'Software', 'growth', '33', '3100', '13', '1', '8', '2', '0.62', 'annual', 'true', 'no'],
  ['E-2214', 'Cinder Logistics', 'Logistics', 'starter', '9', '540', '4', '6', '4', '26', '0.21', 'monthly', 'false', 'yes'],
  ['E-2240', 'Brass Education', 'Education', 'growth', '21', '1600', '8', '2', '7', '5', '0.48', 'annual', 'true', 'no'],
  ['E-2266', 'Halcyon Retail', 'Retail', 'starter', '5', '280', '2', '9', '2', '34', '0.09', 'monthly', 'false', 'yes'],
  ['E-2288', 'Vellum Finance', 'Finance', 'enterprise', '180', '12400', '36', '0', '9', '1', '0.81', 'annual', 'true', 'no'],
]

function dataset(input: {
  id: string
  name: string
  fileName: string
  bytes: number
  rows: number
  uploadedAt: string
  columns: DatasetColumn[]
  preview: string[][]
  status?: Dataset['status']
  error?: string
}): Dataset {
  return {
    id: input.id,
    name: input.name,
    fileName: input.fileName,
    bytes: input.bytes,
    rows: input.rows,
    status: input.status ?? 'ready',
    uploadedAt: input.uploadedAt,
    columns: input.status === 'failed' ? [] : input.columns,
    preview: input.status === 'failed' ? [] : input.preview,
    error: input.error,
    origin: 'local-demo',
  }
}

function completedJob(input: {
  id: string
  name: string
  datasetId: string
  datasetName: string
  algorithm: TrainingJob['algorithm']
  instanceType: string
  createdAt: string
  startedAt: string
  endedAt: string
}): TrainingJob {
  return {
    id: input.id,
    name: input.name,
    datasetId: input.datasetId,
    datasetName: input.datasetName,
    targetColumn: 'churned',
    algorithm: input.algorithm,
    instanceType: input.instanceType,
    hyperparameters: defaultHyperparameters(input.algorithm),
    status: 'completed',
    progress: 100,
    createdAt: input.createdAt,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    metrics: buildMetrics(input.algorithm, input.id),
    features: CHURN_FEATURES.map((feature) => ({ ...feature })),
    origin: 'local-demo',
  }
}

function modelFrom(job: TrainingJob, endpoint: TrainedModel['endpoint']): TrainedModel {
  if (!job.metrics) throw new Error('Seed job is missing metrics.')
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
    endpoint,
    origin: 'local-demo',
  }
}

function prediction(id: string, modelName: string, endpointName: string, createdAt: string, inputs: Record<string, string>): Prediction {
  return {
    id,
    modelId: 'model_job_xgb_q3',
    modelName,
    endpointName,
    createdAt,
    inputs,
    result: scorePrediction(CHURN_FEATURES, inputs),
    origin: 'local-demo',
  }
}

export function createSeed(now: number): PersistedState {
  const datasets: Dataset[] = [
    dataset({
      id: 'ds_bad',
      name: 'Monthly export',
      fileName: 'monthly-export.csv',
      bytes: 18432,
      rows: 0,
      uploadedAt: '2026-10-13T16:40:00.000Z',
      columns: [],
      preview: [],
      status: 'failed',
      error: 'The CSV has no header row, so columns could not be identified. Nothing was uploaded to S3.',
    }),
    dataset({
      id: 'ds_emea',
      name: 'EMEA midmarket',
      fileName: 'emea-midmarket.csv',
      bytes: 318220,
      rows: 2408,
      uploadedAt: '2026-10-09T11:12:00.000Z',
      columns: churnColumns(2408, 4),
      preview: previewEmea,
    }),
    dataset({
      id: 'ds_q3',
      name: 'Accounts Q3 2026',
      fileName: 'accounts-q3-2026.csv',
      bytes: 2411830,
      rows: 18420,
      uploadedAt: '2026-09-18T15:04:00.000Z',
      columns: churnColumns(18420),
      preview: previewQ3,
    }),
    dataset({
      id: 'ds_q2',
      name: 'Accounts Q2 2026',
      fileName: 'accounts-q2-2026.csv',
      bytes: 2100444,
      rows: 16102,
      uploadedAt: '2026-08-04T13:20:00.000Z',
      columns: churnColumns(16102, 12),
      preview: previewQ2,
    }),
  ]

  const xgb = completedJob({
    id: 'job_xgb_q3',
    name: 'xgboost-accounts-q3',
    datasetId: 'ds_q3',
    datasetName: 'Accounts Q3 2026',
    algorithm: 'xgboost',
    instanceType: 'ml.m5.xlarge',
    createdAt: '2026-09-20T14:10:00.000Z',
    startedAt: '2026-09-20T14:12:00.000Z',
    endedAt: '2026-09-20T14:21:00.000Z',
  })
  const linear = completedJob({
    id: 'job_lin_q3',
    name: 'linear-accounts-q3',
    datasetId: 'ds_q3',
    datasetName: 'Accounts Q3 2026',
    algorithm: 'linear',
    instanceType: 'ml.m5.large',
    createdAt: '2026-10-06T09:00:00.000Z',
    startedAt: '2026-10-06T09:02:00.000Z',
    endedAt: '2026-10-06T09:09:00.000Z',
  })
  const failed: TrainingJob = {
    id: 'job_rf_q2',
    name: 'forest-accounts-q2',
    datasetId: 'ds_q2',
    datasetName: 'Accounts Q2 2026',
    targetColumn: 'churned',
    algorithm: 'random_forest',
    instanceType: 'ml.c5.xlarge',
    hyperparameters: defaultHyperparameters('random_forest'),
    status: 'failed',
    progress: 46,
    createdAt: '2026-10-11T17:15:00.000Z',
    startedAt: '2026-10-11T17:17:00.000Z',
    endedAt: '2026-10-11T17:19:00.000Z',
    error: 'Simulated failure: the training split for Accounts Q2 2026 had too few churned accounts for this demo runner. No SageMaker training job was created.',
    features: CHURN_FEATURES.map((feature) => ({ ...feature })),
    origin: 'local-demo',
  }
  const running: TrainingJob = {
    id: 'job_xgb_emea',
    name: 'xgboost-emea-refresh',
    datasetId: 'ds_emea',
    datasetName: 'EMEA midmarket',
    targetColumn: 'churned',
    algorithm: 'xgboost',
    instanceType: 'ml.m5.xlarge',
    hyperparameters: defaultHyperparameters('xgboost'),
    status: 'queued',
    progress: 0,
    createdAt: new Date(now - 4000).toISOString(),
    features: CHURN_FEATURES.map((feature) => ({ ...feature })),
    origin: 'local-demo',
  }

  const models: TrainedModel[] = [
    modelFrom(linear, null),
    modelFrom(xgb, {
      name: 'churn-xgb-q3',
      instanceType: 'ml.m5.large',
      instanceCount: 1,
      status: 'in-service',
      updatedAt: '2026-10-07T15:30:00.000Z',
    }),
  ]

  const predictions: Prediction[] = [
    prediction('pred_4', xgb.name, 'churn-xgb-q3', '2026-10-14T11:05:00.000Z', {
      industry: 'Retail',
      plan: 'starter',
      seats: '6',
      monthly_revenue: '320',
      tenure_months: '3',
      support_tickets_90d: '7',
      nps_score: '4',
      last_login_days: '28',
      feature_adoption: '0.18',
      contract_term: 'monthly',
      auto_renew: 'false',
    }),
    prediction('pred_3', xgb.name, 'churn-xgb-q3', '2026-10-13T18:22:00.000Z', {
      industry: 'Finance',
      plan: 'enterprise',
      seats: '310',
      monthly_revenue: '18200',
      tenure_months: '40',
      support_tickets_90d: '0',
      nps_score: '9',
      last_login_days: '1',
      feature_adoption: '0.84',
      contract_term: 'annual',
      auto_renew: 'true',
    }),
    prediction('pred_2', xgb.name, 'churn-xgb-q3', '2026-10-12T13:05:00.000Z', {
      industry: 'Software',
      plan: 'growth',
      seats: '42',
      monthly_revenue: '4800',
      tenure_months: '14',
      support_tickets_90d: '2',
      nps_score: '8',
      last_login_days: '4',
      feature_adoption: '0.64',
      contract_term: 'annual',
      auto_renew: 'true',
    }),
    prediction('pred_1', xgb.name, 'churn-xgb-q3', '2026-10-12T09:40:00.000Z', {
      industry: 'Healthcare',
      plan: 'growth',
      seats: '28',
      monthly_revenue: '2100',
      tenure_months: '11',
      support_tickets_90d: '2',
      nps_score: '7',
      last_login_days: '6',
      feature_adoption: '0.46',
      contract_term: 'annual',
      auto_renew: 'true',
    }),
  ]

  return {
    version: 1,
    datasets,
    jobs: [running, failed, linear, xgb],
    models,
    predictions,
  }
}

export function emptyState(): PersistedState {
  return { version: 1, datasets: [], jobs: [], models: [], predictions: [] }
}
