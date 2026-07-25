import React, { useState } from 'react'
import type { ExportData, MultiSheetExportData } from '../../../shared/types'

interface ExportButtonProps {
  data: ExportData | null
  resultData?: MultiSheetExportData | null
  sheetName?: string | null
}

type Status = 'idle' | 'exporting' | 'success' | 'error'

export function ExportButton({ data, resultData, sheetName }: ExportButtonProps): React.JSX.Element {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string>('')
  const [savedDir, setSavedDir] = useState<string | null>(null)

  /**
   * 生成默认文件名：sheet名称_时间戳.xlsx
   */
  function generateDefaultFileName(): string {
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const prefix = sheetName ?? '输出'
    return `${prefix}_${timestamp}.xlsx`
  }

  async function handleExport(): Promise<void> {
    // 优先用 resultData（多 sheet），否则降级用 data
    const hasMultiSheet = resultData && resultData.sheets.length > 0
    if (!hasMultiSheet && (!data || data.rows.length === 0)) {
      setStatus('error')
      setMessage('当前规则过滤后无数据，请检查过滤条件或列映射配置。')
      return
    }

    setStatus('exporting')
    setMessage('')
    setSavedDir(null)

    try {
      const filePath = await window.api.saveFile(generateDefaultFileName())
      if (!filePath) {
        setStatus('idle')
        return
      }

      if (hasMultiSheet) {
        await window.api.exportMultiSheet(filePath, resultData)
      } else {
        await window.api.exportExcel(filePath, data!)
      }

      const dir = filePath.replace(/[\\/][^\\/]+$/, '')
      setSavedDir(dir)
      setStatus('success')
      setMessage(`已成功导出到：${filePath}`)
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleOpenDir(): Promise<void> {
    if (savedDir) {
      await window.api.openDirectory(savedDir)
    }
  }

  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.exportBtn,
          opacity: status === 'exporting' ? 0.7 : 1,
          cursor: status === 'exporting' ? 'not-allowed' : 'pointer'
        }}
        onClick={handleExport}
        disabled={status === 'exporting'}
      >
        {status === 'exporting' ? '导出中…' : '📥 生成表格'}
      </button>

      {status === 'success' && (
        <div style={styles.successBox}>
          <span>✅ {message}</span>
          {savedDir && (
            <button style={styles.openDirBtn} onClick={handleOpenDir}>
              打开目录
            </button>
          )}
        </div>
      )}

      {status === 'error' && (
        <div style={styles.errorBox}>❌ {message}</div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 8 },
  exportBtn: {
    padding: '8px 20px',
    background: '#1677ff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    alignSelf: 'flex-start'
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#f6ffed',
    border: '1px solid #b7eb8f',
    borderRadius: 4,
    padding: '8px 12px',
    fontSize: 13,
    color: '#389e0d'
  },
  openDirBtn: {
    padding: '2px 10px',
    cursor: 'pointer',
    background: '#52c41a',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 12
  },
  errorBox: {
    background: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: 4,
    padding: '8px 12px',
    fontSize: 13,
    color: '#cf1322'
  }
}
