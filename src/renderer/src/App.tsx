import React, { useState, useMemo } from 'react'
import type { SheetData, ColumnMapping, FilterRule, CurveRule, ExportData } from '../../shared/types'
import { processSheet } from '../../shared/processor'
import { FilePanel } from './components/FilePanel'
import { PreviewPanel } from './components/PreviewPanel'
import { ExportButton } from './components/ExportButton'
import RulePanel from './components/RulePanel'

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
        setMappings([])
        setFilters([])
        setCurveRules([])
      }
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSheetChange(sheet: string): Promise<void> {
    setFileError(null)
    setSelectedSheet(sheet)
    if (!filePath) return
    try {
      const data = await window.api.readSheet(filePath, sheet)
      console.log('切换的sheet数据：', data);
      setSheetData(data)
      setMappings([])
      setFilters([])
      setCurveRules([])
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
            />
            {fileError && <div style={styles.errorMsg}>❌ {fileError}</div>}
          </section>

          <section style={styles.card}>
            <h2 style={styles.cardTitle}>2. 配置规则</h2>
            <RulePanel
              headers={sheetData?.headers ?? []}
              mappings={mappings}
              filters={filters}
              curveRules={curveRules}
              onMappingsChange={setMappings}
              onFiltersChange={setFilters}
              onCurveRulesChange={setCurveRules}
              sheetData={sheetData}
              resultData={resultData}
              setResultData={setResultData}
            />
          </section>
           <section style={styles.card}>
            <h2 style={styles.cardTitle}>3. 导出</h2>
            <ExportButton data={previewData} resultData={resultData} />
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
