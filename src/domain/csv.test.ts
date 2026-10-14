import { describe, expect, it } from 'vitest'
import { featuresForTraining, inspectCsv, parseCsv, suggestTarget } from './csv'

describe('parseCsv', () => {
  it('keeps commas and quotes inside quoted fields', () => {
    const table = parseCsv('name,note\n"Acme, Inc","a ""quoted"" note"\n')
    expect(table.headers).toEqual(['name', 'note'])
    expect(table.rows).toEqual([['Acme, Inc', 'a "quoted" note']])
  })
})

describe('inspectCsv', () => {
  it('infers column types and a preview', () => {
    const text = 'plan,seats,auto_renew,churned\ngrowth,10,true,no\nstarter,2,false,yes\n'
    const result = inspectCsv('accounts.csv', text.length, text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.dataset.rows).toBe(2)
    expect(result.dataset.columns.map((column) => column.type)).toEqual(['text', 'number', 'boolean', 'boolean'])
    expect(suggestTarget(result.dataset.columns)).toBe('churned')
    expect(featuresForTraining(result.dataset.columns, 'churned').map((feature) => feature.name)).toEqual([
      'plan',
      'seats',
      'auto_renew',
    ])
  })

  it('rejects a row that does not match the header', () => {
    const result = inspectCsv('broken.csv', 8, 'a,b\n1,2,3\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toMatch(/Row 2/)
  })

  it('rejects duplicate headers and non-csv names', () => {
    expect(inspectCsv('plan.xlsx', 12, 'a,b\n1,2\n')).toMatchObject({ ok: false })
    const duplicate = inspectCsv('dup.csv', 8, 'Plan,plan\n1,2\n')
    expect(duplicate.ok).toBe(false)
    if (duplicate.ok) return
    expect(duplicate.message).toMatch(/unique/)
  })
})
