import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getMlApi } from './api'
import { MlContext, type MlContextValue } from './mlContext'
import { errorMessage } from '../lib/errors'
import type { Snapshot } from '../types'

export function MlProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MlContextValue['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const ready = useRef(false)

  const apply = useCallback((next: Snapshot) => {
    setSnapshot(next)
    setStatus('ready')
    setError(null)
  }, [])

  useEffect(() => {
    const api = getMlApi()
    let cancelled = false
    const unsubscribe = api.subscribe((next) => {
      if (!cancelled && ready.current) apply(next)
    })
    api
      .load()
      .then((next) => {
        if (cancelled) return
        ready.current = true
        apply(next)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setStatus('error')
        setError(errorMessage(reason, 'The workspace could not be loaded.'))
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [apply])

  const reload = useCallback(async () => {
    ready.current = false
    setStatus('loading')
    try {
      const next = await getMlApi().load()
      ready.current = true
      apply(next)
    } catch (reason) {
      setStatus('error')
      setError(errorMessage(reason, 'The workspace could not be loaded.'))
    }
  }, [apply])

  const finishLocalChange = useCallback(async (work: () => Promise<void>) => {
    await work()
    ready.current = true
    apply(getMlApi().read())
  }, [apply])

  const value = useMemo<MlContextValue>(() => {
    const api = getMlApi()
    return {
      status,
      error,
      snapshot,
      reload,
      addDataset: (parsed) => api.addDataset(parsed),
      deleteDataset: (id) => api.deleteDataset(id),
      createJob: (input) => api.createJob(input),
      stopJob: (id) => api.stopJob(id),
      deployModel: (id, input) => api.deployModel(id, input),
      stopEndpoint: (id) => api.stopEndpoint(id),
      predict: (modelId, inputs) => api.predict(modelId, inputs),
      clear: () => finishLocalChange(() => api.clear()),
      restore: () => finishLocalChange(() => api.restore()),
    }
  }, [status, error, snapshot, reload, finishLocalChange])

  return <MlContext.Provider value={value}>{children}</MlContext.Provider>
}
