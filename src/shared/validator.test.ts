/**
 * 映射验证模块测试
 */
import { describe, it, expect } from 'vitest'
import { 
  validateMappings, 
  hasCriticalErrors, 
  getErrorSummary, 
  canConfirmMappings,
  type ValidationError,
  type ValidationResult,
  type ValidationErrorType
} from './validator'
import type { ColumnMapping, EnhancedColumnMapping } from './types'

describe('validateMappings - 必需列验证', () => {
  it('应通过：所有必需列都已映射', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '距离', outputName: '距离', order: 0 },
      { id: '2', sourceColumn: '测量值', outputName: '测量值', order: 1 }
    ]
    const sourceHeaders = ['距离', '测量值', '备注']
    const targetHeaders = ['距离', '测量值', '备注']
    const requiredColumns = ['距离', '测量值']
    
    const result = validateMappings(mappings, sourceHeaders, targetHeaders, requiredColumns)
    
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('应失败：必需列未映射', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '距离', outputName: '距离', order: 0 }
    ]
    const sourceHeaders = ['距离', '测量值', '备注']
    const targetHeaders = ['距离', '测量值', '备注']
    const requiredColumns = ['距离', '测量值']
    
    const result = validateMappings(mappings, sourceHeaders, targetHeaders, requiredColumns)
    
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].type).toBe('required_column_missing')
    expect(result.errors[0].targetColumn).toBe('测量值')
  })

  it('应失败：多个必需列未映射', () => {
    const mappings: ColumnMapping[] = []
    const sourceHeaders = ['距离', '测量值', '备注']
    const targetHeaders = ['距离', '测量值', '备注']
    const requiredColumns = ['距离', '测量值']
    
    const result = validateMappings(mappings, sourceHeaders, targetHeaders, requiredColumns)
    
    expect(result.isValid).toBe(false)
    expect(result.errors.filter(e => e.type === 'required_column_missing')).toHaveLength(2)
  })
})

describe('validateMappings - 映射冲突检测', () => {
  it('应通过：没有映射冲突', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 },
      { id: '2', sourceColumn: 'B', outputName: 'Y', order: 1 }
    ]
    
    const result = validateMappings(mappings, ['A', 'B', 'C'], ['X', 'Y', 'Z'])
    
    expect(result.isValid).toBe(true)
  })

  it('应失败：同一源列映射到多个目标列', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '距离', outputName: '距离', order: 0 },
      { id: '2', sourceColumn: '距离', outputName: '里程', order: 1 }
    ]
    
    const result = validateMappings(mappings, ['距离', '测量值'], ['距离', '里程', '备注'])
    
    expect(result.isValid).toBe(false)
    const conflictError = result.errors.find(e => e.type === 'source_conflict')
    expect(conflictError).toBeDefined()
    expect(conflictError?.sourceColumn).toBe('距离')
  })

  it('应失败：多个源列冲突', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 },
      { id: '2', sourceColumn: 'A', outputName: 'Y', order: 1 },
      { id: '3', sourceColumn: 'B', outputName: 'Z', order: 2 },
      { id: '4', sourceColumn: 'B', outputName: 'W', order: 3 }
    ]
    
    const result = validateMappings(mappings, ['A', 'B'], ['X', 'Y', 'Z', 'W'])
    
    expect(result.isValid).toBe(false)
    expect(result.errors.filter(e => e.type === 'source_conflict')).toHaveLength(2)
  })
})

describe('validateMappings - 目标列名重复检测', () => {
  it('应通过：没有目标列名重复', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 },
      { id: '2', sourceColumn: 'B', outputName: 'Y', order: 1 }
    ]
    
    const result = validateMappings(mappings, ['A', 'B'], ['X', 'Y'])
    
    expect(result.isValid).toBe(true)
  })

  it('应失败：多个源列映射到同一目标列', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '距离1', outputName: '距离', order: 0 },
      { id: '2', sourceColumn: '距离2', outputName: '距离', order: 1 }
    ]
    
    const result = validateMappings(mappings, ['距离1', '距离2'], ['距离'])
    
    expect(result.isValid).toBe(false)
    const dupError = result.errors.find(e => e.type === 'duplicate_target')
    expect(dupError).toBeDefined()
    expect(dupError?.targetColumn).toBe('距离')
  })
})

describe('validateMappings - 源列和目标列存在性检查', () => {
  it('应警告：源列不存在于源文件', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '不存在的列', outputName: '距离', order: 0 }
    ]
    
    const result = validateMappings(mappings, ['距离', '测量值'], ['距离', '测量值'])
    
    expect(result.errors.some(e => e.type === 'source_not_found')).toBe(true)
  })

  it('应警告：目标列不存在于目标列表', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '距离', outputName: '不存在的目标', order: 0 }
    ]
    
    const result = validateMappings(mappings, ['距离', '测量值'], ['距离', '测量值'])
    
    expect(result.errors.some(e => e.type === 'target_not_found')).toBe(true)
  })
})

describe('validateMappings - 空输入处理', () => {
  it('应通过：空映射数组', () => {
    const result = validateMappings([], ['A', 'B'], ['X', 'Y'])
    
    expect(result.isValid).toBe(true)
  })

  it('应通过：空源文件和目标列名', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 }
    ]
    
    const result = validateMappings(mappings, [], [])
    
    expect(result.isValid).toBe(true)
  })
})

describe('validateMappings - 计算列处理', () => {
  it('应通过：包含计算列（sourceColumn为空）', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '宽度', outputName: '宽度', order: 0 },
      { id: '2', sourceColumn: '高度', outputName: '高度', order: 1 },
      { id: '3', sourceColumn: '', outputName: '面积', formula: '{宽度} * {高度}', order: 2 }
    ]
    
    const result = validateMappings(mappings, ['宽度', '高度'], ['宽度', '高度', '面积'])
    
    expect(result.isValid).toBe(true)
  })

  it('应通过：计算列不影响冲突检测', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 },
      { id: '2', sourceColumn: 'A', outputName: 'Y', order: 1 }, // 冲突
      { id: '3', sourceColumn: '', outputName: 'Z', formula: '{A}', order: 2 } // 计算列，不冲突
    ]
    
    const result = validateMappings(mappings, ['A'], ['X', 'Y', 'Z'])
    
    expect(result.isValid).toBe(false)
    expect(result.errors.filter(e => e.type === 'source_conflict')).toHaveLength(1)
  })
})

describe('hasCriticalErrors', () => {
  it('应返回false：没有严重错误', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 }
    ]
    
    const result = hasCriticalErrors(mappings, ['X'])
    
    expect(result).toBe(false)
  })

  it('应返回true：必需列缺失', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 }
    ]
    
    const result = hasCriticalErrors(mappings, ['X', 'Y'])
    
    expect(result).toBe(true)
  })

  it('应返回true：映射冲突', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 },
      { id: '2', sourceColumn: 'A', outputName: 'Y', order: 1 }
    ]
    
    const result = hasCriticalErrors(mappings, [])
    
    expect(result).toBe(true)
  })
})

describe('getErrorSummary', () => {
  it('应正确统计错误数量', () => {
    const errors: ValidationError[] = [
      { type: 'required_column_missing', message: '错误1', targetColumn: 'A' },
      { type: 'required_column_missing', message: '错误2', targetColumn: 'B' },
      { type: 'source_conflict', message: '错误3', sourceColumn: 'C' },
      { type: 'duplicate_target', message: '错误4', targetColumn: 'D' }
    ]
    
    const summary = getErrorSummary(errors)
    
    expect(summary.required_column_missing).toBe(2)
    expect(summary.source_conflict).toBe(1)
    expect(summary.duplicate_target).toBe(1)
  })
})

describe('canConfirmMappings', () => {
  it('应返回true：无错误', () => {
    const result: ValidationResult = {
      isValid: true,
      errors: []
    }
    
    expect(canConfirmMappings(result)).toBe(true)
  })

  it('应返回false：必需列缺失', () => {
    const result: ValidationResult = {
      isValid: false,
      errors: [
        { type: 'required_column_missing', message: '必需列缺失', targetColumn: 'A' }
      ]
    }
    
    expect(canConfirmMappings(result)).toBe(false)
  })

  it('应返回false：映射冲突', () => {
    const result: ValidationResult = {
      isValid: false,
      errors: [
        { type: 'source_conflict', message: '映射冲突', sourceColumn: 'A' }
      ]
    }
    
    expect(canConfirmMappings(result)).toBe(false)
  })

  it('应返回true：仅有警告（非严重错误）', () => {
    const result: ValidationResult = {
      isValid: true,
      errors: [
        { type: 'source_not_found', message: '源列不存在', sourceColumn: 'X' },
        { type: 'target_not_found', message: '目标列不存在', targetColumn: 'Y' }
      ]
    }
    
    expect(canConfirmMappings(result)).toBe(true)
  })
})

describe('Property-based tests', () => {
  it('Property: 验证结果isValid与errors长度一致', () => {
    // 测试多组随机映射配置
    const testCases = [
      { mappings: [], required: [] },
      { mappings: [{ id: '1', sourceColumn: 'A', outputName: 'X', order: 0 }], required: [] },
      { mappings: [
        { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 },
        { id: '2', sourceColumn: 'A', outputName: 'Y', order: 1 }
      ], required: [] },
      { mappings: [
        { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 },
        { id: '2', sourceColumn: 'B', outputName: 'X', order: 1 }
      ], required: [] },
      { mappings: [], required: ['A', 'B'] }
    ]
    
    for (const tc of testCases) {
      const result = validateMappings(tc.mappings, ['A', 'B'], ['X', 'Y'], tc.required)
      expect(result.isValid).toBe(result.errors.length === 0)
    }
  })

  it('Property: 必需列数量不超过目标列数量时可能通过验证', () => {
    const requiredColumns = ['A', 'B']
    const targetHeaders = ['A', 'B', 'C']
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'X', outputName: 'A', order: 0 },
      { id: '2', sourceColumn: 'Y', outputName: 'B', order: 1 }
    ]
    
    const result = validateMappings(mappings, ['X', 'Y'], targetHeaders, requiredColumns)
    
    expect(result.isValid).toBe(true)
  })

  it('Property: canConfirmMappings与hasCriticalErrors逻辑一致', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 }
    ]
    const requiredColumns = ['X', 'Y']
    
    const validationResult = validateMappings(mappings, ['A', 'B'], ['X', 'Y'], requiredColumns)
    const canConfirm = canConfirmMappings(validationResult)
    const hasCritical = !hasCriticalErrors(mappings, requiredColumns)
    
    expect(canConfirm).toBe(hasCritical)
  })

  it('Property: 单个有效映射应通过验证', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: '源', outputName: '目标', order: 0 }
    ]
    
    const result = validateMappings(mappings, ['源'], ['目标'], [])
    
    expect(result.isValid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('Property: 空必需列列表应允许任何映射', () => {
    const mappings: ColumnMapping[] = [
      { id: '1', sourceColumn: 'A', outputName: 'X', order: 0 }
    ]
    
    const result = validateMappings(mappings, ['A'], ['X', 'Y'], [])
    
    expect(result.isValid).toBe(true)
  })
})

describe('EnhancedColumnMapping 兼容性', () => {
  it('应支持EnhancedColumnMapping类型', () => {
    const mappings: EnhancedColumnMapping[] = [
      { 
        id: '1', 
        sourceColumn: '距离', 
        outputName: '距离', 
        mappingType: 'manual',
        isRequired: true,
        createdAt: new Date(),
        order: 0 
      }
    ]
    
    const result = validateMappings(mappings, ['距离', '测量值'], ['距离', '测量值'], ['距离'])
    
    expect(result.isValid).toBe(true)
  })

  it('应正确处理必需列标识', () => {
    const mappings: EnhancedColumnMapping[] = [
      { 
        id: '1', 
        sourceColumn: 'A', 
        outputName: 'X', 
        mappingType: 'auto',
        isRequired: false,
        createdAt: new Date(),
        order: 0 
      }
    ]
    
    // isRequired字段不影响验证，只使用requiredColumns参数
    const result = validateMappings(mappings, ['A', 'B'], ['X', 'Y'], ['X'])
    
    expect(result.isValid).toBe(true)
  })
})