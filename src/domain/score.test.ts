import { describe, expect, it } from 'vitest'
import { CHURN_FEATURES } from './catalog'
import { scorePrediction } from './score'
import type { FeatureSpec } from '../types'

const highRisk = {
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
}

const lowRisk = {
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
}

describe('scorePrediction', () => {
  it('raises churn probability for fragile accounts and explains why', () => {
    const result = scorePrediction(CHURN_FEATURES, highRisk)
    expect(result.predictedLabel).toBe('Likely to churn')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.factors.some((factor) => factor.direction === 'up')).toBe(true)
    expect(result.note).toMatch(/not a SageMaker/)
  })

  it('lowers churn probability for established accounts', () => {
    const result = scorePrediction(CHURN_FEATURES, lowRisk)
    expect(result.predictedLabel).toBe('Likely to stay')
    expect(result.confidence).toBeGreaterThan(0.5)
    const churn = result.probabilities?.find((item) => item.label === 'Likely to churn')
    expect(churn?.value).toBeLessThan(0.5)
  })

  it('omits confidence when the columns are outside the demo rules', () => {
    const features: FeatureSpec[] = [
      { name: 'city', label: 'City', kind: 'text', sample: 'Paris' },
    ]
    const result = scorePrediction(features, { city: 'Paris' })
    expect(result.confidence).toBeUndefined()
    expect(result.probabilities).toBeUndefined()
    expect(result.note).toMatch(/no confidence score/)
  })
})
