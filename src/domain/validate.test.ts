import { describe, expect, it } from 'vitest'
import { defaultHyperparameters } from './catalog'
import { validateDeploy, validatePrediction, validateTraining } from './validate'
import { createSeed } from '../demo/seed'
import type { TrainingFormInput } from './validate'

const datasets = createSeed(Date.parse('2026-10-14T12:00:00.000Z')).datasets

function form(overrides: Partial<TrainingFormInput> = {}): TrainingFormInput {
  const hyperparameters = Object.fromEntries(
    Object.entries(defaultHyperparameters('xgboost')).map(([key, value]) => [key, String(value)]),
  )
  return {
    name: 'xgboost pilot',
    datasetId: 'ds_q3',
    targetColumn: 'churned',
    algorithm: 'xgboost',
    instanceType: 'ml.m5.xlarge',
    hyperparameters,
    ...overrides,
  }
}

describe('validateTraining', () => {
  it('accepts a complete demo job', () => {
    const result = validateTraining(form(), datasets)
    expect(result.ok).toBe(true)
  })

  it('explains a bad name, a failed dataset, and a hyperparameter', () => {
    const hyperparameters = Object.fromEntries(
      Object.entries(defaultHyperparameters('xgboost')).map(([key, value]) => [key, String(value)]),
    )
    hyperparameters.max_depth = '40'
    const result = validateTraining(
      form({ name: '!!', datasetId: 'ds_bad', hyperparameters }),
      datasets,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.name).toMatch(/3 to 48/)
    expect(result.errors.datasetId).toMatch(/ready/)
    expect(result.errors['hp:max_depth']).toMatch(/between 2 and 12/)
  })
})

describe('validateDeploy', () => {
  it('rejects an endpoint name that starts with a hyphen', () => {
    const result = validateDeploy({ name: '-demo', instanceType: 'ml.m5.large', instanceCount: '1' })
    expect(result.ok).toBe(false)
  })
})

describe('validatePrediction', () => {
  it('requires the known churn fields to be in range', () => {
    const features = createSeed(Date.now()).models[0]?.features ?? []
    const inputs = Object.fromEntries(features.map((feature) => [feature.name, feature.sample]))
    expect(validatePrediction(features, inputs).ok).toBe(true)
    const invalid = validatePrediction(features, { ...inputs, nps_score: '14' })
    expect(invalid.ok).toBe(false)
  })
})
