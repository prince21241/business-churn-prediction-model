import { createContext, useContext } from 'react'
import type { CreateJobInput, Dataset, DeployInput, ParsedDataset, Prediction, Snapshot, TrainedModel, TrainingJob } from '../types'

export interface MlContextValue {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  snapshot: Snapshot | null
  reload: () => Promise<void>
  addDataset: (parsed: ParsedDataset) => Promise<Dataset>
  deleteDataset: (id: string) => Promise<void>
  createJob: (input: CreateJobInput) => Promise<TrainingJob>
  stopJob: (id: string) => Promise<void>
  deployModel: (id: string, input: DeployInput) => Promise<TrainedModel>
  stopEndpoint: (id: string) => Promise<void>
  predict: (modelId: string, inputs: Record<string, string>) => Promise<Prediction>
  clear: () => Promise<void>
  restore: () => Promise<void>
}

export const MlContext = createContext<MlContextValue | null>(null)

export function useMl(): MlContextValue {
  const value = useContext(MlContext)
  if (!value) throw new Error('Workspace data is unavailable.')
  return value
}
