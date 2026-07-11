import React from 'react'
import type { SheetData } from '../../../shared/types'

interface FilePanelProps {
  filePath: string | null
  sheets: string[]
  selectedSheet: string | null
  sheetData: SheetData | null
  onFileOpen: () => void
  onSheetChange: (sheet: string) => void
}

export function FilePanel({
  filePath,
  sheets,
  selectedSheet,
  sheetData,
  onFileOpen,
  onSheetChange
}: FilePanelProps): React.JSX.Element {
  const previewRows = sheetData ? sheetData.rows.slice(0, 20) : []

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button style={styles.importBtn} onClick={onFileOpen}>
          📂 导入文件
        </button>
        {filePath && (
          <span style={styles.filePath} title={filePath}>
            {filePath.split(/[\\/]/).pop()}
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
  filePath: { fontSize: 13, color: '#555', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  select: { padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 4 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  th: { background: '#f5f5f5', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' },
  td: { padding: '4px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' },
  rowEven: { background: '#fff' },
  rowOdd: { background: '#fafafa' },
  hint: { padding: '4px 10px', fontSize: 12, color: '#888', borderTop: '1px solid #f0f0f0' },
  empty: { color: '#aaa', fontSize: 14, padding: '20px 0', textAlign: 'center' }
}
