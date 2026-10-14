import { MAX_CSV_BYTES, MAX_CSV_ROWS, knownFeature } from './catalog'
import { humanize } from '../lib/format'
import type { ColumnType, DatasetColumn, FeatureSpec, ParsedDataset } from '../types'

export interface CsvTable {
  headers: string[]
  rows: string[][]
}

export type CsvInspection =
  | { ok: true; dataset: ParsedDataset }
  | { ok: false; message: string }

const BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no'])

export function parseCsv(text: string): CsvTable {
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += character ?? ''
      }
      continue
    }

    if (character === '"') {
      inQuotes = true
    } else if (character === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (character === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else if (character !== '\r') {
      cell += character ?? ''
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    rows.push(row)
  }

  const cleaned = rows.filter((entry) => entry.some((value) => value.length > 0))
  const headers = cleaned[0] ?? []
  return { headers, rows: cleaned.slice(1) }
}

export function inspectCsv(fileName: string, bytes: number, text: string): CsvInspection {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return {
      ok: false,
      message: 'Only CSV files can be parsed in this demo. Export the spreadsheet as .csv and try again.',
    }
  }
  if (bytes <= 0) {
    return { ok: false, message: 'The file is empty.' }
  }
  if (bytes > MAX_CSV_BYTES) {
    return { ok: false, message: 'This demo parses CSV files up to 8 MB.' }
  }
  if (text.includes('\u0000')) {
    return { ok: false, message: 'This file does not look like CSV text.' }
  }

  const table = parseCsv(text)
  if (table.headers.length === 0) {
    return { ok: false, message: 'The CSV needs a header row.' }
  }
  if (table.headers.length < 2) {
    return { ok: false, message: 'The CSV needs at least two columns.' }
  }
  if (table.rows.length === 0) {
    return { ok: false, message: 'The CSV needs at least one data row under the header.' }
  }
  if (table.rows.length > MAX_CSV_ROWS) {
    return { ok: false, message: 'This demo can preview CSVs up to 200,000 rows.' }
  }

  const seen = new Set<string>()
  for (let index = 0; index < table.headers.length; index += 1) {
    const header = table.headers[index]
    if (!header) {
      return { ok: false, message: `Column ${index + 1} has an empty name.` }
    }
    const key = header.toLowerCase()
    if (seen.has(key)) {
      return { ok: false, message: `Column names must be unique. "${header}" appears more than once.` }
    }
    seen.add(key)
  }

  for (let index = 0; index < table.rows.length; index += 1) {
    const row = table.rows[index]
    if (row && row.length !== table.headers.length) {
      return {
        ok: false,
        message: `Row ${index + 2} has ${row.length} values, but the header has ${table.headers.length} columns.`,
      }
    }
  }

  const columns = profileColumns(table.headers, table.rows)
  const baseName = fileName.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim()
  return {
    ok: true,
    dataset: {
      name: baseName || fileName,
      fileName,
      bytes,
      rows: table.rows.length,
      columns,
      preview: table.rows.slice(0, 6),
    },
  }
}

function profileColumns(headers: string[], rows: string[][]): DatasetColumn[] {
  return headers.map((header, columnIndex) => {
    const values = rows.map((row) => row[columnIndex] ?? '')
    const present = values.filter((value) => value.length > 0)
    const missing = values.length - present.length
    const unique = new Set<string>()
    let uniqueCapped = false
    for (const value of present) {
      unique.add(value)
      if (unique.size > 5000) {
        uniqueCapped = true
        break
      }
    }
    const examples: string[] = []
    for (const value of unique) {
      examples.push(value)
      if (examples.length === 3) break
    }
    const type = inferType(present)
    const options =
      !uniqueCapped && unique.size > 0 && unique.size <= 8 && type !== 'number'
        ? [...unique].sort((a, b) => a.localeCompare(b))
        : undefined
    return {
      name: header,
      type,
      missing,
      unique: uniqueCapped ? present.length : unique.size,
      uniqueCapped,
      examples,
      options,
    }
  })
}

function inferType(values: string[]): ColumnType {
  if (values.length === 0) return 'text'
  if (values.every((value) => /^-?\d+(\.\d+)?$/.test(value))) return 'number'
  if (values.every((value) => BOOLEAN_VALUES.has(value.toLowerCase()))) return 'boolean'
  return 'text'
}

const IDENTIFIER = /(^id$|_id$|company_name|customer_name|account_name)/i

export function suggestTarget(columns: DatasetColumn[]): string {
  const preferred = ['churned', 'churn', 'label', 'target', 'exited']
  for (const name of preferred) {
    const match = columns.find((column) => column.name.toLowerCase() === name)
    if (match) return match.name
  }
  const binary = columns.find((column) => column.unique === 2 && !column.uniqueCapped)
  return binary?.name ?? columns[columns.length - 1]?.name ?? ''
}

export function featuresForTraining(columns: DatasetColumn[], target: string): FeatureSpec[] {
  return columns
    .filter((column) => column.name !== target && !IDENTIFIER.test(column.name))
    .map((column) => {
      const known = knownFeature(column.name)
      if (known) return { ...known, options: known.options ?? column.options }
      const kind =
        column.type === 'number'
          ? 'number'
          : column.type === 'boolean'
            ? 'boolean'
            : column.options && column.options.length > 0
              ? 'select'
              : 'text'
      return {
        name: column.name,
        label: humanize(column.name),
        kind,
        sample: column.examples[0] ?? (kind === 'number' ? '0' : kind === 'boolean' ? 'true' : ''),
        options: column.options,
      }
    })
}

export function targetIssue(column: DatasetColumn | undefined): string | null {
  if (!column) return 'Select a target column from this dataset.'
  if (column.uniqueCapped) return null
  if (column.unique < 2) {
    return `"${column.name}" has only one distinct value, so a classifier cannot train on it.`
  }
  return null
}
