/**
 * 映射验证模块
 * 
 * @remarks
 * 提供列映射关系的验证功能，确保映射配置的完整性和一致性。
 * 验证规则包括：必需列映射检查、映射冲突检测、目标列名重复检查。
 */

import type { ColumnMapping, EnhancedColumnMapping } from './types'

/**
 * 验证错误类型
 * 
 * @remarks
 * 定义映射验证过程中可能出现的各种错误类型。
 */
export type ValidationErrorType = 
  /** 必需列未映射 */
  | 'required_column_missing'
  /** 映射冲突：同一源列映射到多个目标列 */
  | 'source_conflict'
  /** 目标列名重复 */
  | 'duplicate_target'
  /** 源列不存在 */
  | 'source_not_found'
  /** 目标列不存在 */
  | 'target_not_found'

/**
 * 验证错误详情
 */
export interface ValidationError {
  /** 错误类型 */
  type: ValidationErrorType
  /** 错误消息（中文） */
  message: string
  /** 相关源列名（如果有） */
  sourceColumn?: string
  /** 相关目标列名（如果有） */
  targetColumn?: string
  /** 冲突涉及的列名列表 */
  relatedColumns?: string[]
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否通过验证 */
  isValid: boolean
  /** 错误列表 */
  errors: ValidationError[]
}

/**
 * 验证映射配置
 * 
 * @param mappings - 映射关系数组
 * @param sourceHeaders - 源文件的所有列名
 * @param targetHeaders - 目标系统的所有列名
 * @param requiredColumns - 必需列列表（可选）
 * @returns 验证结果
 * 
 * @example
 * ```typescript
 * const result = validateMappings(
 *   [{ id: '1', sourceColumn: '距离', outputName: '距离', order: 0 }],
 *   ['距离', '测量值', '备注'],
 *   ['距离', '测量值', '备注'],
 *   ['距离', '测量值']
 * )
 * 
 * if (!result.isValid) {
 *   console.error('验证失败:', result.errors)
 * }
 * ```
 */
export function validateMappings(
  mappings: ColumnMapping[] | EnhancedColumnMapping[],
  sourceHeaders: string[],
  targetHeaders: string[],
  requiredColumns: string[] = []
): ValidationResult {
  const errors: ValidationError[] = []

  // 1. 检查必需列是否都有映射
  if (requiredColumns.length > 0) {
    const mappedTargets = new Set(
      mappings.map(m => m.outputName).filter(Boolean)
    )
    
    for (const requiredCol of requiredColumns) {
      if (!mappedTargets.has(requiredCol)) {
        errors.push({
          type: 'required_column_missing',
          message: `必需列 "${requiredCol}" 未映射`,
          targetColumn: requiredCol
        })
      }
    }
  }

  // 2. 检查映射冲突：同一源列不能映射到多个目标列
  const sourceToTargetsMap = new Map<string, string[]>()
  for (const mapping of mappings) {
    if (!mapping.sourceColumn) continue // 跳过计算列
    
    const existing = sourceToTargetsMap.get(mapping.sourceColumn) || []
    existing.push(mapping.outputName)
    sourceToTargetsMap.set(mapping.sourceColumn, existing)
  }
  
  for (const [sourceColumn, targetColumns] of sourceToTargetsMap) {
    if (targetColumns.length > 1) {
      errors.push({
        type: 'source_conflict',
        message: `源列 "${sourceColumn}" 映射到了多个目标列：${targetColumns.join(', ')}`,
        sourceColumn,
        relatedColumns: targetColumns
      })
    }
  }

  // 3. 检查目标列名重复
  const targetColumnCounts = new Map<string, string[]>()
  for (const mapping of mappings) {
    if (!mapping.outputName) continue
    
    const existing = targetColumnCounts.get(mapping.outputName) || []
    existing.push(mapping.sourceColumn || '(计算列)')
    targetColumnCounts.set(mapping.outputName, existing)
  }
  
  for (const [targetColumn, sourceColumns] of targetColumnCounts) {
    if (sourceColumns.length > 1) {
      errors.push({
        type: 'duplicate_target',
        message: `目标列 "${targetColumn}" 被多个源列映射：${sourceColumns.join(', ')}`,
        targetColumn,
        relatedColumns: sourceColumns
      })
    }
  }

  // 4. 检查源列是否存在于源文件列名中（仅在有源列名时警告）
  if (sourceHeaders.length > 0) {
    const sourceHeaderSet = new Set(sourceHeaders)
    for (const mapping of mappings) {
      if (mapping.sourceColumn && !sourceHeaderSet.has(mapping.sourceColumn)) {
        errors.push({
          type: 'source_not_found',
          message: `源列 "${mapping.sourceColumn}" 不存在于源文件列名中`,
          sourceColumn: mapping.sourceColumn
        })
      }
    }
  }

  // 5. 检查目标列是否存在于目标列名列表中（仅在有目标列名时警告）
  if (targetHeaders.length > 0) {
    const targetHeaderSet = new Set(targetHeaders)
    for (const mapping of mappings) {
      if (mapping.outputName && !targetHeaderSet.has(mapping.outputName)) {
        errors.push({
          type: 'target_not_found',
          message: `目标列 "${mapping.outputName}" 不在目标列名列表中`,
          targetColumn: mapping.outputName
        })
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 快速验证：仅检查严重错误（必需列缺失和映射冲突）
 * 
 * @param mappings - 映射关系数组
 * @param requiredColumns - 必需列列表
 * @returns 是否有严重错误
 */
export function hasCriticalErrors(
  mappings: ColumnMapping[] | EnhancedColumnMapping[],
  requiredColumns: string[] = []
): boolean {
  // 检查必需列是否缺失
  if (requiredColumns.length > 0) {
    const mappedTargets = new Set(
      mappings.map(m => m.outputName).filter(Boolean)
    )
    
    for (const requiredCol of requiredColumns) {
      if (!mappedTargets.has(requiredCol)) {
        return true
      }
    }
  }

  // 检查源列冲突
  const sourceToTargetsMap = new Map<string, string[]>()
  for (const mapping of mappings) {
    if (!mapping.sourceColumn) continue
    
    const existing = sourceToTargetsMap.get(mapping.sourceColumn) || []
    existing.push(mapping.outputName)
    sourceToTargetsMap.set(mapping.sourceColumn, existing)
  }
  
  for (const targetColumns of sourceToTargetsMap.values()) {
    if (targetColumns.length > 1) {
      return true
    }
  }

  return false
}

/**
 * 获取验证错误摘要
 * 
 * @param errors - 错误列表
 * @returns 按类型分组的错误摘要
 */
export function getErrorSummary(errors: ValidationError[]): Record<ValidationErrorType, number> {
  const summary: Record<ValidationErrorType, number> = {
    required_column_missing: 0,
    source_conflict: 0,
    duplicate_target: 0,
    source_not_found: 0,
    target_not_found: 0
  }
  
  for (const error of errors) {
    summary[error.type]++
  }
  
  return summary
}

/**
 * 检查映射是否可以确认（是否有错误）
 * 
 * @param result - 验证结果
 * @returns 是否可以确认映射
 */
export function canConfirmMappings(result: ValidationResult): boolean {
  // 必需列缺失和映射冲突不允许确认
  const criticalErrors = result.errors.filter(e => 
    e.type === 'required_column_missing' || 
    e.type === 'source_conflict'
  )
  return criticalErrors.length === 0
}