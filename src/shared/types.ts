/**
 * 从文件读取的原始数据
 * 
 * @remarks
 * 表示从Excel/CSV文件读取的原始表格数据，包含表头和行数据。
 * 这是数据处理流程的起点，所有转换规则都基于此数据结构。
 * 
 * @example
 * ```typescript
 * const data: SheetData = {
 *   headers: ['距坝里程', '测量值', '备注'],
 *   rows: [
 *     { '距坝里程': 100, '测量值': 25.5, '备注': '正常' },
 *     { '距坝里程': 200, '测量值': 30.2, '备注': '偏高' }
 *   ]
 * };
 * ```
 */
export interface SheetData {
  /** 表格的表头列名列表 */
  headers: string[]
  /** 表格的行数据，每行是一个对象，键为列名，值为单元格数据 */
  rows: Record<string, unknown>[]
}

/**
 * 列映射规则
 * 
 * @remarks
 * 定义如何将源列映射到输出列。这是数据处理的核心配置之一，
 * 支持重命名列、创建计算列等功能。
 * 
 * @example
 * ```typescript
 * const mapping: ColumnMapping = {
 *   id: 'map-001',
 *   sourceColumn: '距坝里程',
 *   outputName: '距离',
 *   formula: undefined,
 *   order: 1
 * };
 * 
 * // 计算列示例
 * const calculatedMapping: ColumnMapping = {
 *   id: 'calc-001',
 *   sourceColumn: '',
 *   outputName: '总面积',
 *   formula: '{宽度} * {长度}',
 *   order: 3
 * };
 * ```
 */
export interface ColumnMapping {
  /** 映射规则唯一标识符 */
  id: string
  /** 
   * 源列名，空字符串表示计算列
   * - 如果为非空字符串，表示重命名源列
   * - 如果为空字符串，表示创建新的计算列
   */
  sourceColumn: string
  /** 输出列名，在导出文件中使用的列名 */
  outputName: string
  /** 
   * 计算列公式，如 "{A列} * {B列}"
   * - 仅当 sourceColumn 为空字符串时有效
   * - 使用 `{列名}` 占位符引用其他列的值
   */
  formula?: string
  /** 输出顺序，决定在导出文件中列的顺序 */
  order: number
}

/**
 * 增强列映射规则（支持手动、自动、预设映射）
 * 
 * @remarks
 * 这个接口扩展了原始的 `ColumnMapping` 接口，添加了映射类型、置信度、必需列标识等字段，
 * 用于支持手动列名映射功能。
 * 
 * @example
 * ```typescript
 * const mapping: EnhancedColumnMapping = {
 *   id: 'uuid-123',
 *   sourceColumn: '距坝里程',
 *   outputName: '距离',
 *   mappingType: 'auto',
 *   confidence: 0.95,
 *   isRequired: true,
 *   createdAt: new Date(),
 *   order: 1
 * };
 * ```
 */
export interface EnhancedColumnMapping {
  /** 映射规则唯一标识符，用于在系统中唯一标识此映射规则 */
  id: string
  /** 源列名（从文件读取的原始列名），空字符串表示计算列 */
  sourceColumn: string
  /** 输出列名（系统内部使用的规范列名） */
  outputName: string
  /** 映射类型：自动匹配、手动配置、预设模板 */
  mappingType: 'auto' | 'manual' | 'preset'
  /** 
   * 映射置信度（0-1，仅用于自动映射）
   * - 1.0 表示完全匹配
   * - 0.0 表示完全不匹配
   * - 仅在 mappingType 为 'auto' 时有效
   */
  confidence?: number
  /** 是否为必需列，必需列必须要有映射关系才能进行数据处理 */
  isRequired: boolean
  /** 映射创建时间，用于记录和排序 */
  createdAt: Date
  /** 
   * 公式（如果源列为空，表示计算列）
   * 公式使用 `{列名}` 占位符语法，例如 `{A列} * {B列}`
   */
  formula?: string
  /** 输出顺序，决定在导出文件中列的顺序 */
  order: number
}

/**
 * 列匹配状态
 * 
 * @remarks
 * 统计列名匹配的结果，用于显示匹配情况和决定后续操作。
 * 包含匹配数量统计和总体匹配度评估。
 */
export interface ColumnMatchStatus {
  /** 完全匹配的列数（源列名与目标列名完全相同） */
  exactMatches: number
  /** 模糊匹配的列数（相似但不完全相同的列名） */
  fuzzyMatches: number
  /** 未匹配的列数（无法自动匹配的列） */
  unmatched: number
  /** 是否需要手动映射（根据匹配度和必需列情况判断） */
  needsManualMapping: boolean
  /** 总体匹配度分数 (0-1)，越高表示匹配越好 */
  matchScore: number
}

/**
 * 列映射自动建议
 * 
 * @remarks
 * 匹配算法生成的映射建议，包含源列名、建议的目标列名和置信度。
 * 用于在手动映射对话框中为用户提供智能建议。
 * 
 * @example
 * ```typescript
 * const suggestion: ColumnMappingSuggestion = {
 *   sourceHeader: '距坝里程1',
 *   suggestedTarget: '距离',
 *   confidence: 0.85
 * };
 * ```
 */
export interface ColumnMappingSuggestion {
  /** 源文件的列名 */
  sourceHeader: string
  /** 建议映射到的目标列名 */
  suggestedTarget: string
  /** 匹配置信度 (0-1)，越高表示建议越可靠 */
  confidence: number
}

/**
 * 映射模板，用于保存和重用列名映射配置
 * 
 * @remarks
 * 模板可以保存常用的列名映射关系，当用户处理相似格式的文件时，可以快速应用模板，
 * 减少重复配置的工作量。
 * 
 * @example
 * ```typescript
 * const template: MappingTemplate = {
 *   id: 'template-001',
 *   name: '工程测量模板',
 *   description: '用于工程测量数据的列名映射',
 *   sourcePatterns: ['距坝里程', '测量值', '备注'],
 *   targetHeaders: ['距离', '测量值', '说明'],
 *   mappings: [...],
 *   createdAt: new Date('2024-01-01'),
 *   usageCount: 5
 * };
 * ```
 */
export interface MappingTemplate {
  /** 模板唯一标识符，用于在系统中唯一标识此模板 */
  id: string
  /** 模板名称，用户可读的模板标识 */
  name: string
  /** 模板描述，说明模板的用途和适用场景 */
  description: string
  /** 
   * 源列名模式（用于模板匹配）
   * - 包含多个可能的源列名模式
   * - 用于检查源文件是否匹配此模板
   */
  sourcePatterns: string[]
  /** 
   * 对应的目标列名
   * - 映射的目标列名列表
   * - 应与 mappings 中的 outputName 对应
   */
  targetHeaders: string[]
  /** 
   * 映射关系列表
   * - 包含完整的列映射配置
   * - 应用模板时会使用这些映射关系
   */
  mappings: EnhancedColumnMapping[]
  /** 模板创建时间 */
  createdAt: Date
  /** 模板最后使用时间，未使用过则为 undefined */
  lastUsed?: Date
  /** 模板使用次数统计，用于推荐热门模板 */
  usageCount: number
}

/**
 * 用户映射历史记录
 * 
 * @remarks
 * 记录用户成功使用的映射配置，用于提供历史建议和自动匹配。
 * 系统会分析用户的历史映射记录，为新文件提供更准确的建议。
 */
export interface UserMappingHistory {
  /** 历史记录唯一标识符 */
  id: string
  /** 操作时间戳，记录映射配置创建的时间 */
  timestamp: Date
  /** 
   * 源文件模式（用于匹配）
   * - 可以是文件名模式或列名模式
   * - 用于匹配相似的文件或列结构
   */
  sourceFilePattern: string
  /** 映射关系列表，包含用户配置的具体映射规则 */
  mappings: EnhancedColumnMapping[]
  /** 
   * 成功使用率（0-1）
   * - 记录此映射配置被成功应用的频率
   * - 用于推荐最有效的历史映射
   */
  successRate: number
}

/**
 * 匹配配置，控制列名匹配算法的行为和参数
 * 
 * @remarks
 * 这个配置对象允许用户自定义匹配算法的行为，包括模糊匹配阈值、同义词映射、
 * 模板自动应用条件等。配置可以保存和加载，支持个性化设置。
 */
export interface MatchConfiguration {
  /** 自动匹配算法配置 */
  autoMatch: {
    /** 启用模糊匹配，允许相似但不完全相同的列名匹配 */
    enableFuzzyMatch: boolean
    /** 模糊匹配阈值（0-1），相似度高于此值才认为是匹配 */
    fuzzyThreshold: number
    /** 启用子字符串匹配，允许部分匹配 */
    enableSubstringMatch: boolean
    /** 忽略的字符（如空格、下划线等），在匹配时忽略这些字符 */
    ignoredChars: string[]
    /** 同义词映射表，将源列名映射到目标列名 */
    synonymMapping: Record<string, string[]>
  }
  
  /** 手动映射配置 */
  manualMapping: {
    /** 是否在手动映射对话框中显示自动建议 */
    showSuggestions: boolean
    /** 自动建议数量限制，避免界面过于拥挤 */
    suggestionLimit: number
    /** 是否在界面中高亮显示必需列 */
    highlightRequiredColumns: boolean
    /** 默认映射模板ID，新文件默认应用此模板 */
    defaultTemplate?: string
  }
  
  /** 预设模板配置 */
  templates: {
    /** 用户自定义模板存储路径 */
    userTemplatePath: string
    /** 系统内置模板路径 */
    systemTemplatePath: string
    /** 
     * 自动应用模板的条件（0-1）
     * 当源文件与模板的匹配度达到此值时自动应用模板
     */
    autoApplyThreshold: number
  }
}

/**
 * 匹配分析结果
 * 
 * @remarks
 * 包含对源文件列名与目标列名匹配情况的分析结果，
 * 用于决定是否需要手动映射以及提供匹配建议。
 * 
 * @example
 * ```typescript
 * const result: MatchAnalysisResult = {
 *   exactMatches: [...],
 *   fuzzyMatches: [...],
 *   matchScore: 0.75,
 *   needsManualMapping: true,
 *   missingRequiredColumns: ['测量值'],
 *   suggestedMappings: [...]
 * };
 * ```
 */
export interface MatchAnalysisResult {
  /** 完全匹配的映射关系，源列名与目标列名完全相同 */
  exactMatches: ColumnMappingSuggestion[]
  /** 模糊匹配的映射关系，相似但不完全相同的列名 */
  fuzzyMatches: ColumnMappingSuggestion[]
  /** 
   * 总体匹配度分数 (0-1)
   * - 1.0 表示完全匹配
   * - 0.0 表示完全不匹配
   * - 用于决定是否弹出手动映射对话框
   */
  matchScore: number
  /** 
   * 是否需要手动映射
   * - true: 匹配度低或必需列缺失，需要用户手动配置
   * - false: 匹配度足够高，可以直接处理
   */
  needsManualMapping: boolean
  /** 缺失的必需列列表，这些列必须由用户手动映射 */
  missingRequiredColumns: string[]
  /** 推荐的映射关系，基于匹配算法生成的建议 */
  suggestedMappings: ColumnMappingSuggestion[]
}

/**
 * 过滤条件，用于筛选行数据
 * 
 * @remarks
 * 定义数据过滤规则，根据列的值决定是否包含某行数据。
 * 支持多种比较操作符，用于不同的过滤需求。
 * 
 * @example
 * ```typescript
 * const filter: FilterRule = {
 *   id: 'filter-001',
 *   column: '测量值',
 *   operator: 'gt',
 *   value: '0'
 * };
 * // 这个规则会过滤出测量值大于0的行
 * ```
 */
export interface FilterRule {
  /** 过滤规则唯一标识符 */
  id: string
  /** 要过滤的列名 */
  column: string
  /** 
   * 比较操作符：
   * - 'eq': 等于
   * - 'neq': 不等于
   * - 'contains': 包含文本
   * - 'gt': 大于
   * - 'lt': 小于
   * - 'not_empty': 非空
   */
  operator: 'eq' | 'contains' | 'gt' | 'lt' | 'not_empty' | 'neq'
  /** 比较值，字符串格式 */
  value: string
}

/**
 * 完整规则配置（内存中维护，不持久化）
 * 
 * @remarks
 * 包含所有数据处理规则的配置：列映射、过滤器、曲线规则。
 * 这个对象在应用运行时维护，用于处理当前文件的数据。
 */
export interface RuleConfig {
  /** 列映射规则列表 */
  columnMappings: ColumnMapping[]
  /** 过滤规则列表 */
  filters: FilterRule[]
  /** 曲线规则列表 */
  curveRules: CurveRule[]
}

/**
 * 导出数据结构
 * 
 * @remarks
 * 用于传递给导出函数的数据格式，包含处理后的表头和行数据。
 * 这个格式可以直接写入Excel文件。
 */
export interface ExportData {
  /** 导出文件的表头列名 */
  headers: string[]
  /** 导出文件的行数据，二维数组格式 */
  rows: unknown[][]
}

/**
 * 多 sheet 导出数据结构
 * 
 * @remarks
 * 支持导出包含多个工作表（sheet）的Excel文件。
 * 每个工作表可以有独立的数据和表头。
 */
export interface MultiSheetExportData {
  /** 工作表列表 */
  sheets: Array<{
    /** 工作表名称 */
    name: string
    /** 该工作表的表头列名 */
    headers: string[]
    /** 该工作表的数据行 */
    rows: Record<string, unknown>[]
  }>
}

/**
 * 曲线控制点
 * 
 * @remarks
 * 定义分段线性插值曲线的控制点，用于曲线规则。
 * 控制点按x坐标升序排列，用于插值计算。
 */
export interface CurvePoint {
  /** X坐标，输入值 */
  x: number
  /** Y坐标，输出值 */
  y: number
}

/**
 * 曲线规则：将某列数值通过分段线性插值映射为新列
 * 
 * @remarks
 * 曲线规则允许用户定义分段线性插值函数，将输入列的数值映射到新的输出值。
 * 常用于数据转换、单位换算、非线性映射等场景。
 * 
 * @example
 * ```typescript
 * const curveRule: CurveRule = {
 *   id: 'curve-001',
 *   inputColumn: '原始值',
 *   outputName: '转换值',
 *   points: [
 *     { x: 0, y: 0 },
 *     { x: 10, y: 5 },
 *     { x: 20, y: 15 }
 *   ],
 *   order: 2
 * };
 * // 这个规则会根据原始值进行分段线性插值得到转换值
 * ```
 */
export interface CurveRule {
  /** 曲线规则唯一标识符 */
  id: string
  /** 作为 X 轴输入的源列，该列的数值会作为插值的输入 */
  inputColumn: string
  /** 输出列名，插值结果会存储在该列 */
  outputName: string
  /** 控制点列表，必须按 x 坐标升序排列 */
  points: CurvePoint[]
  /** 输出顺序，决定在导出文件中列的顺序 */
  order: number
}

/**
 * Electron IPC API 接口定义
 * 
 * @remarks
 * 这个接口定义了渲染进程（React组件）可以通过 `window.api` 访问的所有方法。
 * 这些方法通过 preload 脚本暴露，实际实现在主进程中。
 * 
 * @example
 * ```typescript
 * // 在React组件中使用
 * const handleOpenFile = async () => {
 *   const result = await window.api.openFile();
 *   if (result) {
 *     console.log(`打开文件: ${result.filePath}`);
 *   }
 * };
 * ```
 */
export interface ElectronAPI {
  /**
   * 打开文件选择对话框，选择要处理的Excel/CSV文件
   * @returns 文件信息（文件路径和工作表列表）或 null（用户取消）
   */
  openFile(): Promise<{ filePath: string; sheets: string[] } | null>
  
  /**
   * 读取指定文件的指定工作表
   * @param filePath - 文件路径
   * @param sheetName - 工作表名称
   * @returns 工作表数据，包含表头和行数据
   */
  readSheet(filePath: string, sheetName: string): Promise<SheetData>
  
  /**
   * 打开保存文件对话框，选择导出文件位置
   * @returns 保存的文件路径或 null（用户取消）
   */
  saveFile(defaultFileName?: string): Promise<string | null>
  
  /**
   * 导出数据到Excel文件（单工作表）
   * @param filePath - 保存的文件路径
   * @param data - 要导出的数据
   */
  exportExcel(filePath: string, data: ExportData): Promise<void>
  
  /**
   * 导出数据到Excel文件（多工作表）
   * @param filePath - 保存的文件路径
   * @param data - 要导出的多工作表数据
   */
  exportMultiSheet(filePath: string, data: MultiSheetExportData): Promise<void>
  
  /**
   * 在文件资源管理器中打开指定目录
   * @param dirPath - 目录路径
   */
  openDirectory(dirPath: string): Promise<void>
  
  // 新增接口 - 手动列名映射功能
  
  /**
   * 读取文件并检查列名匹配情况
   * 
   * @param filePath - 要读取的Excel/CSV文件路径
   * @param sheetName - 工作表名称，对于CSV文件使用默认值
   * @param expectedHeaders - 期望的列名列表（可选），如果未提供则使用系统默认
   * @returns 匹配分析结果，包含匹配度、建议映射等信息
   * 
   * @remarks
   * 这个方法是原始 `readSheet` 方法的增强版本，除了读取数据外，还会
   * 分析源列名与期望列名的匹配情况，为手动映射提供依据。
   * 
   * @example
   * ```typescript
   * const result = await window.api.readSheetWithMatchCheck(
   *   'data.xlsx',
   *   'Sheet1',
   *   ['距离', '测量值', '备注']
   * );
   * console.log(`匹配度: ${result.matchScore}`);
   * ```
   */
  readSheetWithMatchCheck(
    filePath: string, 
    sheetName: string, 
    expectedHeaders?: string[]
  ): Promise<MatchAnalysisResult>
  
  /**
   * 保存映射模板到文件系统
   * 
   * @param template - 要保存的映射模板对象
   * @returns Promise<void>
   * 
   * @remarks
   * 将用户配置的映射模板保存到本地文件系统，供以后重用。
   * 模板会保存到用户数据目录下的 templates 文件夹中。
   * 
   * @throws {Error} 如果模板数据无效或保存失败
   */
  saveMappingTemplate(template: MappingTemplate): Promise<void>
  
  /**
   * 加载所有保存的映射模板
   * 
   * @returns 映射模板列表，按最后使用时间倒序排列
   * 
   * @remarks
   * 从本地文件系统加载所有用户保存的映射模板和系统预设模板。
   * 返回的模板列表包含完整信息，可用于模板选择界面。
   * 
   * @example
   * ```typescript
   * const templates = await window.api.loadMappingTemplates();
   * templates.forEach(template => {
   *   console.log(`${template.name}: ${template.description}`);
   * });
   * ```
   */
  loadMappingTemplates(): Promise<MappingTemplate[]>
  
  /**
   * 应用映射模板到源列名
   * 
   * @param sourceHeaders - 源文件的列名列表
   * @param templateId - 要应用的模板ID
   * @returns 生成的列映射规则数组
   * 
   * @remarks
   * 将指定的模板应用到源列名上，生成具体的映射规则。
   * 如果源列名与模板的源模式不匹配，会生成部分映射或空数组。
   * 
   * @throws {Error} 如果模板不存在或应用失败
   * 
   * @example
   * ```typescript
   * const mappings = await window.api.applyMappingTemplate(
   *   ['距坝里程', '测量值_A', '备注说明'],
   *   'template-001'
   * );
   * ```
   */
  applyMappingTemplate(
    sourceHeaders: string[], 
    templateId: string
  ): Promise<EnhancedColumnMapping[]>
  
  // 配置管理 - 期望列名列表
  
  /**
   * 获取当前配置的期望列名列表
   * 
   * @returns 期望列名数组，如果未配置则返回默认列名
   * 
   * @remarks
   * 期望列名用于列名匹配和映射功能。如果用户未自定义配置，
   * 将返回工程测量常见的默认列名列表。
   * 
   * @example
   * ```typescript
   * const headers = await window.api.getExpectedHeaders();
   * console.log('期望列名:', headers);
   * ```
   */
  getExpectedHeaders(sheetName?: string): Promise<string[]>
  
  /**
   * 检查指定 sheet 是否有专属的列名配置
   * @param sheetName - sheet 名称
   * @returns 是否有专属配置
   */
  hasSheetConfig(sheetName: string): Promise<boolean>
  
  /**
   * 设置期望列名列表
   * 
   * @param headers - 新的期望列名数组
   * @returns Promise<void>
   * 
   * @remarks
   * 保存用户自定义的期望列名列表，配置会持久化保存，
   * 应用重启后仍然有效。
   * 
   * @throws {Error} 如果传入的参数不是有效数组
   * 
   * @example
   * ```typescript
   * await window.api.setExpectedHeaders(['距离', '测量值', '时间']);
   * ```
   */
  setExpectedHeaders(headers: string[], sheetName?: string): Promise<void>
  
  /**
   * 重置期望列名列表为默认值
   * 
   * @returns Promise<void>
   * 
   * @remarks
   * 将期望列名列表重置为系统默认的工程测量常见列名。
   * 
   * @example
   * ```typescript
   * await window.api.resetExpectedHeaders();
   * ```
   */
  resetExpectedHeaders(): Promise<void>
  
  /**
   * 获取默认期望列名列表
   * 
   * @returns 默认期望列名数组（不包含用户自定义配置）
   * 
   * @remarks
   * 返回系统预设的默认列名列表，用于参考或恢复设置。
   * 
   * @example
   * ```typescript
   * const defaults = await window.api.getDefaultExpectedHeaders();
   * ```
   */
  getDefaultExpectedHeaders(): Promise<string[]>
}