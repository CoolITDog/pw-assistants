import Store from 'electron-store'

/**
 * 配置项类型定义
 */
interface ConfigSchema {
  /**
   * 按 sheet 名称存储的期望列名
   * key 为 sheet 名称，value 为该 sheet 的期望列名列表
   */
  sheetHeaders: Record<string, string[]>
  /**
   * 通用期望列名列表（兜底，当没有对应 sheet 配置时使用）
   */
  expectedHeaders: string[]
}

/**
 * 干流 sheet 的默认期望列名列表
 */
export const DEFAULT_GANGLIU_HEADERS: string[] = [
  '距坝里程',
  '断面号',
  '天然深泓',
  '多年平均水面线',
  '0.05_天然水面线',
  '0.05_3198',
  '0.05_3200',
  '0.05_3202',
  '0.2_天然水面线',
  '0.2_3198',
  '0.2_3200',
  '0.2_3202'
]

/**
 * 支流 sheet 的默认期望列名列表
 */
export const DEFAULT_ZHILIU_HEADERS: string[] = [
  '距坝里程',
  '断面号',
  '天然深泓',
  '多年平均水面线',
  '0.05_天然水面线',
  '0.05_3202',
  '0.05_3198',
  '0.05_3200',
  '0.2_天然水面线',
  '0.2_3198',
  '0.2_3200',
  '0.2_3202'
]

/**
 * 默认 sheet 配置映射
 */
const DEFAULT_SHEET_HEADERS: Record<string, string[]> = {
  '干流': DEFAULT_GANGLIU_HEADERS,
  '支流': DEFAULT_ZHILIU_HEADERS
}

/**
 * 通用默认列名（用于未知 sheet）
 */
export const DEFAULT_EXPECTED_HEADERS: string[] = DEFAULT_GANGLIU_HEADERS

/**
 * 配置存储实例
 */
const store = new Store<ConfigSchema>({
  name: 'excel-processor-config',
  defaults: {
    sheetHeaders: DEFAULT_SHEET_HEADERS,
    expectedHeaders: DEFAULT_EXPECTED_HEADERS
  }
})

/**
 * 获取指定 sheet 的期望列名列表
 * @param sheetName - sheet 名称（可选），不传则返回通用配置
 * @returns 期望列名数组
 */
export function getExpectedHeaders(sheetName?: string): string[] {
  if (sheetName) {
    const sheetHeaders = store.get('sheetHeaders', DEFAULT_SHEET_HEADERS)
    if (sheetHeaders[sheetName]) {
      return sheetHeaders[sheetName]
    }
  }
  return store.get('expectedHeaders', DEFAULT_EXPECTED_HEADERS)
}

/**
 * 检查指定 sheet 是否有专属的列名配置
 * @param sheetName - sheet 名称
 * @returns 是否有专属配置
 */
export function hasSheetConfig(sheetName: string): boolean {
  const sheetHeaders = store.get('sheetHeaders', DEFAULT_SHEET_HEADERS)
  return sheetName in sheetHeaders
}

/**
 * 设置指定 sheet 的期望列名列表
 * @param headers 新的期望列名数组
 * @param sheetName 可选的 sheet 名称，传入时只更新该 sheet 的配置
 */
export function setExpectedHeaders(headers: string[], sheetName?: string): void {
  if (!Array.isArray(headers)) {
    throw new Error('期望列名必须是数组')
  }
  const validHeaders = headers.filter(h => h && typeof h === 'string' && h.trim() !== '')
  
  if (sheetName) {
    const sheetHeaders = store.get('sheetHeaders', DEFAULT_SHEET_HEADERS)
    sheetHeaders[sheetName] = validHeaders
    store.set('sheetHeaders', sheetHeaders)
  } else {
    store.set('expectedHeaders', validHeaders)
  }
}

/**
 * 重置为默认期望列名列表
 */
export function resetExpectedHeaders(): void {
  store.set('sheetHeaders', DEFAULT_SHEET_HEADERS)
  store.set('expectedHeaders', DEFAULT_EXPECTED_HEADERS)
}

/**
 * 获取默认期望列名列表
 * @returns 默认期望列名数组
 */
export function getDefaultExpectedHeaders(): string[] {
  return [...DEFAULT_EXPECTED_HEADERS]
}

/**
 * 检查配置是否存在
 * @returns 是否存在有效配置
 */
export function hasConfig(): boolean {
  const headers = store.get('expectedHeaders')
  return Array.isArray(headers) && headers.length > 0
}
