import { ALGORITHM_IDS, type AlgorithmId } from '../types'

export function isAlgorithm(value: string): value is AlgorithmId {
  return (ALGORITHM_IDS as readonly string[]).includes(value)
}

export { ALGORITHMS, HOSTING_INSTANCES, TRAINING_INSTANCES } from './catalog'
