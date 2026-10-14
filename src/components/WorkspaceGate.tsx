import type { ReactNode } from 'react'
import { useMl } from '../demo/mlContext'
import type { Snapshot } from '../types'
import { ErrorState, PageSkeleton } from './ui/Feedback'

export function WorkspaceGate({
  label,
  skeleton,
  children,
}: {
  label: string
  skeleton?: ReactNode
  children: (snapshot: Snapshot) => ReactNode
}) {
  const { status, error, snapshot, reload, restore } = useMl()
  if (status === 'error') {
    return (
      <ErrorState
        message={error ?? 'Saved demo data could not be read.'}
        onRetry={() => void reload()}
        onRestore={() => void restore()}
      />
    )
  }
  if (status === 'loading' || !snapshot) return skeleton ?? <PageSkeleton label={label} />
  return children(snapshot)
}
