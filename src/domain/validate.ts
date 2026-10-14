import {
  ALGORITHMS,
  HOSTING_INSTANCES,
  TRAINING_INSTANCES,
  isAlgorithm,
} from './algorithms'
import { featuresForTraining, targetIssue } from './csv'
import { parseBoolean } from './score'
import type { CreateJobInput, Dataset, DeployInput, FeatureSpec } from '../types'

export type FieldErrors = Record<string, string>

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors }

export interface TrainingFormInput {
  name: string
  datasetId: string
  targetColumn: string
  algorithm: string
  instanceType: string
  hyperparameters: Record<string, string>
}

export function validateTraining(input: TrainingFormInput, datasets: Dataset[]): Validation<CreateJobInput> {
  const errors: FieldErrors = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Enter a job name.'
  else if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,47}$/.test(name)) {
    errors.name = 'Use 3 to 48 characters: letters, numbers, spaces, and hyphens.'
  }

  const dataset = datasets.find((item) => item.id === input.datasetId)
  if (!input.datasetId) errors.datasetId = 'Select a dataset.'
  else if (!dataset) errors.datasetId = 'That dataset is no longer in this browser.'
  else if (dataset.status !== 'ready') errors.datasetId = 'Only a ready dataset can be used for a demo job.'

  if (dataset && !errors.datasetId) {
    const column = dataset.columns.find((item) => item.name === input.targetColumn)
    const issue = targetIssue(column)
    if (!input.targetColumn) errors.targetColumn = 'Select a target column.'
    else if (issue) errors.targetColumn = issue
    else if (featuresForTraining(dataset.columns, input.targetColumn).length === 0) {
      errors.targetColumn = 'This dataset has no feature columns besides the target and identifiers.'
    }
  }

  if (!isAlgorithm(input.algorithm)) errors.algorithm = 'Select an algorithm.'
  if (!TRAINING_INSTANCES.some((item) => item.id === input.instanceType)) {
    errors.instanceType = 'Select a training instance type.'
  }

  const hyperparameters: Record<string, number> = {}
  if (isAlgorithm(input.algorithm)) {
    for (const spec of ALGORITHMS[input.algorithm].hyperparameters) {
      const raw = input.hyperparameters[spec.key]?.trim() ?? ''
      const id = `hp:${spec.key}`
      if (!raw) {
        errors[id] = `Enter a value for ${spec.label.toLowerCase()}.`
        continue
      }
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        errors[id] = `${spec.label} must be a number.`
        continue
      }
      if (spec.integer && !Number.isInteger(value)) {
        errors[id] = `${spec.label} must be a whole number.`
        continue
      }
      if (value < spec.min || value > spec.max) {
        errors[id] = `${spec.label} must be between ${spec.min} and ${spec.max}.`
        continue
      }
      hyperparameters[spec.key] = value
    }
  }

  if (Object.keys(errors).length > 0 || !dataset || !isAlgorithm(input.algorithm)) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      name,
      datasetId: dataset.id,
      targetColumn: input.targetColumn,
      algorithm: input.algorithm,
      instanceType: input.instanceType,
      hyperparameters,
    },
  }
}

export function validateDeploy(input: { name: string; instanceType: string; instanceCount: string }): Validation<DeployInput> {
  const errors: FieldErrors = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Enter an endpoint name.'
  else if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(name)) {
    errors.name = 'Use 1 to 63 letters, numbers, and hyphens. It cannot start or end with a hyphen.'
  }
  if (!HOSTING_INSTANCES.some((item) => item.id === input.instanceType)) {
    errors.instanceType = 'Select a hosting instance type.'
  }
  const count = Number(input.instanceCount)
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    errors.instanceCount = 'Choose 1 to 4 instances.'
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { name, instanceType: input.instanceType, instanceCount: count } }
}

export function validatePrediction(
  features: FeatureSpec[],
  inputs: Record<string, string>,
): Validation<Record<string, string>> {
  const errors: FieldErrors = {}
  const value: Record<string, string> = {}
  for (const feature of features) {
    const raw = inputs[feature.name]?.trim() ?? ''
    if (!raw) {
      errors[feature.name] = `Enter ${feature.label.toLowerCase()}.`
      continue
    }
    if (feature.kind === 'number') {
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        errors[feature.name] = `${feature.label} must be a number.`
        continue
      }
      if (feature.integer && !Number.isInteger(parsed)) {
        errors[feature.name] = `${feature.label} must be a whole number.`
        continue
      }
      if (feature.min !== undefined && parsed < feature.min) {
        errors[feature.name] = `${feature.label} must be at least ${feature.min}.`
        continue
      }
      if (feature.max !== undefined && parsed > feature.max) {
        errors[feature.name] = `${feature.label} must be at most ${feature.max}.`
        continue
      }
      value[feature.name] = String(parsed)
      continue
    }
    if (feature.kind === 'boolean') {
      const parsed = parseBoolean(raw)
      if (parsed === null) {
        errors[feature.name] = `${feature.label} must be true or false.`
        continue
      }
      value[feature.name] = parsed ? 'true' : 'false'
      continue
    }
    if (feature.kind === 'select') {
      if (feature.options && !feature.options.includes(raw)) {
        errors[feature.name] = `Choose a listed value for ${feature.label.toLowerCase()}.`
        continue
      }
    }
    value[feature.name] = raw
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value }
}

export function parsePredictionJson(
  text: string,
  features: FeatureSpec[],
): Validation<Record<string, string>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, errors: { json: 'Enter a JSON object. Check for missing commas or quotes.' } }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: { json: 'The JSON must be an object of feature names to values.' } }
  }
  const record = parsed as Record<string, unknown>
  const allowed = new Set(features.map((feature) => feature.name))
  const unknown = Object.keys(record).filter((key) => !allowed.has(key))
  if (unknown.length > 0) {
    return {
      ok: false,
      errors: { json: `Remove unknown fields: ${unknown.join(', ')}.` },
    }
  }
  const inputs: Record<string, string> = {}
  for (const feature of features) {
    const raw = record[feature.name]
    if (raw === undefined || raw === null) {
      inputs[feature.name] = ''
    } else if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      inputs[feature.name] = String(raw)
    } else {
      return {
        ok: false,
        errors: { json: `${feature.label} must be a string, number, or boolean.` },
      }
    }
  }
  const validated = validatePrediction(features, inputs)
  if (!validated.ok) {
    const first = Object.values(validated.errors)[0] ?? 'Check the feature values.'
    return { ok: false, errors: { json: first, ...validated.errors } }
  }
  return validated
}
