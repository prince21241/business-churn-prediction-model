import { describe, expect, it } from 'vitest'
import { defaultHyperparameters } from '../domain/catalog'
import { inspectCsv } from '../domain/csv'
import { createDemoApi, type KeyValueStore } from './api'

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

describe('createDemoApi', () => {
  it('loads sample data without calling the network', async () => {
    const calls: string[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async () => {
      calls.push('fetch')
      throw new Error('network should not be used')
    }) as typeof fetch
    try {
      const api = createDemoApi(memoryStore(), { latencyMs: 0, mutationMs: 0 })
      const snapshot = await api.load()
      expect(snapshot.datasets.length).toBeGreaterThan(0)
      expect(snapshot.models.some((model) => model.endpoint?.status === 'in-service')).toBe(true)
      expect(calls).toEqual([])
    } finally {
      globalThis.fetch = original
    }
  })

  it('reports unreadable saved data and can restore the sample', async () => {
    const store = memoryStore()
    store.setItem('churn-studio.demo.v1', '{')
    const api = createDemoApi(store, { latencyMs: 0, mutationMs: 0 })
    await expect(api.load()).rejects.toThrow(/could not be read/)
    await api.restore()
    expect(api.read().datasets.length).toBeGreaterThan(0)
  })

  it('keeps an explicitly cleared workspace empty', async () => {
    const api = createDemoApi(memoryStore(), { latencyMs: 0, mutationMs: 0 })
    await api.load()
    await api.clear()
    expect(api.read().datasets).toHaveLength(0)
    expect((await api.load()).jobs).toHaveLength(0)
  })

  it('completes a simulated job locally and scores an unfamiliar schema without confidence', async () => {
    let now = Date.parse('2026-10-14T12:00:00.000Z')
    const api = createDemoApi(memoryStore(), { latencyMs: 0, mutationMs: 0, now: () => now })
    await api.load()
    const parsed = inspectCsv('cities.csv', 24, 'city,label\nParis,yes\nLyon,no\n')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const dataset = await api.addDataset(parsed.dataset)
    const job = await api.createJob({
      name: 'city linear',
      datasetId: dataset.id,
      targetColumn: 'label',
      algorithm: 'linear',
      instanceType: 'ml.m5.large',
      hyperparameters: defaultHyperparameters('linear'),
    })
    now += 20_000
    const completed = api.read().jobs.find((item) => item.id === job.id)
    expect(completed?.status).toBe('completed')
    const model = api.read().models.find((item) => item.jobId === job.id)
    expect(model).toBeTruthy()
    if (!model) return
    await api.deployModel(model.id, { name: 'city-demo', instanceType: 'ml.t2.medium', instanceCount: 1 })
    expect(api.read().models.find((item) => item.id === model.id)?.endpoint?.status).toBe('creating')
    now += 6_000
    const prediction = await api.predict(model.id, { city: 'Paris' })
    expect(prediction.origin).toBe('local-demo')
    expect(prediction.result.confidence).toBeUndefined()
    expect(prediction.result.note).toMatch(/Nothing was sent to SageMaker/)
  })

  it('refuses a prediction when the demo endpoint is stopped', async () => {
    const api = createDemoApi(memoryStore(), { latencyMs: 0, mutationMs: 0 })
    const snapshot = await api.load()
    const model = snapshot.models.find((item) => item.endpoint?.status === 'in-service')
    expect(model).toBeTruthy()
    if (!model) return
    await api.stopEndpoint(model.id)
    const inputs = Object.fromEntries(model.features.map((feature) => [feature.name, feature.sample]))
    await expect(api.predict(model.id, inputs)).rejects.toThrow(/in service/)
  })
})
