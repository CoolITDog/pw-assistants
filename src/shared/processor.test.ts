import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyFilters, applyMappings, evaluateFormula, processSheet } from './processor'
import type { ColumnMapping, FilterRule, SheetData, RuleConfig } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMapping(
  id: string,
  sourceColumn: string,
  outputName: string,
  order: number,
  formula?: string
): ColumnMapping {
  return { id, sourceColumn, outputName, order, formula }
}

function makeFilter(
  id: string,
  column: string,
  operator: FilterRule['operator'],
  value: string
): FilterRule {
  return { id, column, operator, value }
}

// ─── Unit tests: applyFilters ─────────────────────────────────────────────────

describe('applyFilters', () => {
  const rows = [
    { name: 'Alice', age: '30', city: 'Beijing' },
    { name: 'Bob', age: '25', city: 'Shanghai' },
    { name: 'Charlie', age: '30', city: '' }
  ]

  it('returns all rows when no filters', () => {
    expect(applyFilters(rows, [])).toHaveLength(3)
  })

  it('eq operator filters correctly', () => {
    const result = applyFilters(rows, [makeFilter('f1', 'age', 'eq', '30')])
    expect(result).toHaveLength(2)
    result.forEach((r) => expect(r.age).toBe('30'))
  })

  it('neq operator filters correctly', () => {
    const result = applyFilters(rows, [makeFilter('f1', 'age', 'neq', '30')])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bob')
  })

  it('contains operator filters correctly', () => {
    const result = applyFilters(rows, [makeFilter('f1', 'name', 'contains', 'li')])
    expect(result).toHaveLength(2) // Alice, Charlie
  })

  it('gt operator filters correctly', () => {
    const result = applyFilters(rows, [makeFilter('f1', 'age', 'gt', '25')])
    expect(result).toHaveLength(2)
  })

  it('lt operator filters correctly', () => {
    const result = applyFilters(rows, [makeFilter('f1', 'age', 'lt', '30')])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bob')
  })

  it('not_empty operator filters correctly', () => {
    const result = applyFilters(rows, [makeFilter('f1', 'city', 'not_empty', '')])
    expect(result).toHaveLength(2)
  })

  it('multiple filters are ANDed', () => {
    const result = applyFilters(rows, [
      makeFilter('f1', 'age', 'eq', '30'),
      makeFilter('f2', 'city', 'not_empty', '')
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })
})

// ─── Unit tests: applyMappings ────────────────────────────────────────────────

describe('applyMappings', () => {
  const rows = [{ A: '1', B: '2', C: '3' }]

  it('maps source columns to output names', () => {
    const mappings = [makeMapping('m1', 'A', 'OutputA', 1)]
    const result = applyMappings(rows, mappings)
    expect(result[0]).toHaveProperty('OutputA', '1')
    expect(result[0]).not.toHaveProperty('A')
  })

  it('respects order when multiple mappings', () => {
    const mappings = [
      makeMapping('m1', 'C', 'Third', 3),
      makeMapping('m2', 'A', 'First', 1),
      makeMapping('m3', 'B', 'Second', 2)
    ]
    const result = applyMappings(rows, mappings)
    const keys = Object.keys(result[0])
    expect(keys).toEqual(['First', 'Second', 'Third'])
  })

  it('evaluates formula for calculated columns', () => {
    const mappings = [makeMapping('m1', '', 'Sum', 1, '{A} + {B}')]
    const numRows = [{ A: 3, B: 4 }]
    const result = applyMappings(numRows, mappings)
    expect(result[0].Sum).toBe(7)
  })

  it('returns null for missing source column', () => {
    const mappings = [makeMapping('m1', 'Z', 'Out', 1)]
    const result = applyMappings(rows, mappings)
    expect(result[0].Out).toBeNull()
  })
})

// ─── Unit tests: evaluateFormula ──────────────────────────────────────────────

describe('evaluateFormula', () => {
  it('evaluates arithmetic with placeholders', () => {
    expect(evaluateFormula('{a} + {b}', { a: 3, b: 4 })).toBe(7)
    expect(evaluateFormula('{a} * {b}', { a: 3, b: 4 })).toBe(12)
    expect(evaluateFormula('{a} - {b}', { a: 10, b: 3 })).toBe(7)
  })

  it('evaluates string concatenation', () => {
    // Strings are JSON-stringified to double-quotes; the safe regex allows digits, spaces, operators, parens, quotes
    // Simple numeric-string concat: "1" + "2" => "12"
    const result = evaluateFormula('{a} + {b}', { a: '1', b: '2' })
    expect(result).toBe('12')
  })

  it('returns #ERROR for invalid formula', () => {
    expect(evaluateFormula('alert(1)', {})).toBe('#ERROR')
    expect(evaluateFormula('{a} ++ {b}', { a: 1, b: 2 })).toBe('#ERROR')
  })

  it('handles null/undefined column values', () => {
    const result = evaluateFormula('{missing} + 1', {})
    // "" + 1 in JS is "1", which is a valid result
    expect(result).not.toBe('#ERROR')
  })
})

// ─── Unit tests: processSheet ─────────────────────────────────────────────────

describe('processSheet', () => {
  const sheetData: SheetData = {
    headers: ['name', 'score'],
    rows: [
      { name: 'Alice', score: 90 },
      { name: 'Bob', score: 50 },
      { name: 'Charlie', score: 80 }
    ]
  }

  it('applies filters and mappings together', () => {
    const config: RuleConfig = {
      filters: [makeFilter('f1', 'score', 'gt', '60')],
      columnMappings: [
        makeMapping('m1', 'name', '姓名', 1),
        makeMapping('m2', 'score', '分数', 2)
      ]
    }
    const result = processSheet(sheetData, config)
    expect(result.headers).toEqual(['姓名', '分数'])
    expect(result.rows).toHaveLength(2)
  })

  it('returns empty rows when all filtered out', () => {
    const config: RuleConfig = {
      filters: [makeFilter('f1', 'score', 'gt', '100')],
      columnMappings: [makeMapping('m1', 'name', '姓名', 1)]
    }
    const result = processSheet(sheetData, config)
    expect(result.rows).toHaveLength(0)
  })
})

// ─── Property tests ───────────────────────────────────────────────────────────

// Arbitraries
const columnNameArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0)

const cellValueArb = fc.oneof(
  fc.string({ maxLength: 20 }),
  fc.integer({ min: -1000, max: 1000 }).map(String),
  fc.constant('')
)

const rowArb = (columns: string[]) =>
  fc.record(Object.fromEntries(columns.map((c) => [c, cellValueArb])))

// Feature: excel-processor, Property 2: 过滤规则单调性 — 过滤后行数 <= 原始行数
describe('Property 2: 过滤规则单调性', () => {
  it('filtered row count is always <= original row count', () => {
    // Feature: excel-processor, Property 2: 过滤规则单调性
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 5 }).chain((cols) => {
          const uniqueCols = [...new Set(cols)]
          return fc.tuple(
            fc.array(rowArb(uniqueCols), { minLength: 0, maxLength: 50 }),
            fc.array(
              fc.record({
                id: fc.uuid(),
                column: fc.constantFrom(...uniqueCols),
                operator: fc.constantFrom<FilterRule['operator']>(
                  'eq', 'neq', 'contains', 'gt', 'lt', 'not_empty'
                ),
                value: cellValueArb
              }),
              { minLength: 0, maxLength: 3 }
            )
          )
        }),
        ([rows, filters]) => {
          const result = applyFilters(rows, filters)
          return result.length <= rows.length
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: excel-processor, Property 5: 过滤条件正确性 — 结果中每行都满足所有过滤条件
describe('Property 5: 过滤条件正确性', () => {
  it('every row in result satisfies all filter conditions', () => {
    // Feature: excel-processor, Property 5: 过滤条件正确性
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 5 }).chain((cols) => {
          const uniqueCols = [...new Set(cols)]
          return fc.tuple(
            fc.array(rowArb(uniqueCols), { minLength: 0, maxLength: 50 }),
            fc.array(
              fc.record({
                id: fc.uuid(),
                column: fc.constantFrom(...uniqueCols),
                operator: fc.constantFrom<FilterRule['operator']>('eq', 'neq', 'contains', 'not_empty'),
                value: cellValueArb
              }),
              { minLength: 1, maxLength: 3 }
            )
          )
        }),
        ([rows, filters]) => {
          const result = applyFilters(rows, filters)
          return result.every((row) =>
            filters.every((f) => {
              const cell = row[f.column]
              const strCell = cell == null ? '' : String(cell)
              switch (f.operator) {
                case 'eq': return strCell === f.value
                case 'neq': return strCell !== f.value
                case 'contains': return strCell.includes(f.value)
                case 'not_empty': return strCell.trim() !== ''
                default: return true
              }
            })
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: excel-processor, Property 1: 列映射输出列数一致性
describe('Property 1: 列映射输出列数一致性', () => {
  it('output row field count equals mapping count in correct order', () => {
    // Feature: excel-processor, Property 1: 列映射输出列数一致性
    // Constraint: output names must be unique (UI enforces this; duplicate keys collapse in JS objects)
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 6 }).chain((cols) => {
          const uniqueCols = [...new Set(cols)]
          return fc.tuple(
            fc.array(rowArb(uniqueCols), { minLength: 1, maxLength: 20 }),
            fc.array(
              fc.record({
                id: fc.uuid(),
                sourceColumn: fc.constantFrom(...uniqueCols),
                outputName: columnNameArb,
                order: fc.integer({ min: 0, max: 100 }),
                formula: fc.constant(undefined)
              }),
              { minLength: 1, maxLength: 5 }
            ).map((mappings) => {
              // Deduplicate by outputName to reflect UI constraint of unique output names
              const seen = new Set<string>()
              return mappings.filter((m) => {
                if (seen.has(m.outputName)) return false
                seen.add(m.outputName)
                return true
              })
            }).filter((mappings) => mappings.length > 0)
          )
        }),
        ([rows, mappings]) => {
          const result = applyMappings(rows, mappings)
          return result.every((row) => Object.keys(row).length === mappings.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// Feature: excel-processor, Property 3: 计算列公式求值稳定性 (幂等性)
describe('Property 3: 计算列公式求值稳定性', () => {
  it('same formula and row always produces same result', () => {
    // Feature: excel-processor, Property 3: 计算列公式求值稳定性
    fc.assert(
      fc.property(
        fc.array(columnNameArb, { minLength: 1, maxLength: 4 }).chain((cols) => {
          const uniqueCols = [...new Set(cols)]
          return fc.tuple(
            rowArb(uniqueCols),
            fc.constantFrom(...uniqueCols.map((c) => `{${c}}`))
          )
        }),
        ([row, formula]) => {
          const r1 = evaluateFormula(formula, row)
          const r2 = evaluateFormula(formula, row)
          return JSON.stringify(r1) === JSON.stringify(r2)
        }
      ),
      { numRuns: 100 }
    )
  })
})
