import { dialog, shell } from 'electron'
import ExcelJS from 'exceljs'
import { dirname } from 'path'
import type { ExportData, MultiSheetExportData } from '../shared/types'

export async function saveFile(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: '保存导出文件',
    defaultPath: 'output.xlsx',
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
  })

  if (result.canceled || !result.filePath) return null
  return result.filePath
}

export async function exportExcel(filePath: string, data: ExportData): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Sheet1')

  // Add header row
  worksheet.addRow(data.headers)

  // Add data rows
  for (const row of data.rows) {
    worksheet.addRow(row as ExcelJS.Row[])
  }

  try {
    await workbook.xlsx.writeFile(filePath)
  } catch (err) {
    throw new Error(`导出失败：${(err as Error).message}`)
  }
}

export async function exportMultiSheet(filePath: string, data: MultiSheetExportData): Promise<void> {
  const workbook = new ExcelJS.Workbook()

  for (const sheet of data.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name)
    worksheet.addRow(sheet.headers)
    for (const row of sheet.rows) {
      worksheet.addRow(sheet.headers.map(h => row[h] ?? ''))
    }
  }

  try {
    await workbook.xlsx.writeFile(filePath)
  } catch (err) {
    throw new Error(`导出失败：${(err as Error).message}`)
  }
}

export async function openDirectory(dirPath: string): Promise<void> {  // If dirPath is a file path, open its parent directory
  const targetDir = dirPath.endsWith('.xlsx') || dirPath.endsWith('.xls') || dirPath.endsWith('.csv')
    ? dirname(dirPath)
    : dirPath

  await shell.openPath(targetDir)
}
