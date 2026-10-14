import type { AlgorithmId, FeatureSpec } from '../types'

export interface HyperParameterSpec {
  key: string
  label: string
  min: number
  max: number
  step: number
  integer: boolean
  defaultValue: number
  hint: string
}

export interface AlgorithmSpec {
  id: AlgorithmId
  label: string
  summary: string
  hyperparameters: HyperParameterSpec[]
}

export interface InstanceSpec {
  id: string
  label: string
  detail: string
}

export const SIMULATED_QUEUE_MS = 1600
export const SIMULATED_RUN_MS = 12000
export const SIMULATED_DEPLOY_MS = 5000
export const MAX_CSV_BYTES = 8 * 1024 * 1024
export const MAX_CSV_ROWS = 200_000

export const ALGORITHMS: Record<AlgorithmId, AlgorithmSpec> = {
  xgboost: {
    id: 'xgboost',
    label: 'XGBoost',
    summary: 'Gradient-boosted trees, a common SageMaker built-in for tabular classification.',
    hyperparameters: [
      {
        key: 'max_depth',
        label: 'Max depth',
        min: 2,
        max: 12,
        step: 1,
        integer: true,
        defaultValue: 6,
        hint: 'Tree depth. Higher values fit finer splits.',
      },
      {
        key: 'eta',
        label: 'Learning rate (eta)',
        min: 0.01,
        max: 0.5,
        step: 0.01,
        integer: false,
        defaultValue: 0.2,
        hint: 'Shrinks each boosting step.',
      },
      {
        key: 'num_round',
        label: 'Rounds',
        min: 50,
        max: 500,
        step: 1,
        integer: true,
        defaultValue: 120,
        hint: 'Number of boosting rounds.',
      },
      {
        key: 'subsample',
        label: 'Subsample',
        min: 0.5,
        max: 1,
        step: 0.05,
        integer: false,
        defaultValue: 0.8,
        hint: 'Fraction of rows used per round.',
      },
    ],
  },
  linear: {
    id: 'linear',
    label: 'Linear Learner',
    summary: 'A linear binary classifier in the style of the SageMaker Linear Learner.',
    hyperparameters: [
      {
        key: 'epochs',
        label: 'Epochs',
        min: 10,
        max: 200,
        step: 1,
        integer: true,
        defaultValue: 40,
        hint: 'Passes over the training split.',
      },
      {
        key: 'learning_rate',
        label: 'Learning rate',
        min: 0.001,
        max: 0.3,
        step: 0.001,
        integer: false,
        defaultValue: 0.05,
        hint: 'Step size for the linear fit.',
      },
      {
        key: 'l1',
        label: 'L1',
        min: 0,
        max: 1,
        step: 0.01,
        integer: false,
        defaultValue: 0.01,
        hint: 'L1 regularization strength.',
      },
    ],
  },
  random_forest: {
    id: 'random_forest',
    label: 'Random Forest',
    summary: 'An ensemble of decision trees, often run in SageMaker script mode.',
    hyperparameters: [
      {
        key: 'n_estimators',
        label: 'Trees',
        min: 20,
        max: 400,
        step: 1,
        integer: true,
        defaultValue: 150,
        hint: 'Number of trees in the forest.',
      },
      {
        key: 'max_depth',
        label: 'Max depth',
        min: 2,
        max: 20,
        step: 1,
        integer: true,
        defaultValue: 10,
        hint: 'Maximum depth of each tree.',
      },
      {
        key: 'min_samples_leaf',
        label: 'Min samples per leaf',
        min: 1,
        max: 50,
        step: 1,
        integer: true,
        defaultValue: 2,
        hint: 'Minimum rows required in a leaf.',
      },
    ],
  },
  catboost: {
    id: 'catboost',
    label: 'CatBoost',
    summary: 'Gradient boosting that handles categorical columns with little encoding.',
    hyperparameters: [
      {
        key: 'iterations',
        label: 'Iterations',
        min: 50,
        max: 500,
        step: 1,
        integer: true,
        defaultValue: 180,
        hint: 'Boosting iterations.',
      },
      {
        key: 'learning_rate',
        label: 'Learning rate',
        min: 0.01,
        max: 0.5,
        step: 0.01,
        integer: false,
        defaultValue: 0.08,
        hint: 'Shrinks each iteration.',
      },
      {
        key: 'depth',
        label: 'Depth',
        min: 2,
        max: 10,
        step: 1,
        integer: true,
        defaultValue: 6,
        hint: 'Tree depth.',
      },
    ],
  },
}

export const TRAINING_INSTANCES: InstanceSpec[] = [
  { id: 'ml.m5.large', label: 'ml.m5.large', detail: '2 vCPU · 8 GiB' },
  { id: 'ml.m5.xlarge', label: 'ml.m5.xlarge', detail: '4 vCPU · 16 GiB' },
  { id: 'ml.m5.2xlarge', label: 'ml.m5.2xlarge', detail: '8 vCPU · 32 GiB' },
  { id: 'ml.c5.xlarge', label: 'ml.c5.xlarge', detail: '4 vCPU · 8 GiB' },
]

export const HOSTING_INSTANCES: InstanceSpec[] = [
  { id: 'ml.t2.medium', label: 'ml.t2.medium', detail: '2 vCPU · 4 GiB' },
  { id: 'ml.m5.large', label: 'ml.m5.large', detail: '2 vCPU · 8 GiB' },
  { id: 'ml.m5.xlarge', label: 'ml.m5.xlarge', detail: '4 vCPU · 16 GiB' },
]

export const CHURN_FEATURES: FeatureSpec[] = [
  {
    name: 'industry',
    label: 'Industry',
    kind: 'select',
    sample: 'Software',
    options: ['Software', 'Healthcare', 'Logistics', 'Finance', 'Retail', 'Education'],
    hint: 'Primary industry for the account.',
  },
  {
    name: 'plan',
    label: 'Plan',
    kind: 'select',
    sample: 'growth',
    options: ['starter', 'growth', 'enterprise'],
    hint: 'Current subscription plan.',
  },
  {
    name: 'seats',
    label: 'Seats',
    kind: 'number',
    sample: '24',
    min: 1,
    max: 100000,
    integer: true,
    hint: 'Licensed seats on the account.',
  },
  {
    name: 'monthly_revenue',
    label: 'Monthly revenue',
    kind: 'number',
    sample: '2400',
    min: 0,
    max: 10000000,
    hint: 'Recurring revenue in USD.',
  },
  {
    name: 'tenure_months',
    label: 'Tenure (months)',
    kind: 'number',
    sample: '14',
    min: 0,
    max: 600,
    integer: true,
    hint: 'Months since the account started.',
  },
  {
    name: 'support_tickets_90d',
    label: 'Support tickets (90 days)',
    kind: 'number',
    sample: '2',
    min: 0,
    max: 1000,
    integer: true,
    hint: 'Tickets opened in the last 90 days.',
  },
  {
    name: 'nps_score',
    label: 'NPS score',
    kind: 'number',
    sample: '8',
    min: 0,
    max: 10,
    integer: true,
    hint: 'Latest survey score from 0 to 10.',
  },
  {
    name: 'last_login_days',
    label: 'Days since last login',
    kind: 'number',
    sample: '4',
    min: 0,
    max: 3650,
    integer: true,
    hint: 'Days since any user on the account signed in.',
  },
  {
    name: 'feature_adoption',
    label: 'Feature adoption',
    kind: 'number',
    sample: '0.64',
    min: 0,
    max: 1,
    hint: 'Share of core features used, from 0 to 1.',
  },
  {
    name: 'contract_term',
    label: 'Contract term',
    kind: 'select',
    sample: 'annual',
    options: ['monthly', 'annual'],
    hint: 'Billing commitment.',
  },
  {
    name: 'auto_renew',
    label: 'Auto renew',
    kind: 'boolean',
    sample: 'true',
    hint: 'Whether the contract renews automatically.',
  },
]

const FEATURE_BY_NAME = new Map(CHURN_FEATURES.map((feature) => [feature.name, feature]))

export function knownFeature(name: string): FeatureSpec | undefined {
  return FEATURE_BY_NAME.get(name)
}

export function defaultHyperparameters(algorithm: AlgorithmId): Record<string, number> {
  const values: Record<string, number> = {}
  for (const spec of ALGORITHMS[algorithm].hyperparameters) {
    values[spec.key] = spec.defaultValue
  }
  return values
}

export function algorithmLabel(algorithm: AlgorithmId): string {
  return ALGORITHMS[algorithm].label
}
