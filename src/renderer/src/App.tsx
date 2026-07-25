import React, { useState, useMemo } from 'react'
import type { SheetData, ColumnMapping, FilterRule, CurveRule, ExportData } from '../../shared/types'
import { processSheet } from '../../shared/processor'
import { FilePanel } from './components/FilePanel'
import { PreviewPanel } from './components/PreviewPanel'
import { ExportButton } from './components/ExportButton'
import RulePanel from './components/RulePanel'

/**
 * 根据映射规则重命名 sheetData 中的列名
 * 将源列名替换为目标列名，使后续计算逻辑可以统一使用目标列名
 */
function applyMappingsToSheetData(sheetData: SheetData, mappings: ColumnMapping[]): SheetData {
  if (mappings.length === 0) return sheetData

  // 构建 sourceColumn -> outputName 的映射表
  const renameMap = new Map<string, string>()
  for (const m of mappings) {
    if (m.sourceColumn && m.outputName && m.sourceColumn !== m.outputName) {
      renameMap.set(m.sourceColumn, m.outputName)
    }
  }

  if (renameMap.size === 0) return sheetData

  // 重命名 headers
  const newHeaders = sheetData.headers.map(h => renameMap.get(h) ?? h)

  // 重命名 rows 中的 key
  const newRows = sheetData.rows.map(row => {
    const newRow: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      const newKey = renameMap.get(key) ?? key
      newRow[newKey] = value
    }
    return newRow
  })

  return { headers: newHeaders, rows: newRows }
}

function App(): React.JSX.Element {
  // ── File state ──────────────────────────────────────────────────────────
  const [filePath, setFilePath] = useState<string | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
  const [sheetData, setSheetData] = useState<SheetData | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [resultData, setResultData] = useState<any>(null);
  // ── Rule state ──────────────────────────────────────────────────────────
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [filters, setFilters] = useState<FilterRule[]>([])
  const [curveRules, setCurveRules] = useState<CurveRule[]>([])

  // ── Derived preview data ────────────────────────────────────────────────
  // 当有映射时，将 sheetData 中的列名按映射规则重命名
  const mappedSheetData = useMemo<SheetData | null>(() => {
    if (!sheetData) return null
    return applyMappingsToSheetData(sheetData, mappings)
  }, [sheetData, mappings])

  const previewData = useMemo<ExportData | null>(() => {
    if (!sheetData || mappings.length === 0) return null
    try {
      return processSheet(sheetData, { columnMappings: mappings, filters, curveRules })
    } catch {
      return null
    }
  }, [sheetData, mappings, filters])

  // ── Handlers ────────────────────────────────────────────────────────────
  async function handleFileOpen(): Promise<void> {
    setFileError(null)
    // 清空所有旧状态，确保重复导入同名文件时数据被刷新
    setSheetData(null)
    setMappings([])
    setFilters([])
    setCurveRules([])
    setResultData(null)
    try {
      const result = await window.api.openFile()
      if (!result) return
      setFilePath(result.filePath)
      setSheets(result.sheets)
      const sheet = result.sheets[0] ?? ''
      setSelectedSheet(sheet)
      if (sheet) {
        const data = await window.api.readSheet(result.filePath, sheet)
        console.log('导入数据：', data);
        setSheetData(data)
      }
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSheetChange(sheet: string): Promise<void> {
    setFileError(null)
    setSelectedSheet(sheet)
    // 切换 sheet 时清空计算结果和规则状态
    setMappings([])
    setFilters([])
    setCurveRules([])
    setResultData(null)
    if (!filePath) return
    try {
      const data = await window.api.readSheet(filePath, sheet)
      console.log('切换的sheet数据：', data);
      setSheetData(data)
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>Excel Processor</h1>
      </header>

      <main style={styles.main}>
        {/* Left column: file + rules */}
        <div style={styles.leftCol}>
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>1. 导入文件</h2>
            <FilePanel
              filePath={filePath}
              sheets={sheets}
              selectedSheet={selectedSheet}
              sheetData={sheetData}
              onFileOpen={handleFileOpen}
              onSheetChange={handleSheetChange}
              onMappingsConfirm={setMappings}
            />
            {fileError && <div style={styles.errorMsg}>❌ {fileError}</div>}
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>2. 配置规则</h2>
            <RulePanel
              headers={mappedSheetData?.headers ?? []}
              mappings={mappings}
              filters={filters}
              curveRules={curveRules}
              onMappingsChange={setMappings}
              onFiltersChange={setFilters}
              onCurveRulesChange={setCurveRules}
              sheetData={mappedSheetData}
              resultData={resultData}
              setResultData={setResultData}
            />
          </section>
           <section style={styles.card}>
            <h2 style={styles.cardTitle}>3. 导出</h2>
            <ExportButton data={previewData} resultData={resultData} sheetName={selectedSheet} />
          </section>
        </div>

        {/* Right column: preview + export */}
        {/* <div style={styles.rightCol}>
         
         
        </div> */}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: { minHeight: '100vh', background: '#f0f2f5', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#1677ff', padding: '12px 24px' },
  title: { margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 },
  main: { display: 'flex', gap: 16, padding: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  leftCol: { flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  rightCol: { flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  card: { background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  cardTitle: { margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#333' },
  errorMsg: { marginTop: 8, color: '#cf1322', fontSize: 13, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4, padding: '6px 10px' }
}

export default App
