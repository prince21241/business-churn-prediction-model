import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Inbox } from 'lucide-react'
import { DemoNote, PageHeader, Panel } from '../components/PageHeader'
import { WorkspaceGate } from '../components/WorkspaceGate'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Feedback'
import { SelectField, TextAreaField, TextField } from '../components/ui/Fields'
import { useToast } from '../components/ui/toastContext'
import { useMl } from '../demo/mlContext'
import { parsePredictionJson, validatePrediction, type FieldErrors } from '../domain/validate'
import { errorMessage } from '../lib/errors'
import { formatDateTime, formatPercent, humanize } from '../lib/format'
import type { FeatureSpec, Prediction, PredictionResult, Snapshot, TrainedModel } from '../types'

export function PredictionsPage() {
  return (
    <WorkspaceGate label="Loading predictions">
      {(snapshot) => <Predictions snapshot={snapshot} />}
    </WorkspaceGate>
  )
}

function Predictions({ snapshot }: { snapshot: Snapshot }) {
  const deployed = snapshot.models.filter((model) => model.endpoint?.status === 'in-service')
  const deployedKey = deployed.map((model) => model.id).join('|')
  const [modelId, setModelId] = useState(deployed[0]?.id ?? '')

  useEffect(() => {
    const ids = deployedKey ? deployedKey.split('|') : []
    if (modelId && ids.includes(modelId)) return
    setModelId(ids[0] ?? '')
  }, [deployedKey, modelId])

  const model = deployed.find((item) => item.id === modelId) ?? null

  return (
    <>
      <PageHeader
        title="Predictions"
        description="Score one account against a demo endpoint that is in service."
        demo={<DemoNote>Scores are calculated in this browser. They are not SageMaker inference responses.</DemoNote>}
      />
      {deployed.length === 0 && snapshot.predictions.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No demo endpoint is in service"
          body="Deploy a trained model in this browser before running a simulated prediction. Deployment does not create a SageMaker endpoint."
          action={<ButtonLink to="/models">View models</ButtonLink>}
        />
      ) : (
        <div className="space-y-4">
          {deployed.length === 0 ? (
            <DemoNote>
              No demo endpoint is in service, so new scores are unavailable. History from earlier in this browser is still listed below.
            </DemoNote>
          ) : model ? (
            <PredictionWorkbench key={model.id} model={model} models={deployed} onModelChange={setModelId} />
          ) : null}
          <History predictions={snapshot.predictions} />
        </div>
      )}
    </>
  )
}

function PredictionWorkbench({
  model,
  models,
  onModelChange,
}: {
  model: TrainedModel
  models: TrainedModel[]
  onModelChange: (id: string) => void
}) {
  const { predict } = useMl()
  const toast = useToast()
  const resultRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [jsonText, setJsonText] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const endpoint = model.endpoint

  function sample(): Record<string, string> {
    return Object.fromEntries(model.features.map((feature) => [feature.name, feature.sample]))
  }

  function selectMode(next: 'form' | 'json') {
    if (next === mode) return
    if (next === 'json') {
      setJsonText(JSON.stringify(inputs, null, 2))
      setErrors({})
      setMode('json')
      return
    }
    let parsed: unknown
    try {
      parsed = jsonText.trim() ? JSON.parse(jsonText) : {}
    } catch {
      setErrors({ json: 'Enter a JSON object before switching back to the form.' })
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setErrors({ json: 'The JSON must be an object before it can fill the form.' })
      return
    }
    const record = parsed as Record<string, unknown>
    const allowed = new Set(model.features.map((feature) => feature.name))
    const unknown = Object.keys(record).filter((key) => !allowed.has(key))
    if (unknown.length > 0) {
      setErrors({ json: `Remove unknown fields: ${unknown.join(', ')}.` })
      return
    }
    const nextInputs: Record<string, string> = {}
    for (const feature of model.features) {
      const value = record[feature.name]
      nextInputs[feature.name] =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
    }
    setInputs(nextInputs)
    setErrors({})
    setMode('form')
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = mode === 'form' ? 'json' : 'form'
    selectMode(next)
    document.getElementById(`${baseId}-${next}`)?.focus()
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validated = mode === 'json' ? parsePredictionJson(jsonText, model.features) : validatePrediction(model.features, inputs)
    if (!validated.ok) {
      setErrors(validated.errors)
      const first = Object.keys(validated.errors)[0]
      if (first) document.getElementById(first === 'json' ? 'prediction-json' : first)?.focus()
      return
    }
    setErrors({})
    setPending(true)
    try {
      const prediction = await predict(model.id, validated.value)
      setResult(prediction.result)
      resultRef.current?.focus()
    } catch (error) {
      toast.error('Could not score this account', errorMessage(error, 'Check the inputs and try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel className="p-5">
        <form noValidate onSubmit={(event) => void onSubmit(event)}>
          <SelectField
            id="model"
            label="Deployed model"
            hint={endpoint ? `Demo endpoint ${endpoint.name} · ${endpoint.instanceType} × ${endpoint.instanceCount}. This is not an AWS endpoint.` : undefined}
            value={model.id}
            onChange={(event) => onModelChange(event.target.value)}
          >
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <div className="mt-4" role="tablist" aria-label="Prediction input method">
            <TabButton id={`${baseId}-form`} selected={mode === 'form'} controls="prediction-form" onClick={() => selectMode('form')} onKeyDown={onTabKey}>
              Form
            </TabButton>
            <TabButton id={`${baseId}-json`} selected={mode === 'json'} controls="prediction-json-panel" onClick={() => selectMode('json')} onKeyDown={onTabKey}>
              JSON
            </TabButton>
          </div>
          {mode === 'form' ? (
            <div role="tabpanel" id="prediction-form" aria-labelledby={`${baseId}-form`} className="mt-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setInputs(sample())}>
                  Fill sample values
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setInputs({}); setErrors({}) }}>
                  Clear
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {model.features.map((feature) => (
                  <FeatureField
                    key={feature.name}
                    feature={feature}
                    value={inputs[feature.name] ?? ''}
                    error={errors[feature.name]}
                    onChange={(value) => setInputs((current) => ({ ...current, [feature.name]: value }))}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div role="tabpanel" id="prediction-json-panel" aria-labelledby={`${baseId}-json`} className="mt-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setJsonText(JSON.stringify(sample(), null, 2))
                    setErrors({})
                  }}
                >
                  Insert sample JSON
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    try {
                      setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2))
                      setErrors({})
                    } catch {
                      setErrors({ json: 'Enter a JSON object. Check for missing commas or quotes.' })
                    }
                  }}
                >
                  Format JSON
                </Button>
              </div>
              <TextAreaField
                id="prediction-json"
                label="Prediction JSON"
                hint="Use the feature names from this model."
                error={errors.json}
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                spellCheck={false}
              />
            </div>
          )}
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? 'Scoring…' : 'Run simulated prediction'}
          </Button>
        </form>
      </Panel>
      <div ref={resultRef} tabIndex={-1} className="outline-none" aria-live="polite">
        {result ? <ResultCard result={result} /> : (
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-ink">Result</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Submit the form to see a simulated label. Confidence is shown when the demo rules can score these fields.</p>
          </Panel>
        )}
      </div>
    </div>
  )
}

function TabButton({
  id,
  selected,
  controls,
  onClick,
  onKeyDown,
  children,
}: {
  id: string
  selected: boolean
  controls: string
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  children: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${selected ? 'bg-navy text-white' : 'text-ink hover:bg-[#f4f7fa]'}`}
    >
      {children}
    </button>
  )
}

function FeatureField({
  feature,
  value,
  error,
  onChange,
}: {
  feature: FeatureSpec
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  if (feature.kind === 'select' && feature.options) {
    return (
      <SelectField id={feature.name} label={feature.label} hint={feature.hint} error={error} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {feature.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
    )
  }
  if (feature.kind === 'boolean') {
    return (
      <SelectField id={feature.name} label={feature.label} hint={feature.hint} error={error} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </SelectField>
    )
  }
  return (
    <TextField
      id={feature.name}
      label={feature.label}
      hint={feature.hint}
      error={error}
      value={value}
      placeholder={feature.sample ? `Example: ${feature.sample}` : undefined}
      inputMode={feature.kind === 'number' ? (feature.integer ? 'numeric' : 'decimal') : undefined}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
    />
  )
}

function ResultCard({ result }: { result: PredictionResult }) {
  return (
    <Panel className="p-5">
      <h2 className="text-sm font-semibold text-ink-soft">Result</h2>
      <p className="mt-2 text-2xl font-semibold text-ink">{result.predictedLabel}</p>
      {result.confidence == null ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">No confidence score was included with this result.</p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-ink">Confidence {formatPercent(result.confidence)} for this label.</p>
      )}
      {result.probabilities ? (
        <div className="mt-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-[#e7edf4]" aria-hidden>
            {result.probabilities.map((item) => (
              <div
                key={item.label}
                className={item.label.includes('churn') ? 'bg-accent' : 'bg-info'}
                style={{ width: `${Math.round(item.value * 100)}%` }}
              />
            ))}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {result.probabilities.map((item) => (
              <li key={item.label}>
                {item.label}: {formatPercent(item.value)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.factors.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">Why this demo score</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-ink-soft">
            {result.factors.map((factor) => (
              <li key={factor.label}>{factor.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-ink-soft">{result.note}</p>
    </Panel>
  )
}

function History({ predictions }: { predictions: Prediction[] }) {
  return (
    <Panel className="p-5">
      <h2 className="text-base font-semibold text-ink">Recent predictions</h2>
      {predictions.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">Predictions you run in this demo will appear here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {predictions.map((prediction) => (
            <li key={prediction.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{prediction.result.predictedLabel}</p>
                <p className="text-sm text-ink-soft">
                  {prediction.result.confidence == null ? 'No confidence score' : `Confidence ${formatPercent(prediction.result.confidence)}`}
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {prediction.modelName} · {prediction.endpointName} · {formatDateTime(prediction.createdAt)}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-ink">View inputs</summary>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(prediction.inputs).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{humanize(key)}</dt>
                      <dd className="text-sm text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
