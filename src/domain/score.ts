import type { FeatureSpec, PredictionResult } from '../types'

const RULE_FIELDS = [
  'industry',
  'plan',
  'seats',
  'monthly_revenue',
  'tenure_months',
  'support_tickets_90d',
  'nps_score',
  'last_login_days',
  'feature_adoption',
  'contract_term',
  'auto_renew',
] as const

export function scorePrediction(features: FeatureSpec[], inputs: Record<string, string>): PredictionResult {
  const names = new Set(features.map((feature) => feature.name))
  const canUseRules = RULE_FIELDS.every((field) => names.has(field))
  if (!canUseRules) return placeholderScore(inputs)

  let probability = 0.28
  const factors: PredictionResult['factors'] = []

  const contract = inputs.contract_term
  if (contract === 'monthly') {
    probability += 0.16
    factors.push({ label: 'Monthly contract added risk', direction: 'up' })
  } else if (contract === 'annual') {
    probability -= 0.06
    factors.push({ label: 'Annual contract lowered risk', direction: 'down' })
  }

  const tenure = numberValue(inputs.tenure_months)
  if (tenure < 6) {
    probability += 0.14
    factors.push({ label: 'Tenure under 6 months added risk', direction: 'up' })
  } else if (tenure > 24) {
    probability -= 0.08
    factors.push({ label: 'Tenure over 24 months lowered risk', direction: 'down' })
  }

  const tickets = numberValue(inputs.support_tickets_90d)
  if (tickets >= 5) {
    probability += 0.12
    factors.push({ label: '5 or more support tickets added risk', direction: 'up' })
  } else if (tickets <= 1) {
    probability -= 0.04
    factors.push({ label: 'Few support tickets lowered risk', direction: 'down' })
  }

  const lastLogin = numberValue(inputs.last_login_days)
  if (lastLogin >= 21) {
    probability += 0.12
    factors.push({ label: 'No login for 21 days or more added risk', direction: 'up' })
  } else if (lastLogin <= 3) {
    probability -= 0.05
    factors.push({ label: 'A recent login lowered risk', direction: 'down' })
  }

  const adoption = numberValue(inputs.feature_adoption)
  if (adoption < 0.35) {
    probability += 0.1
    factors.push({ label: 'Low feature adoption added risk', direction: 'up' })
  } else if (adoption > 0.7) {
    probability -= 0.06
    factors.push({ label: 'High feature adoption lowered risk', direction: 'down' })
  }

  const nps = numberValue(inputs.nps_score)
  if (nps <= 6) {
    probability += 0.08
    factors.push({ label: 'NPS of 6 or lower added risk', direction: 'up' })
  } else if (nps >= 9) {
    probability -= 0.05
    factors.push({ label: 'NPS of 9 or higher lowered risk', direction: 'down' })
  }

  const plan = inputs.plan
  if (plan === 'starter') {
    probability += 0.06
    factors.push({ label: 'Starter plan added risk', direction: 'up' })
  } else if (plan === 'enterprise') {
    probability -= 0.05
    factors.push({ label: 'Enterprise plan lowered risk', direction: 'down' })
  }

  const renew = parseBoolean(inputs.auto_renew)
  if (renew === false) {
    probability += 0.07
    factors.push({ label: 'Auto renew off added risk', direction: 'up' })
  } else if (renew === true) {
    probability -= 0.04
    factors.push({ label: 'Auto renew on lowered risk', direction: 'down' })
  }

  const seats = numberValue(inputs.seats)
  if (seats < 10) {
    probability += 0.04
    factors.push({ label: 'Fewer than 10 seats added risk', direction: 'up' })
  } else if (seats > 200) {
    probability -= 0.04
    factors.push({ label: 'More than 200 seats lowered risk', direction: 'down' })
  }

  const revenue = numberValue(inputs.monthly_revenue)
  if (revenue < 500) {
    probability += 0.05
    factors.push({ label: 'Monthly revenue under $500 added risk', direction: 'up' })
  } else if (revenue > 8000) {
    probability -= 0.04
    factors.push({ label: 'Monthly revenue over $8,000 lowered risk', direction: 'down' })
  }

  const industry = inputs.industry
  if (industry === 'Retail') {
    probability += 0.03
    factors.push({ label: 'Retail industry added a little risk', direction: 'up' })
  } else if (industry === 'Finance' || industry === 'Healthcare') {
    probability -= 0.03
    factors.push({ label: `${industry} industry lowered risk slightly`, direction: 'down' })
  }

  const churnProbability = clamp(round2(probability), 0.04, 0.96)
  const stayProbability = round2(1 - churnProbability)
  const predictedLabel = churnProbability >= 0.5 ? 'Likely to churn' : 'Likely to stay'
  const confidence = predictedLabel === 'Likely to churn' ? churnProbability : stayProbability

  return {
    predictedLabel,
    confidence,
    probabilities: [
      { label: 'Likely to stay', value: stayProbability },
      { label: 'Likely to churn', value: churnProbability },
    ],
    factors,
    note: 'Calculated in this browser with demo rules. This is not a SageMaker inference response.',
  }
}

function placeholderScore(inputs: Record<string, string>): PredictionResult {
  const serialized = Object.keys(inputs)
    .sort()
    .map((key) => `${key}=${inputs[key] ?? ''}`)
    .join('|')
  const unit = hashUnit(serialized)
  const predictedLabel = unit > 0.62 ? 'Likely to churn' : 'Likely to stay'
  return {
    predictedLabel,
    factors: [],
    note: 'This demo has no scoring rules for these fields, so no confidence score was produced. Nothing was sent to SageMaker.',
  }
}

function numberValue(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseBoolean(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'true' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === 'no') return false
  return null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function hashUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 2 ** 32
}
