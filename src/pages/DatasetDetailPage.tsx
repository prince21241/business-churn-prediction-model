import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { BackLink, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { Button, ButtonLink } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/Feedback'
import { StatusPill } from '../components/ui/StatusPill'
import { useToast } from '../components/ui/toastContext'
import { useMl } from '../demo/mlContext'
import { errorMessage } from '../lib/errors'
import { formatBytes, formatDateTime, formatNumber } from '../lib/format'
import type { ColumnType, Dataset } from '../types'

export function DatasetDetailPage() {
  const { datasetId } = useParams()
  return (
    <WorkspaceGate label="Loading dataset">
      {(snapshot) => {
        const dataset = snapshot.datasets.find((item) => item.id === datasetId)
        if (!dataset) {
          return (
            <EmptyState
              icon={Inbox}
              title="Dataset not found"
              body="It may have been removed from this browser."
              action={<ButtonLink to="/datasets">Back to datasets</ButtonLink>}
            />
          )
        }
        return <DatasetDetail dataset={dataset} />
      }}
    </WorkspaceGate>
  )
}

function DatasetDetail({ dataset }: { dataset: Dataset }) {
  const { deleteDataset } = useMl()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)

  return (
    <>
      <BackLink to="/datasets">Datasets</BackLink>
      <div className="mt-3">
        <PageHeader
          title={dataset.name}
          description={dataset.fileName}
          actions={
            <>
              <StatusPill status={dataset.status} />
              <Button variant="danger" onClick={() => setConfirm(true)}>
                Remove dataset
              </Button>
            </>
          }
        />
      </div>
      <dl className="mb-4 grid gap-3 sm:grid-cols-3">
        <Meta label="Rows" value={dataset.status === 'failed' ? '—' : formatNumber(dataset.rows)} />
        <Meta label="Size" value={formatBytes(dataset.bytes)} />
        <Meta label="Added" value={formatDateTime(dataset.uploadedAt)} />
      </dl>
      {dataset.status === 'failed' ? (
        <Panel className="p-5">
          <h2 className="text-base font-semibold text-ink">Why this dataset failed</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{dataset.error}</p>
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-ink">Columns</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-soft">
                    <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Type</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Missing</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Distinct</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Examples</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.columns.map((column) => (
                    <tr key={column.name} className="border-b border-line last:border-0">
                      <th scope="row" className="px-3 py-2 font-semibold text-ink">{column.name}</th>
                      <td className="px-3 py-2">{typeLabel(column.type)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(column.missing)}</td>
                      <td className="px-3 py-2 tabular-nums">{column.uniqueCapped ? '5,000+' : formatNumber(column.unique)}</td>
                      <td className="px-3 py-2 text-ink-soft">{column.examples.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-ink">Sample rows</h2>
            <p className="mt-1 text-sm text-ink-soft">
              First {formatNumber(dataset.preview.length)} of {formatNumber(dataset.rows)} rows. The full file is not kept after parsing.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <caption className="sr-only">Sample rows from {dataset.fileName}</caption>
                <thead>
                  <tr className="border-b border-line text-ink-soft">
                    {dataset.columns.map((column) => (
                      <th key={column.name} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.preview.map((row, rowIndex) => (
                    <tr key={`${dataset.id}-row-${rowIndex}`} className="border-b border-line last:border-0">
                      {dataset.columns.map((column, columnIndex) => (
                        <td key={column.name} className="max-w-48 truncate px-3 py-2 whitespace-nowrap">
                          {row[columnIndex] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
      {confirm ? (
        <Dialog
          title={`Remove ${dataset.name}?`}
          confirmLabel="Remove dataset"
          tone="danger"
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            try {
              await deleteDataset(dataset.id)
              toast.success('Dataset removed', 'It was deleted from this browser only.')
              navigate('/datasets')
            } catch (error) {
              toast.error('Could not remove dataset', errorMessage(error, 'Try again.'))
              throw error
            }
          }}
        >
          Training jobs that already used it will keep its name. This does not delete anything from AWS.
        </Dialog>
      ) : null}
    </>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  )
}

function typeLabel(type: ColumnType): string {
  if (type === 'number') return 'Number'
  if (type === 'boolean') return 'Boolean'
  return 'Text'
}
