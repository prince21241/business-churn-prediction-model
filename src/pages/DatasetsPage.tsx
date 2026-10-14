import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { DemoNote, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { Button } from '../components/ui/Button'
import { EmptyState, ProgressBar } from '../components/ui/Feedback'
import { SegmentedFilter } from '../components/ui/SegmentedFilter'
import { StatusPill } from '../components/ui/StatusPill'
import { useToast } from '../components/ui/toastContext'
import { MAX_CSV_BYTES } from '../domain/catalog'
import { inspectCsv } from '../domain/csv'
import { useMl } from '../demo/mlContext'
import { errorMessage } from '../lib/errors'
import { formatBytes, formatDateTime, formatNumber } from '../lib/format'
import { readFileText } from '../lib/readFile'
import type { Dataset, DatasetStatus, Snapshot } from '../types'

const FILTERS: { value: 'all' | DatasetStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
]

type UploadState =
  | { phase: 'idle' }
  | { phase: 'reading'; name: string; progress: number }
  | { phase: 'checking' | 'saving'; name: string }
  | { phase: 'error'; message: string }

export function DatasetsPage() {
  return (
    <WorkspaceGate label="Loading datasets">
      {(snapshot) => <Datasets snapshot={snapshot} />}
    </WorkspaceGate>
  )
}

function Datasets({ snapshot }: { snapshot: Snapshot }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<(typeof FILTERS)[number]['value']>('all')
  const normalized = query.trim().toLowerCase()
  const filtered = snapshot.datasets.filter((dataset) => {
    const matchesStatus = status === 'all' || dataset.status === status
    const haystack = `${dataset.name} ${dataset.fileName}`.toLowerCase()
    return matchesStatus && (normalized.length === 0 || haystack.includes(normalized))
  })

  return (
    <>
      <PageHeader
        title="Datasets"
        description="Search the datasets stored in this browser, or parse a new CSV locally."
        demo={<DemoNote>Files are read on this device and are not uploaded to S3 or SageMaker.</DemoNote>}
      />
      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <UploadPanel />
        <div className="min-w-0">
          <Panel className="p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <label htmlFor="dataset-search" className="mb-1 block text-sm font-semibold text-ink">
                  Search
                </label>
                <input
                  id="dataset-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name or file"
                  className="min-h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-soft"
                />
              </div>
              <SegmentedFilter label="Status" value={status} options={FILTERS} onChange={setStatus} />
            </div>
          </Panel>
          <p className="mt-4 text-sm text-ink-soft" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'dataset' : 'datasets'}
          </p>
          <div className="mt-3">
            {snapshot.datasets.length === 0 ? (
              <EmptyState icon={Inbox} title="No datasets yet" body="Drop a CSV on the left to parse columns and sample rows in this browser." />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No datasets match"
                body={
                  status === 'processing'
                    ? 'No datasets are processing. Local uploads become ready as soon as the CSV is parsed.'
                    : 'Try a different name or status. Sample files use names like accounts-q3.'
                }
              />
            ) : (
              <Panel>
                <ul className="divide-y divide-line">
                  {filtered.map((dataset) => (
                    <li key={dataset.id}>
                      <DatasetRow dataset={dataset} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function DatasetRow({ dataset }: { dataset: Dataset }) {
  return (
    <Link to={`/datasets/${dataset.id}`} className="block px-4 py-4 hover:bg-[#f7f9fb]">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{dataset.name}</span>
        <StatusPill status={dataset.status} />
      </span>
      <span className="mt-1 block text-sm leading-6 text-ink-soft">
        {dataset.status === 'failed'
          ? dataset.error
          : `${dataset.fileName} · ${formatNumber(dataset.rows)} rows · ${formatNumber(dataset.columns.length)} columns · ${formatBytes(dataset.bytes)}`}
      </span>
      <span className="mt-1 block text-xs text-ink-soft">Added {formatDateTime(dataset.uploadedAt)}</span>
    </Link>
  )
}

function UploadPanel() {
  const { addDataset } = useMl()
  const toast = useToast()
  const navigate = useNavigate()
  const abortRef = useRef<AbortController | null>(null)
  const [dragging, setDragging] = useState(false)
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle' })
  const busy = upload.phase === 'reading' || upload.phase === 'checking' || upload.phase === 'saving'

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUpload({
        phase: 'error',
        message: 'Only CSV files can be parsed in this demo. Export the spreadsheet as .csv and try again.',
      })
      return
    }
    if (file.size > MAX_CSV_BYTES) {
      setUpload({ phase: 'error', message: 'This demo parses CSV files up to 8 MB.' })
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setUpload({ phase: 'reading', name: file.name, progress: 0 })
    try {
      const text = await readFileText(file, (progress) => {
        setUpload({ phase: 'reading', name: file.name, progress })
      }, controller.signal)
      setUpload({ phase: 'checking', name: file.name })
      const inspected = inspectCsv(file.name, file.size, text)
      if (!inspected.ok) {
        setUpload({ phase: 'error', message: inspected.message })
        return
      }
      setUpload({ phase: 'saving', name: file.name })
      const saved = await addDataset(inspected.dataset)
      toast.success('Dataset ready', `${saved.name} was parsed in this browser.`)
      navigate(`/datasets/${saved.id}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setUpload({ phase: 'idle' })
        toast.info('Upload cancelled', 'The file was not saved.')
        return
      }
      setUpload({ phase: 'error', message: errorMessage(error, 'The file could not be parsed.') })
    } finally {
      abortRef.current = null
    }
  }

  function acceptFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : []
    const file = list[0]
    if (!file) return
    if (list.length > 1) toast.info('One file at a time', `Using ${file.name}. Upload another CSV after this one finishes.`)
    void handleFile(file)
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    acceptFiles(event.dataTransfer.files)
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFiles(event.target.files)
    event.target.value = ''
  }

  return (
    <Panel className="h-fit p-4">
      <h2 className="text-base font-semibold text-ink">Add a CSV</h2>
      <p id="upload-help" className="mt-1 text-sm leading-6 text-ink-soft">
        Use a header row, up to 8 MB. The file is parsed locally.
      </p>
      {busy ? (
        <div className="mt-4 rounded-lg border border-line bg-[#f7f9fb] p-4" aria-live="polite">
          <p className="text-sm font-semibold text-ink">
            {upload.phase === 'reading' ? `Reading ${upload.name}` : upload.phase === 'checking' ? `Checking ${upload.name}` : `Saving ${'name' in upload ? upload.name : 'file'}`}
          </p>
          {upload.phase === 'reading' ? (
            <div className="mt-3">
              <ProgressBar id="upload-progress" value={upload.progress} label="Reading file" />
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => abortRef.current?.abort()}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{upload.phase === 'checking' ? 'Checking columns and row lengths.' : 'Saving the preview in this browser.'}</p>
          )}
        </div>
      ) : (
        <label
          htmlFor="dataset-file"
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy ${dragging ? 'border-accent bg-accent-soft' : 'border-line bg-[#f7f9fb]'}`}
        >
          <input
            id="dataset-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-describedby="upload-help"
            onChange={onChange}
          />
          <span className="text-sm font-semibold text-ink">Drop a CSV here or browse</span>
          <span className="mt-1 text-sm text-ink-soft">One file at a time</span>
        </label>
      )}
      {upload.phase === 'error' ? (
        <p role="alert" className="mt-3 text-sm leading-6 text-danger">
          {upload.message}
        </p>
      ) : null}
    </Panel>
  )
}
