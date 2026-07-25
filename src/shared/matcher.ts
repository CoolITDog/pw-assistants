/**
 * 列名匹配算法模块
 * 
 * @remarks
 * 提供列名自动匹配功能，包括精确匹配、模糊匹配（基于编辑距离）、
 * 必需列检查和匹配度计算。纯函数实现，可用于 main 和 renderer 进程。
 */

import type {
  ColumnMappingSuggestion,
  ColumnMatchStatus,
  MatchAnalysisResult,
  MatchConfiguration
} from './types'

// ─── 默认匹配配置 ────────────────────────────────────────────────────────────

/** 默认匹配配置 */
export const defaultMatchConfig: MatchConfiguration = {
  autoMatch: {
    enableFuzzyMatch: true,
    fuzzyThreshold: 0.85,
    enableSubstringMatch: false,
    ignoredChars: [' ', '_', '-'],
    synonymMapping: {}
  },
  manualMapping: {
    showSuggestions: true,
    suggestionLimit: 10,
    highlightRequiredColumns: true
  },
  templates: {
    userTemplatePath: '',
    systemTemplatePath: '',
    autoApplyThreshold: 0.8
  }
}

// ─── 1. 列名标准化 ──────────────────────────────────────────────────────────

/**
 * 标准化列名
 * 
 * @param header - 原始列名
 * @returns 标准化后的列名
 * 
 * @remarks
 * - 去除首尾空格
 * - 转换为小写
 * - 移除下划线、空格、连字符
 * - 移除非单词字符
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_\s\-]+/g, '')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
}

// ─── 2. Levenshtein 编辑距离算法 ────────────────────────────────────────────

/**
 * 计算两个字符串之间的 Levenshtein 编辑距离
 * 
 * @param source - 源字符串
 * @param target - 目标字符串
 * @returns 编辑距离（整数）
 */
export function levenshteinDistance(source: string, target: string): number {
  const m = source.length
  const n = target.length

  // 边界情况处理
  if (m === 0) return n
  if (n === 0) return m

  // 创建 DP 表
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  // 初始化第一行和第一列
  for (let i = 1; i <= m; i++) {
    dp[i][0] = i
  }
  for (let j = 1; j <= n; j++) {
    dp[0][j] = j
  }

  // 填充 DP 表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // 删除
        dp[i][j - 1] + 1,     // 插入
        dp[i - 1][j - 1] + cost // 替换
      )
    }
  }

  return dp[m][n]
}

// ─── 3. 计算相似度 ──────────────────────────────────────────────────────────

/**
 * 计算两个字符串之间的相似度
 * 
 * @param source - 源字符串
 * @param target - 目标字符串
 * @returns 相似度 (0-1)
 * 
 * @remarks
 * 相似度 = 1 - (编辑距离 / 最大长度)
 */
export function calculateSimilarity(source: string, target: string): number {
  if (source === target) return 1
  const maxLength = Math.max(source.length, target.length)
  if (maxLength === 0) return 1
  const distance = levenshteinDistance(source, target)
  return 1 - distance / maxLength
}

// ─── 4. 精确匹配 ────────────────────────────────────────────────────────────

/**
 * 查找精确匹配的列
 * 
 * @param sourceHeaders - 源文件列名列表
 * @param targetHeaders - 目标列名列表
 * @returns 精确匹配的映射建议
 * 
 * @remarks
 * - 不区分大小写比较
 * - 去除空格后比较
 */
export function findExactMatches(
  sourceHeaders: string[],
  targetHeaders: string[]
): ColumnMappingSuggestion[] {
  const suggestions: ColumnMappingSuggestion[] = []
  const matchedTargets = new Set<string>()

  for (const source of sourceHeaders) {
    const normalizedSource = normalizeHeader(source)

    for (const target of targetHeaders) {
      if (matchedTargets.has(target)) continue

      const normalizedTarget = normalizeHeader(target)

      // 精确匹配：不区分大小写，去除空格后完全相同
      if (normalizedSource === normalizedTarget) {
        suggestions.push({
          sourceHeader: source,
          suggestedTarget: target,
          confidence: 1.0
        })
        matchedTargets.add(target)
        break
      }
    }
  }

  return suggestions
}

// ─── 5. 模糊匹配 ────────────────────────────────────────────────────────────

/**
 * 查找模糊匹配的列（基于编辑距离）
 * 
 * @param sourceHeaders - 源文件列名列表
 * @param targetHeaders - 目标列名列表
 * @param threshold - 相似度阈值 (0-1)
 * @returns 模糊匹配的映射建议
 * 
 * @remarks
 * - 计算标准化后的编辑距离
 * - 只返回相似度 >= threshold 的匹配
 * - 每个源列只返回最佳匹配
 */
export function findFuzzyMatches(
  sourceHeaders: string[],
  targetHeaders: string[],
  threshold: number = 0.6
): ColumnMappingSuggestion[] {
  const suggestions: ColumnMappingSuggestion[] = []
  const matchedTargets = new Set<string>()

  // 已精确匹配的源列不参与模糊匹配
  const exactMatches = findExactMatches(sourceHeaders, targetHeaders)
  const exactSourceHeaders = new Set(exactMatches.map(m => m.sourceHeader))

  for (const source of sourceHeaders) {
    if (exactSourceHeaders.has(source)) continue

    const normalizedSource = normalizeHeader(source)
    let bestMatch: { target: string; similarity: number } | null = null

    for (const target of targetHeaders) {
      if (matchedTargets.has(target)) continue

      const normalizedTarget = normalizeHeader(target)
      const similarity = calculateSimilarity(normalizedSource, normalizedTarget)

      if (similarity >= threshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { target, similarity }
        }
      }
    }

    if (bestMatch) {
      suggestions.push({
        sourceHeader: source,
        suggestedTarget: bestMatch.target,
        confidence: bestMatch.similarity
      })
      matchedTargets.add(bestMatch.target)
    }
  }

  return suggestions
}

// ─── 6. 子字符串匹配 ────────────────────────────────────────────────────────

/**
 * 查找子字符串匹配的列
 * 
 * @param sourceHeaders - 源文件列名列表
 * @param targetHeaders - 目标列名列表
 * @returns 子字符串匹配的映射建议
 * 
 * @remarks
 * - 标准化后进行子字符串匹配
 * - 优先级低于精确匹配和模糊匹配
 */
export function findSubstringMatches(
  sourceHeaders: string[],
  targetHeaders: string[]
): ColumnMappingSuggestion[] {
  const suggestions: ColumnMappingSuggestion[] = []
  const matchedTargets = new Set<string>()

  // 已有精确和模糊匹配的源列不参与子字符串匹配
  const exactMatches = findExactMatches(sourceHeaders, targetHeaders)
  const fuzzyMatches = findFuzzyMatches(
    sourceHeaders,
    targetHeaders,
    defaultMatchConfig.autoMatch.fuzzyThreshold
  )
  const matchedSourceHeaders = new Set([
    ...exactMatches.map(m => m.sourceHeader),
    ...fuzzyMatches.map(m => m.sourceHeader)
  ])

  for (const source of sourceHeaders) {
    if (matchedSourceHeaders.has(source)) continue

    const normalizedSource = normalizeHeader(source)

    for (const target of targetHeaders) {
      if (matchedTargets.has(target)) continue

      const normalizedTarget = normalizeHeader(target)

      // 子字符串匹配：一方包含另一方
      const isSubstring =
        normalizedSource.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedSource)

      if (isSubstring && normalizedSource.length > 1 && normalizedTarget.length > 1) {
        const similarity = calculateSimilarity(normalizedSource, normalizedTarget)
        suggestions.push({
          sourceHeader: source,
          suggestedTarget: target,
          confidence: similarity
        })
        matchedTargets.add(target)
        break
      }
    }
  }

  return suggestions
}

// ─── 7. 必需列检查 ───────────────────────────────────────────────────────────

/**
 * 检查必需列是否都有对应映射
 * 
 * @param requiredColumns - 必需的目标列名列表
 * @param mappings - 当前的映射建议列表
 * @returns 缺失的必需列名列表
 */
export function checkMissingRequiredColumns(
  requiredColumns: string[],
  mappings: ColumnMappingSuggestion[]
): string[] {
  const mappedTargets = new Set(mappings.map(m => m.suggestedTarget))

  return requiredColumns.filter(col => !mappedTargets.has(col))
}

// ─── 8. 匹配度计算 ───────────────────────────────────────────────────────────

/**
 * 计算总体匹配度分数
 * 
 * @param sourceCount - 源列数量
 * @param targetCount - 目标列数量
 * @param mappings - 映射建议列表（包含精确匹配和模糊匹配）
 * @returns 匹配度分数 (0-1)
 * 
 * @remarks
 * 匹配度考虑：
 * - 精确匹配的权重最高 (1.0)
 * - 模糊匹配根据置信度计算
 * - 未匹配的列会降低分数
 * - 当所有匹配都是精确匹配时返回 1.0
 */
export function calculateMatchScore(
  sourceCount: number,
  targetCount: number,
  mappings: ColumnMappingSuggestion[]
): number {
  if (sourceCount === 0 && targetCount === 0) return 1
  if (sourceCount === 0 || targetCount === 0) return 0

  const maxCount = Math.max(sourceCount, targetCount)
  const matchedCount = mappings.length

  // 如果所有列都有匹配且都是精确匹配，返回 1.0
  const exactMatches = mappings.filter(m => m.confidence === 1.0)
  const fuzzyMatches = mappings.filter(m => m.confidence < 1.0)

  if (exactMatches.length === matchedCount && matchedCount === maxCount) {
    return 1.0
  }

  // 计算精确匹配分数
  const exactScore = exactMatches.length / maxCount

  // 计算模糊匹配分数（考虑置信度）
  const fuzzyScore = fuzzyMatches.length > 0
    ? fuzzyMatches.reduce((sum, m) => sum + m.confidence, 0) / maxCount
    : 0

  // 综合分数：精确匹配占 70%，模糊匹配占 30%
  const score = exactScore * 0.7 + fuzzyScore * 0.3

  return Math.min(1, Math.max(0, score))
}

// ─── 9. 主匹配分析函数 ───────────────────────────────────────────────────────

/**
 * 分析列名匹配情况并生成映射建议
 * 
 * @param sourceHeaders - 源文件列名列表
 * @param targetHeaders - 目标列名列表
 * @param config - 匹配配置
 * @returns 匹配分析结果
 * 
 * @example
 * ```typescript
 * const result = analyzeColumnMatching(
 *   ['距坝里程', '测量值_A', '备注'],
 *   ['距坝里程', '测量值', '备注'],
 *   defaultMatchConfig
 * );
 * console.log(result.matchScore);
 * console.log(result.needsManualMapping);
 * ```
 */
export function analyzeColumnMatching(
  sourceHeaders: string[],
  targetHeaders: string[],
  config: MatchConfiguration = defaultMatchConfig
): MatchAnalysisResult {
  // 1. 精确匹配检查
  const exactMatches = findExactMatches(sourceHeaders, targetHeaders)

  // 2. 模糊匹配建议（如果启用）
  let fuzzyMatches: ColumnMappingSuggestion[] = []
  if (config.autoMatch.enableFuzzyMatch) {
    fuzzyMatches = findFuzzyMatches(
      sourceHeaders,
      targetHeaders,
      config.autoMatch.fuzzyThreshold
    )
  }

  // 3. 子字符串匹配建议（如果启用）
  let substringMatches: ColumnMappingSuggestion[] = []
  if (config.autoMatch.enableSubstringMatch) {
    substringMatches = findSubstringMatches(sourceHeaders, targetHeaders)
  }

  // 4. 合并所有匹配结果（排除重复）
  const allMatches = [...exactMatches, ...fuzzyMatches, ...substringMatches]
  const uniqueMatches = deduplicateMatches(allMatches)

  // 5. 应用同义词映射（如果配置）
  const synonymAdjustedMatches = applySynonymMapping(
    uniqueMatches,
    config.autoMatch.synonymMapping
  )

  // 6. 计算匹配度
  const matchScore = calculateMatchScore(
    sourceHeaders.length,
    targetHeaders.length,
    synonymAdjustedMatches
  )

  // 7. 决定是否需要手动映射
  const needsManualMapping =
    matchScore < config.templates.autoApplyThreshold ||
    synonymAdjustedMatches.length < targetHeaders.length

  // 8. 检查必需列（假设所有目标列都是必需列）
  const missingRequired = checkMissingRequiredColumns(
    targetHeaders,
    synonymAdjustedMatches
  )

  // 9. 生成最终建议映射
  const suggestedMappings = generateSuggestedMappings(
    synonymAdjustedMatches,
    sourceHeaders,
    targetHeaders
  )

  return {
    exactMatches,
    fuzzyMatches: synonymAdjustedMatches.filter(m => m.confidence < 1.0),
    matchScore,
    needsManualMapping: needsManualMapping || missingRequired.length > 0,
    missingRequiredColumns: missingRequired,
    suggestedMappings
  }
}

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

/**
 * 去重映射建议，确保每个源列只有一个建议
 * 
 * @param matches - 映射建议列表
 * @returns 去重后的映射建议列表
 */
function deduplicateMatches(
  matches: ColumnMappingSuggestion[]
): ColumnMappingSuggestion[] {
  const seen = new Map<string, ColumnMappingSuggestion>()

  for (const match of matches) {
    const existing = seen.get(match.sourceHeader)
    if (!existing || match.confidence > existing.confidence) {
      seen.set(match.sourceHeader, match)
    }
  }

  return Array.from(seen.values())
}

/**
 * 应用同义词映射
 * 
 * @param matches - 当前的映射建议
 * @param synonymMapping - 同义词映射表
 * @returns 应用同义词后的映射建议
 */
function applySynonymMapping(
  matches: ColumnMappingSuggestion[],
  synonymMapping: Record<string, string[]>
): ColumnMappingSuggestion[] {
  if (Object.keys(synonymMapping).length === 0) return matches

  return matches.map(match => {
    const normalizedSource = normalizeHeader(match.sourceHeader)
    
    // 检查源列名是否有同义词
    for (const [canonical, synonyms] of Object.entries(synonymMapping)) {
      const normalizedSynonyms = synonyms.map(s => normalizeHeader(s))
      if (normalizedSynonyms.includes(normalizedSource)) {
        // 找到同义词，尝试匹配目标列
        return {
          ...match,
          suggestedTarget: canonical,
          confidence: match.confidence * 0.95 // 同义词匹配降低一点置信度
        }
      }
    }
    
    return match
  })
}

/**
 * 生成完整的建议映射列表
 * 
 * @param matched - 已匹配的映射建议
 * @param sourceHeaders - 所有源列名
 * @param targetHeaders - 所有目标列名
 * @returns 完整的建议映射列表（包含未匹配的列）
 */
function generateSuggestedMappings(
  matched: ColumnMappingSuggestion[],
  sourceHeaders: string[],
  targetHeaders: string[]
): ColumnMappingSuggestion[] {
  const matchedSource = new Set(matched.map(m => m.sourceHeader))
  const matchedTarget = new Set(matched.map(m => m.suggestedTarget))

  const suggestions: ColumnMappingSuggestion[] = [...matched]

  // 添加未匹配的源列（无建议目标）
  for (const source of sourceHeaders) {
    if (!matchedSource.has(source)) {
      suggestions.push({
        sourceHeader: source,
        suggestedTarget: '',
        confidence: 0
      })
    }
  }

  // 添加未匹配的目标列（无源列）
  for (const target of targetHeaders) {
    if (!matchedTarget.has(target)) {
      suggestions.push({
        sourceHeader: '',
        suggestedTarget: target,
        confidence: 0
      })
    }
  }

  return suggestions
}

// ─── 10. 列匹配状态 ─────────────────────────────────────────────────────────

/**
 * 生成列匹配状态信息
 * 
 * @param result - 匹配分析结果
 * @returns 列匹配状态
 */
export function getColumnMatchStatus(result: MatchAnalysisResult): ColumnMatchStatus {
  return {
    exactMatches: result.exactMatches.length,
    fuzzyMatches: result.fuzzyMatches.length,
    unmatched: result.suggestedMappings.filter(m => m.confidence === 0).length,
    needsManualMapping: result.needsManualMapping,
    matchScore: result.matchScore
  }
}