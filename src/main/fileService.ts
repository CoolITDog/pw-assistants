import { dialog } from 'electron'
import * as XLSX from 'xlsx'
import type { 
  SheetData, 
  MatchAnalysisResult, 
  MappingTemplate, 
  EnhancedColumnMapping 
} from '../shared/types'
import { analyzeColumnMatching, defaultMatchConfig } from '../shared/matcher'

export async function openFile(): Promise<{ filePath: string; sheets: string[] } | null> {
  const result = await dialog.showOpenDialog({
    title: '选择表格文件',
    filters: [
      { name: '表格文件', extensions: ['xlsx', 'xls', 'csv'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]

  try {
    const workbook = XLSX.readFile(filePath, { bookSheets: true })
    const sheets = workbook.SheetNames
    return { filePath, sheets }
  } catch (err) {
    throw new Error(`无法读取文件：${(err as Error).message}`)
  }
}

export async function readSheet(filePath: string, sheetName: string): Promise<SheetData> {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.readFile(filePath)
  } catch (err) {
    throw new Error(`文件读取失败：${(err as Error).message}`)
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" 不存在`)
  }

  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (aoa.length === 0) {
    return { headers: [], rows: [] }
  }

  console.log('[readSheet] raw rows (first 5):', JSON.stringify(aoa.slice(0, 5), null, 2))

  // 自动检测表头行数，合并多级表头
  const headerRowCount = detectHeaderRows(aoa)
  console.log('[readSheet] detected header rows:', headerRowCount)

  const headers = buildHeaders(aoa, headerRowCount)
  console.log('[readSheet] built headers:', headers)

  const rows: Record<string, unknown>[] = []
  for (let i = headerRowCount; i < aoa.length; i++) {
    const rowArr = aoa[i] as unknown[]
    if (rowArr.every((v) => v === '' || v == null)) continue
    const rowObj: Record<string, unknown> = {}
    headers.forEach((header, idx) => {
      const val = rowArr[idx] ?? ''
      rowObj[header] = normalizeCell(val)
    })
    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * 单元格值归一化：数值保留4位小数，其余原样返回
 */
function normalizeCell(val: unknown): unknown {
  if (typeof val === 'number') {
    return parseFloat(val.toFixed(6))
  }
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
    return parseFloat(Number(val).toFixed(6))
  }
  return val
}

/**
 * TODO 逻辑待完善
 * 检测表头占几行。
 * 判断依据：第一列（距坝里程）出现数值时认为数据开始，之前的行都是表头。
 * 兜底：至少1行，最多3行。
 */
function detectHeaderRows(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 5); i++) {
    const firstCell = (aoa[i] as unknown[])[0]
    // 第一列出现非空数值，说明数据行开始了
    if (firstCell !== '' && firstCell != null && !isNaN(Number(firstCell))) {
      return Math.max(i, 1)
    }
  }
  return 1
}

/**
 * 将多行表头合并为单行列名。
 * 1. 向右填充合并单元格留下的空白
 * 2. 按列将各行值用 "_" 拼接，去掉重复部分
 */
function buildHeaders(aoa: unknown[][], headerRowCount: number): string[] {
  if (headerRowCount === 1) {
    return (aoa[0] as unknown[]).map((h, i) =>
      h === '' || h == null ? `列${i + 1}` : String(h)
    )
  }

  const colCount = Math.max(...aoa.slice(0, headerRowCount).map((r) => (r as unknown[]).length))

  // 向右填充每行（处理合并单元格）
  const filledRows: string[][] = []
  for (let r = 0; r < headerRowCount; r++) {
    const row = (aoa[r] as unknown[]).slice()
    const filled: string[] = []
    let lastVal = ''
    for (let c = 0; c < colCount; c++) {
      const v = row[c]
      if (v !== '' && v != null) lastVal = String(v)
      filled.push(lastVal)
    }
    filledRows.push(filled)
  }

  // 按列拼接，去掉重复的相邻值
  const headers: string[] = []
  for (let c = 0; c < colCount; c++) {
    const parts: string[] = []
    for (let r = 0; r < headerRowCount; r++) {
      const val = filledRows[r][c] ?? ''
      if (val && !parts.includes(val)) {
        parts.push(val)
      }
    }
    headers.push(parts.length > 0 ? parts.join('_') : `列${c + 1}`)
  }

  return headers
}


/**
 * 读取文件并检查列名匹配情况
 * @param filePath 文件路径
 * @param sheetName 工作表名称
 * @param expectedHeaders 期望的列名列表（可选）
 * @returns 匹配分析结果
 */
export async function readSheetWithMatchCheck(
  filePath: string, 
  sheetName: string, 
  expectedHeaders?: string[]
): Promise<MatchAnalysisResult> {
  // 1. 读取文件表头数据
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.readFile(filePath)
  } catch (err) {
    throw new Error(`文件读取失败：${(err as Error).message}`)
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" 不存在`)
  }

  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (aoa.length === 0) {
    throw new Error('文件为空')
  }

  // 2. 检测表头行数并构建表头
  const headerRowCount = detectHeaderRows(aoa)
  const sourceHeaders = buildHeaders(aoa, headerRowCount)

  // 3. 如果没有提供期望列名，使用源列名作为目标（用于后续映射）
  //    实际应用中，可能需要从模板或配置中获取期望的列名
  const targetHeaders = expectedHeaders && expectedHeaders.length > 0 
    ? expectedHeaders 
    : sourceHeaders

  // 4. 调用匹配算法分析列名匹配情况
  const matchResult = analyzeColumnMatching(
    sourceHeaders,
    targetHeaders,
    defaultMatchConfig
  )

  // 5. 返回匹配分析结果
  return matchResult
}

/**
 * 保存映射模板到文件系统
 * @param template 映射模板
 * @returns Promise<void>
 */
export async function saveMappingTemplate(template: MappingTemplate): Promise<void> {
  // TODO: 实现映射模板保存逻辑
  // 目前返回一个未实现的错误，后续任务会实现完整功能
  throw new Error('Not implemented yet: saveMappingTemplate')
}

/**
 * 加载所有保存的映射模板
 * @returns 映射模板列表
 */
export async function loadMappingTemplates(): Promise<MappingTemplate[]> {
  // TODO: 实现映射模板加载逻辑
  // 目前返回一个未实现的错误，后续任务会实现完整功能
  throw new Error('Not implemented yet: loadMappingTemplates')
}

/**
 * 应用映射模板到源列名
 * @param sourceHeaders 源列名列表
 * @param templateId 模板ID
 * @returns 生成的列映射规则
 */
export async function applyMappingTemplate(
  sourceHeaders: string[], 
  templateId: string
): Promise<EnhancedColumnMapping[]> {
  // TODO: 实现模板应用逻辑
  // 目前返回一个未实现的错误，后续任务会实现完整功能
  throw new Error('Not implemented yet: applyMappingTemplate')
}