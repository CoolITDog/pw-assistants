import type { SheetData, ColumnMapping, FilterRule, RuleConfig, ExportData, CurveRule, CurvePoint } from './types'

// ─── 2.1 applyFilters ────────────────────────────────────────────────────────

function matchesFilter(row: Record<string, unknown>, filter: FilterRule): boolean {
  const cellValue = row[filter.column]
  const strCell = cellValue == null ? '' : String(cellValue)
  const strFilter = filter.value

  switch (filter.operator) {
    case 'eq':
      return strCell === strFilter
    case 'neq':
      return strCell !== strFilter
    case 'contains':
      return strCell.includes(strFilter)
    case 'gt':
      return Number(cellValue) > Number(strFilter)
    case 'lt':
      return Number(cellValue) < Number(strFilter)
    case 'not_empty':
      return strCell.trim() !== ''
    default:
      return true
  }
}

export function applyFilters(
  rows: Record<string, unknown>[],
  filters: FilterRule[]
): Record<string, unknown>[] {
  if (filters.length === 0) return rows
  return rows.filter((row) => filters.every((f) => matchesFilter(row, f)))
}

// ─── 2.3 applyMappings ───────────────────────────────────────────────────────

export function applyMappings(
  rows: Record<string, unknown>[],
  mappings: ColumnMapping[]
): Record<string, unknown>[] {
  // Sort by order ascending
  const sorted = [...mappings].sort((a, b) => a.order - b.order)

  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const m of sorted) {
      if (m.sourceColumn === '' && m.formula) {
        // Calculated column — resolved later by evaluateFormula
        out[m.outputName] = evaluateFormula(m.formula, row)
      } else {
        out[m.outputName] = row[m.sourceColumn] ?? null
      }
    }
    return out
  })
}

// ─── 2.5 evaluateFormula ─────────────────────────────────────────────────────

export function evaluateFormula(formula: string, row: Record<string, unknown>): unknown {
  try {
    // Replace {列名} placeholders with their values
    const substituted = formula.replace(/\{([^}]+)\}/g, (_match, colName: string) => {
      const val = row[colName]
      if (val == null) return '""'
      // Wrap strings in quotes so the expression stays valid
      if (typeof val === 'string') return JSON.stringify(val)
      return String(val)
    })

    // Only allow safe characters: digits, operators, parens, dots, quotes, spaces
    const safe = /^[\d\s+\-*/().,'"]+$/.test(substituted)
    if (!safe) return '#ERROR'

    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${substituted})`)()
    return result
  } catch {
    return '#ERROR'
  }
}

// ─── Curve interpolation ─────────────────────────────────────────────────────

/** 分段线性插值：在排序后的控制点上查找 x 对应的 y，超出范围时夹紧到端点值 */
export function interpolate(points: CurvePoint[], x: number): number {
  if (points.length === 0) return 0
  const sorted = [...points].sort((a, b) => a.x - b.x)
  if (x <= sorted[0].x) return sorted[0].y
  if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y
  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i]
    const p1 = sorted[i + 1]
    if (x >= p0.x && x <= p1.x) {
      const t = (x - p0.x) / (p1.x - p0.x)
      return p0.y + t * (p1.y - p0.y)
    }
  }
  return sorted[sorted.length - 1].y
}

/** 将曲线规则应用到行数据，返回追加了曲线输出列的新行 */
export function applyCurveRules(
  rows: Record<string, unknown>[],
  curveRules: CurveRule[]
): Record<string, unknown>[] {
  if (curveRules.length === 0) return rows
  return rows.map((row) => {
    const out = { ...row }
    for (const rule of curveRules) {
      const rawX = row[rule.inputColumn]
      const x = rawX == null ? 0 : Number(rawX)
      out[rule.outputName] = isNaN(x) ? '#ERROR' : interpolate(rule.points, x)
    }
    return out
  })
}

// ─── 2.7 processSheet ────────────────────────────────────────────────────────

export function processSheet(sheetData: SheetData, ruleConfig: RuleConfig): ExportData {
  const { columnMappings, filters, curveRules = [] } = ruleConfig

  // 1. Apply filters
  const filtered = applyFilters(sheetData.rows, filters)

  // 2. Apply curve rules (adds new columns to each row)
  const withCurves = applyCurveRules(filtered, curveRules)

  // 3. Apply mappings (includes formula evaluation for calculated columns)
  const sorted = [...columnMappings].sort((a, b) => a.order - b.order)
  const headers = sorted.map((m) => m.outputName)

  const mappedRows = applyMappings(withCurves, columnMappings)

  // 4. Convert to row arrays in header order
  const rows: unknown[][] = mappedRows.map((row) => headers.map((h) => row[h] ?? null))

  return { headers, rows }
}
