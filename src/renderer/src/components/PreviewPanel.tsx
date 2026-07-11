import React from 'react'
import type { ExportData } from '../../../shared/types'

interface PreviewPanelProps {
  data: ExportData | null
}

export function PreviewPanel({ data }: PreviewPanelProps): React.JSX.Element {
  if (!data || data.headers.length === 0) {
    return <div style={styles.empty}>配置列映射后，此处将显示处理结果预览</div>
  }

  const previewRows = data.rows.slice(0, 20)

  return (
    <div style={styles.container}>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {data.headers.map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                {row.map((cell, j) => (
                  <td key={j} style={styles.td}>
                    {cell == null ? '' : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={styles.hint}>
        预览前 {previewRows.length} 行，共 {data.rows.length} 行 · {data.headers.length} 列
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 4 },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 4 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  th: { background: '#e6f4ff', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' },
  td: { padding: '4px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' },
  rowEven: { background: '#fff' },
  rowOdd: { background: '#fafafa' },
  hint: { fontSize: 12, color: '#888', padding: '2px 4px' },
  empty: { color: '#aaa', fontSize: 14, padding: '20px 0', textAlign: 'center' }
}
