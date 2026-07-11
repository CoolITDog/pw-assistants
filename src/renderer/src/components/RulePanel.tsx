import React, { FC, useEffect, useRef, useState } from 'react'
import type { ColumnMapping, FilterRule, CurveRule, SheetData } from '../../../shared/types'
import CurveRulePanel from './Rules/CurveRulePanel'

interface RulePanelProps {
  headers: string[]
  mappings: ColumnMapping[]
  filters: FilterRule[]
  curveRules: CurveRule[]
  sheetData: SheetData | null
  resultData: any;
  setResultData: any;
  onMappingsChange: (mappings: ColumnMapping[]) => void
  onFiltersChange: (filters: FilterRule[]) => void
  onCurveRulesChange: (rules: CurveRule[]) => void
}

const OPERATORS: { value: FilterRule['operator']; label: string }[] = [
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'not_empty', label: '不为空' }
]

function genId(): string {
  return Math.random().toString(36).slice(2)
}

const RulePanel:FC<RulePanelProps> = (props) => {
  const {headers,curveRules, onCurveRulesChange, sheetData, resultData, setResultData} = props;
  // useEffect(()=>{
  //   console.log(sheetData);
  // }, [sheetData])
  return (
    <div style={styles.container}>
      <CurveRulePanel
        headers={headers}
        curveRules={curveRules}
        onCurveRulesChange={onCurveRulesChange}
        sheetData={sheetData}
        resultData={resultData}
        setResultData={setResultData}
      />
    </div>
  )
}

export default RulePanel;

// export function RulePanel({
//   headers,
//   mappings,
//   filters,
//   curveRules,
//   onMappingsChange,
//   onFiltersChange,
//   onCurveRulesChange,
//   sheetData,
//   resultData,
//   setResultData
// }: RulePanelProps): React.JSX.Element {
//   const [ruleList] = useState([
//     {
//       name: 'CurveRulePanel'
//     }
//   ])
//   const [activeTab, setActiveTab] = useState<'mapping' | 'curve'>('mapping')
//   // ── Column Mappings ──────────────────────────────────────────────────────
//   const dragIndex = useRef<number | null>(null)

//   function addMapping(): void {
//     const next: ColumnMapping = {
//       id: genId(),
//       sourceColumn: headers[0] ?? '',
//       outputName: headers[0] ?? '新列',
//       order: mappings.length
//     }
//     onMappingsChange([...mappings, next])
//   }

//   function removeMapping(id: string): void {
//     onMappingsChange(mappings.filter((m) => m.id !== id))
//   }

//   function updateMapping(id: string, patch: Partial<ColumnMapping>): void {
//     onMappingsChange(mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)))
//   }

//   function handleDragStart(index: number): void {
//     dragIndex.current = index
//   }

//   function handleDrop(index: number): void {
//     if (dragIndex.current === null || dragIndex.current === index) return
//     const reordered = [...mappings]
//     const [moved] = reordered.splice(dragIndex.current, 1)
//     reordered.splice(index, 0, moved)
//     onMappingsChange(reordered.map((m, i) => ({ ...m, order: i })))
//     dragIndex.current = null
//   }

//   // ── Filters ──────────────────────────────────────────────────────────────
//   function addFilter(): void {
//     const next: FilterRule = {
//       id: genId(),
//       column: headers[0] ?? '',
//       operator: 'eq',
//       value: ''
//     }
//     onFiltersChange([...filters, next])
//   }

//   function removeFilter(id: string): void {
//     onFiltersChange(filters.filter((f) => f.id !== id))
//   }

//   function updateFilter(id: string, patch: Partial<FilterRule>): void {
//     onFiltersChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)))
//   }

//   return (
//     <div style={styles.container}>
//       <CurveRulePanel
//         headers={headers}
//         curveRules={curveRules}
//         onCurveRulesChange={onCurveRulesChange}
//         sheetData={sheetData}
//         resultData={resultData}
//         setResultData={setResultData}
//       />
//       {/* ── Tab switcher ── */}
//       {/* <div style={styles.tabs}>
//         <button
//           style={{ ...styles.tab, ...(activeTab === 'mapping' ? styles.tabActive : {}) }}
//           onClick={() => setActiveTab('mapping')}
//         >
//           列映射 / 过滤
//         </button>
//         <button
//           style={{ ...styles.tab, ...(activeTab === 'curve' ? styles.tabActive : {}) }}
//           onClick={() => setActiveTab('curve')}
//         >
//           曲线规则
//           {curveRules.length > 0 && (
//             <span style={styles.badge}>{curveRules.length}</span>
//           )}
//         </button>
//       </div> */}

//       {/* {activeTab === 'mapping' && (
//         <>
//           <section style={styles.section}>
//             <div style={styles.sectionHeader}>
//               <span style={styles.sectionTitle}>列映射</span>
//               <button style={styles.addBtn} onClick={addMapping} disabled={headers.length === 0}>
//                 + 添加列
//               </button>
//             </div>
//             {mappings.length === 0 && <div style={styles.empty}>暂无列映射，点击"添加列"开始配置</div>}
//             {mappings.map((m, index) => (
//               <div
//                 key={m.id}
//                 style={styles.row}
//                 draggable
//                 onDragStart={() => handleDragStart(index)}
//                 onDragOver={(e) => e.preventDefault()}
//                 onDrop={() => handleDrop(index)}
//               >
//                 <span style={styles.dragHandle} title="拖拽排序">⠿</span>

//                 <label style={styles.label}>源列</label>
//                 <select
//                   style={styles.select}
//                   value={m.sourceColumn}
//                   onChange={(e) => updateMapping(m.id, { sourceColumn: e.target.value, formula: e.target.value === '' ? (m.formula ?? '') : undefined })}
//                 >
//                   {headers.map((h) => (
//                     <option key={h} value={h}>{h}</option>
//                   ))}
//                   <option value="">（计算列）</option>
//                 </select>

//                 <label style={styles.label}>输出列名</label>
//                 <input
//                   style={styles.input}
//                   value={m.outputName}
//                   onChange={(e) => updateMapping(m.id, { outputName: e.target.value })}
//                   placeholder="输出列名"
//                 />

//                 {m.sourceColumn === '' && (
//                   <>
//                     <label style={styles.label}>公式</label>
//                     <FormulaInput
//                       value={m.formula ?? ''}
//                       onChange={(v) => updateMapping(m.id, { formula: v })}
//                       headers={headers}
//                     />
//                   </>
//                 )}

//                 <button style={styles.removeBtn} onClick={() => removeMapping(m.id)}>✕</button>
//               </div>
//             ))}
//           </section>

//           <section style={styles.section}>
//             <div style={styles.sectionHeader}>
//               <span style={styles.sectionTitle}>过滤条件</span>
//               <button style={styles.addBtn} onClick={addFilter} disabled={headers.length === 0}>
//                 + 添加条件
//               </button>
//             </div>
//             {filters.length === 0 && <div style={styles.empty}>暂无过滤条件，所有行将被保留</div>}
//             {filters.map((f) => (
//               <div key={f.id} style={styles.row}>
//                 <label style={styles.label}>列</label>
//                 <select
//                   style={styles.select}
//                   value={f.column}
//                   onChange={(e) => updateFilter(f.id, { column: e.target.value })}
//                 >
//                   {headers.map((h) => (
//                     <option key={h} value={h}>{h}</option>
//                   ))}
//                 </select>

//                 <label style={styles.label}>条件</label>
//                 <select
//                   style={styles.select}
//                   value={f.operator}
//                   onChange={(e) => updateFilter(f.id, { operator: e.target.value as FilterRule['operator'] })}
//                 >
//                   {OPERATORS.map((op) => (
//                     <option key={op.value} value={op.value}>{op.label}</option>
//                   ))}
//                 </select>

//                 {f.operator !== 'not_empty' && (
//                   <input
//                     style={styles.input}
//                     value={f.value}
//                     onChange={(e) => updateFilter(f.id, { value: e.target.value })}
//                     placeholder="值"
//                   />
//                 )}

//                 <button style={styles.removeBtn} onClick={() => removeFilter(f.id)}>✕</button>
//               </div>
//             ))}
//           </section>
//         </>
//       )} */}

//       {/* {activeTab === 'curve' && (
//         <CurveRulePanel
//           headers={headers}
//           curveRules={curveRules}
//           onCurveRulesChange={onCurveRulesChange}
//         />
//       )} */}
//     </div>
//   )
// }

// ── FormulaInput with inline error hint ──────────────────────────────────────

interface FormulaInputProps {
  value: string
  onChange: (v: string) => void
  headers: string[]
}

function FormulaInput({ value, onChange, headers }: FormulaInputProps): React.JSX.Element {
  const error = validateFormula(value, headers)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <input
        style={{ ...styles.input, borderColor: error ? '#ff4d4f' : undefined }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="如：{列A} * {列B} 或 {列A} + {列B}"
      />
      {error && <span style={styles.formulaError}>{error}</span>}
    </div>
  )
}

function validateFormula(formula: string, headers: string[]): string | null {
  if (!formula.trim()) return '公式不能为空'
  const refs = [...formula.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
  for (const ref of refs) {
    if (!headers.includes(ref)) return `列 "${ref}" 不存在`
  }
  return null
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 16 },
  tabs: { display: 'flex', gap: 4, borderBottom: '2px solid #e8e8e8', marginBottom: 4 },
  tab: { padding: '6px 16px', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -2, fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 6 },
  tabActive: { borderBottomColor: '#1677ff', color: '#1677ff', fontWeight: 600 },
  badge: { background: '#722ed1', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 },
  section: { border: '1px solid #e8e8e8', borderRadius: 6, padding: 12 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontWeight: 600, fontSize: 14 },
  addBtn: { padding: '4px 10px', cursor: 'pointer', background: '#52c41a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13 },
  row: { display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6, flexWrap: 'wrap', background: '#fafafa', padding: '6px 8px', borderRadius: 4, cursor: 'grab' },
  dragHandle: { fontSize: 18, color: '#bbb', cursor: 'grab', userSelect: 'none', lineHeight: '28px' },
  label: { fontSize: 12, color: '#666', lineHeight: '28px', whiteSpace: 'nowrap' },
  select: { padding: '4px 6px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', height: 28 },
  input: { padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', height: 28, minWidth: 120 },
  removeBtn: { padding: '2px 8px', cursor: 'pointer', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, height: 28, marginLeft: 'auto' },
  empty: { color: '#aaa', fontSize: 13, padding: '8px 0' },
  formulaError: { fontSize: 11, color: '#ff4d4f', marginTop: 2 }
}
