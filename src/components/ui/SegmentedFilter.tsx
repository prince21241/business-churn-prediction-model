import type { KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export function SegmentedFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const previous = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    if (!next && !previous) return
    event.preventDefault()
    const target = next ? (index + 1) % options.length : (index - 1 + options.length) % options.length
    const option = options[target]
    if (!option) return
    onChange(option.value)
    document.getElementById(`${label}-${option.value}`)?.focus()
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-ink" id={`${label}-legend`}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`${label}-legend`} className="flex flex-wrap gap-2">
        {options.map((option, index) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              id={`${label}-${option.value}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'min-h-9 rounded-full px-3 text-sm font-semibold',
                selected ? 'bg-navy text-white' : 'border border-line bg-white text-ink hover:bg-[#f6f8fb]',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
