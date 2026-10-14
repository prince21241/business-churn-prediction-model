import { formatDecimal, formatNumber, formatPercent } from '../lib/format'
import type { EvaluationMetrics } from '../types'

export function MetricList({ metrics }: { metrics: EvaluationMetrics }) {
  const items = [
    ['Accuracy', formatPercent(metrics.accuracy, 1)],
    ['Precision', formatPercent(metrics.precision, 1)],
    ['Recall', formatPercent(metrics.recall, 1)],
    ['F1', formatPercent(metrics.f1, 1)],
    ['AUC', formatDecimal(metrics.auc)],
    ['Validation rows', formatNumber(metrics.validationRows)],
  ]
  const { tp, fp, tn, fn } = metrics.confusion
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[#f6f8fb] px-3 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <caption className="mb-2 text-left text-sm font-semibold text-ink">
            Simulated confusion matrix
            <span className="mt-1 block font-normal text-ink-soft">Positive class is churn. Counts are generated for this demo.</span>
          </caption>
          <thead>
            <tr className="border-b border-line text-ink-soft">
              <th scope="col" className="px-3 py-2 font-semibold">Actual</th>
              <th scope="col" className="px-3 py-2 font-semibold">Predicted stay</th>
              <th scope="col" className="px-3 py-2 font-semibold">Predicted churn</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <th scope="row" className="px-3 py-2 font-semibold">Stay</th>
              <td className="px-3 py-2 tabular-nums">{formatNumber(tn)}</td>
              <td className="px-3 py-2 tabular-nums">{formatNumber(fp)}</td>
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2 font-semibold">Churn</th>
              <td className="px-3 py-2 tabular-nums">{formatNumber(fn)}</td>
              <td className="px-3 py-2 tabular-nums">{formatNumber(tp)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-soft">
        These figures are simulated in the browser. AUC is a stand-in ranking score, not a curve measured from holdout data. No model was trained on AWS.
      </p>
    </div>
  )
}
