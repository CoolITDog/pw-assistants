import React, { useState, useCallback, useEffect } from 'react'
import type { SheetData, ColumnMapping, MatchAnalysisResult } from '../../../shared/types'
import { ManualMappingDialog } from './ManualMappingDialog'

interface FilePanelProps {
  filePath: string | null
  sheets: string[]
  selectedSheet: string | null
  sheetData: SheetData | null
  onFileOpen: () => void
  onSheetChange: (sheet: string) => void
  onMappingsConfirm?: (mappings: ColumnMapping[]) => void
}

export function FilePanel({
  filePath,
  sheets,
  selectedSheet,
  sheetData,
  onFileOpen,
  onSheetChange,
  onMappingsConfirm
}: FilePanelProps): React.JSX.Element {
  // 匹配状态
  const [matchStatus, setMatchStatus] = useState<MatchAnalysisResult | null>(null)
  // 映射配置
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  // 对话框显示状态
  const [showMappingDialog, setShowMappingDialog] = useState(false)
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)

  // 当 sheetData 变化时（切换 sheet 或重新导入），重置本地映射和匹配状态
  useEffect(() => {
    setMappings([])
    setMatchStatus(null)
    setResolvedSheetType(null)
  }, [sheetData])

  // 预览行数
  const previewRows = sheetData ? sheetData.rows.slice(0, 20) : []

  // sheet 类型选择状态
  const [showSheetTypeDialog, setShowSheetTypeDialog] = useState(false)
  // 用户选定的 sheet 类型（"干流" 或 "支流"），用于获取对应配置
  const [resolvedSheetType, setResolvedSheetType] = useState<string | null>(null)

  // 获取实际用于配置的 sheet 名称（用户指定的类型或原始名称）
  const effectiveSheetName = resolvedSheetType ?? selectedSheet

  // 检查是否需要显示映射对话框
  const shouldShowMappingDialog = useCallback(async (): Promise<boolean> => {
    if (!filePath || !selectedSheet) return false
    
    try {
      // 检查当前 sheet 是否有专属列名配置
      const hasConfig = await window.api.hasSheetConfig(selectedSheet)
      
      if (!hasConfig) {
        // sheet 名称不在配置中，需要用户先指定类型
        setShowSheetTypeDialog(true)
        return false // 不直接显示映射对话框，等用户选择类型后再触发
      }
      
      // 有配置，直接做匹配检查
      const expectedHeaders = await window.api.getExpectedHeaders(selectedSheet)
      const matchResult = await window.api.readSheetWithMatchCheck(
        filePath,
        selectedSheet,
        expectedHeaders
      )
      
      setMatchStatus(matchResult)
      return matchResult.needsManualMapping || matchResult.matchScore < 0.8
    } catch (error) {
      console.error('匹配检查失败:', error)
      return false
    }
  }, [filePath, selectedSheet])

  // 用户选择 sheet 类型后，触发列映射检查
  const handleSheetTypeConfirm = useCallback(async (sheetType: string) => {
    setResolvedSheetType(sheetType)
    setShowSheetTypeDialog(false)
    
    if (!filePath || !selectedSheet) return
    
    try {
      const expectedHeaders = await window.api.getExpectedHeaders(sheetType)
      const matchResult = await window.api.readSheetWithMatchCheck(
        filePath,
        selectedSheet,
        expectedHeaders
      )
      
      setMatchStatus(matchResult)
      
      if (matchResult.needsManualMapping || matchResult.matchScore < 0.8) {
        setShowMappingDialog(true)
      }
    } catch (error) {
      console.error('匹配检查失败:', error)
    }
  }, [filePath, selectedSheet])

  // 处理文件导入后的匹配检查
  const handleFileImport = useCallback(async () => {
    setIsLoading(true)
    try {
      // 打开文件
      await onFileOpen()
      
      // 文件打开后检查是否需要映射
      // 注意：实际的sheetData更新是在onFileOpen回调中处理的
      // 这里我们延迟检查，等待sheetData更新完成
    } finally {
      setIsLoading(false)
    }
  }, [onFileOpen])

  // 当sheetData变化时进行匹配检查
  React.useEffect(() => {
    if (sheetData && sheetData.headers.length > 0 && filePath && selectedSheet) {
      // 延迟执行匹配检查，确保状态已更新
      const timer = setTimeout(async () => {
        const shouldShow = await shouldShowMappingDialog()
        if (shouldShow) {
          setShowMappingDialog(true)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [sheetData?.headers, filePath, selectedSheet, shouldShowMappingDialog])

  // 处理映射确认
  const handleMappingConfirm = useCallback((newMappings: ColumnMapping[]) => {
    setMappings(newMappings)
    setShowMappingDialog(false)
    
    // 传递映射配置到父组件
    if (onMappingsConfirm) {
      onMappingsConfirm(newMappings)
    }
  }, [onMappingsConfirm])

  // 处理映射取消
  const handleMappingCancel = useCallback(() => {
    setShowMappingDialog(false)
  }, [])

  // 手动触发映射对话框（用于测试或手动调整）
  const handleOpenMappingDialog = useCallback(async () => {
    if (sheetData && sheetData.headers.length > 0) {
      // 获取期望列名（按实际确定的 sheet 类型）
      const sheetName = effectiveSheetName ?? selectedSheet ?? undefined
      const expectedHeaders = await window.api.getExpectedHeaders(sheetName)
      
      // 执行匹配检查
      const matchResult = await window.api.readSheetWithMatchCheck(
        filePath!,
        selectedSheet!,
        expectedHeaders
      )
      
      setMatchStatus(matchResult)
      setShowMappingDialog(true)
    }
  }, [filePath, selectedSheet, effectiveSheetName, sheetData])

  // 获取目标列名（始终使用配置文件中的期望列名）
  // 这样可以确保用户看到所有需要映射的目标列，包括未匹配的那些
  const [expectedHeaders, setExpectedHeaders] = useState<string[]>([])
  
  useEffect(() => {
    if (showMappingDialog && effectiveSheetName) {
      window.api.getExpectedHeaders(effectiveSheetName).then(setExpectedHeaders)
    }
  }, [showMappingDialog, effectiveSheetName])

  // 目标列始终使用期望列名，而不是从匹配结果中过滤
  const finalTargetHeaders = expectedHeaders.length > 0 
    ? expectedHeaders 
    : (sheetData?.headers ?? [])

  // 获取必需列（缺失的必需列）
  const requiredColumns = matchStatus?.missingRequiredColumns ?? []

  return (
    <div style={styles.container}>
      {/* 加载指示器 */}
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingSpinner}>加载中...</div>
        </div>
      )}

      <div style={styles.toolbar}>
        <button style={styles.importBtn} onClick={handleFileImport} disabled={isLoading}>
          📂 导入文件
        </button>
        {sheetData && sheetData.headers.length > 0 && (
          <button 
            style={styles.mappingBtn} 
            onClick={handleOpenMappingDialog}
            title="手动调整列名映射"
          >
            🔧 映射
          </button>
        )}
        {filePath && (
          <span style={styles.filePath} title={filePath}>
            {filePath.split(/[\\/]/).pop()}
            {matchStatus && (
              <span style={matchStatus.matchScore >= 0.8 ? styles.matchGood : styles.matchBad}>
                {' '}(匹配度: {Math.round(matchStatus.matchScore * 100)}%)
              </span>
            )}
          </span>
        )}
        {sheets.length > 0 && (
          <select
            style={styles.select}
            value={selectedSheet ?? ''}
            onChange={(e) => onSheetChange(e.target.value)}
          >
            {sheets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {sheetData && sheetData.headers.length > 0 && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {sheetData.headers.map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                  {sheetData.headers.map((h) => (
                    <td key={h} style={styles.td}>
                      {row[h] == null ? '' : String(row[h])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={styles.hint}>
            预览前 {previewRows.length} 行，共 {sheetData.rows.length} 行
          </div>
        </div>
      )}

      {!sheetData && (
        <div style={styles.empty}>请导入 .xlsx / .xls / .csv 文件</div>
      )}

      {/* Sheet 类型选择对话框 */}
      {showSheetTypeDialog && (
        <div style={styles.overlay} onClick={() => setShowSheetTypeDialog(false)}>
          <div style={styles.sheetTypeDialog} onClick={e => e.stopPropagation()}>
            <h3 style={styles.sheetTypeTitle}>选择 Sheet 类型</h3>
            <p style={styles.sheetTypeHint}>
              当前 Sheet「{selectedSheet}」未识别，请指定它对应的数据类型：
            </p>
            <div style={styles.sheetTypeBtns}>
              <button
                style={styles.sheetTypeBtn}
                onClick={() => handleSheetTypeConfirm('干流')}
              >
                干流
              </button>
              <button
                style={styles.sheetTypeBtn}
                onClick={() => handleSheetTypeConfirm('支流')}
              >
                支流
              </button>
            </div>
            <button
              style={styles.sheetTypeCancelBtn}
              onClick={() => setShowSheetTypeDialog(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 手动列名映射对话框 */}
      <ManualMappingDialog
        visible={showMappingDialog}
        sourceHeaders={sheetData?.headers ?? []}
        targetHeaders={finalTargetHeaders}
        presetMappings={
          mappings.length > 0
            ? mappings
            : (matchStatus?.suggestedMappings ?? [])
                .filter(m => m.sourceHeader && m.suggestedTarget && m.confidence > 0)
                .map((m, i) => ({
                  id: `preset-${i}`,
                  sourceColumn: m.sourceHeader,
                  outputName: m.suggestedTarget,
                  order: i
                }))
        }
        requiredColumns={requiredColumns}
        onConfirm={handleMappingConfirm}
        onCancel={handleMappingCancel}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 8 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  importBtn: {
    padding: '6px 14px',
    cursor: 'pointer',
    background: '#1677ff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 14
  },
  filePath: { fontSize: 13, color: '#555', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  select: { padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 4 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  th: { background: '#f5f5f5', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' },
  td: { padding: '4px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' },
  rowEven: { background: '#fff' },
  rowOdd: { background: '#fafafa' },
  hint: { padding: '4px 10px', fontSize: 12, color: '#888', borderTop: '1px solid #f0f0f0' },
  empty: { color: '#aaa', fontSize: 14, padding: '20px 0', textAlign: 'center' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255,255,255,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  loadingSpinner: {
    padding: '10px 20px',
    background: '#fff',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  matchGood: { color: '#52c41a', fontWeight: 500 },
  matchBad: { color: '#faad14', fontWeight: 500 },
  mappingBtn: {
    padding: '4px 10px',
    cursor: 'pointer',
    background: '#fff',
    color: '#595959',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    fontSize: 13
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  sheetTypeDialog: {
    background: '#fff',
    borderRadius: 8,
    padding: '24px 32px',
    minWidth: 320,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16
  },
  sheetTypeTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a1a'
  },
  sheetTypeHint: {
    margin: 0,
    fontSize: 13,
    color: '#595959',
    textAlign: 'center'
  },
  sheetTypeBtns: {
    display: 'flex',
    gap: 16
  },
  sheetTypeBtn: {
    padding: '10px 32px',
    fontSize: 15,
    fontWeight: 600,
    border: '1px solid #1677ff',
    borderRadius: 6,
    background: '#fff',
    color: '#1677ff',
    cursor: 'pointer'
  },
  sheetTypeCancelBtn: {
    padding: '6px 16px',
    fontSize: 13,
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    background: '#fff',
    color: '#595959',
    cursor: 'pointer'
  }
}
