import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { ColumnMapping, EnhancedColumnMapping } from '../../../shared/types'

/**
 * ManualMappingDialog - 手动列名映射对话框组件
 * 
 * 用于手动配置源文件列名与目标系统列名之间的映射关系。
 * 支持拖拽映射和下拉菜单选择两种方式。
 */
export interface ManualMappingDialogProps {
  /** 源文件的列名列表 */
  sourceHeaders: string[]
  /** 系统预期的目标列名列表（可配置） */
  targetHeaders: string[]
  /** 可选的预设映射关系 */
  presetMappings?: ColumnMapping[]
  /** 必需列列表，这些列必须要有映射关系 */
  requiredColumns?: string[]
  /** 用户确认映射关系后的回调 */
  onConfirm: (mappings: ColumnMapping[]) => void
  /** 取消操作的回调 */
  onCancel: () => void
  /** 对话框是否可见 */
  visible: boolean
}

/**
 * 单个映射关系的数据结构
 */
interface MappingPair {
  sourceColumn: string
  targetColumn: string
}

import { validateMappings, canConfirmMappings, type ValidationResult } from '../../../shared/validator'

export function ManualMappingDialog({
  sourceHeaders,
  targetHeaders,
  presetMappings = [],
  requiredColumns = [],
  onConfirm,
  onCancel,
  visible
}: ManualMappingDialogProps): React.JSX.Element {
  // 映射关系状态
  const [mappings, setMappings] = useState<MappingPair[]>([])
  // 拖拽状态
  const [draggedSource, setDraggedSource] = useState<string | null>(null)
  // 聚焦的目标列（用于键盘导航）
  const [focusedTarget, setFocusedTarget] = useState<string | null>(null)
  // 验证结果状态
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true, errors: [] })
  // 确认按钮ref（用于键盘导航）
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const sourceColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const targetColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 初始化映射关系（从预设映射或自动生成）
  useEffect(() => {
    if (!visible) return
    
    const initialMappings: MappingPair[] = []
    
    // 如果有预设映射，使用预设映射
    if (presetMappings.length > 0) {
      presetMappings.forEach(pm => {
        if (pm.sourceColumn) {
          initialMappings.push({
            sourceColumn: pm.sourceColumn,
            targetColumn: pm.outputName
          })
        }
      })
    } else {
      // 否则自动尝试匹配
      sourceHeaders.forEach(source => {
        const exactMatch = targetHeaders.find(t => t === source)
        if (exactMatch) {
          initialMappings.push({
            sourceColumn: source,
            targetColumn: exactMatch
          })
        }
      })
    }
    
    setMappings(initialMappings)
  }, [visible, sourceHeaders, targetHeaders, presetMappings])

  // 验证映射配置
  useEffect(() => {
    // 将MappingPair转换为ColumnMapping格式进行验证
    const columnMappings: ColumnMapping[] = mappings.map((m, index) => ({
      id: `mapping-${index}`,
      sourceColumn: m.sourceColumn,
      outputName: m.targetColumn,
      order: index
    }))
    
    const result = validateMappings(
      columnMappings,
      sourceHeaders,
      targetHeaders,
      requiredColumns
    )
    setValidationResult(result)
  }, [mappings, sourceHeaders, targetHeaders, requiredColumns])

  // 处理下拉选择
  const handleTargetSelect = useCallback((sourceColumn: string, targetColumn: string) => {
    setMappings(prev => {
      // 检查是否已存在此映射
      const existingIndex = prev.findIndex(m => m.sourceColumn === sourceColumn)
      if (existingIndex >= 0) {
        // 更新已存在的映射
        const updated = [...prev]
        updated[existingIndex] = { sourceColumn, targetColumn }
        return updated
      } else {
        // 添加新映射
        return [...prev, { sourceColumn, targetColumn }]
      }
    })
  }, [])

  // 移除映射
  const handleRemoveMapping = useCallback((sourceColumn: string) => {
    setMappings(prev => prev.filter(m => m.sourceColumn !== sourceColumn))
  }, [])

  // 拖拽事件处理
  const handleDragStart = useCallback((sourceColumn: string) => {
    setDraggedSource(sourceColumn)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedSource(null)
  }, [])

  const handleDrop = useCallback((targetColumn: string) => {
    if (draggedSource) {
      handleTargetSelect(draggedSource, targetColumn)
      setDraggedSource(null)
    }
  }, [draggedSource, handleTargetSelect])

  // 键盘导航处理
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Tab') {
        // 允许默认Tab行为
      } else if (e.key === 'Enter' && e.ctrlKey) {
        // Ctrl+Enter 确认
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, mappings])

  // 处理确认
  const handleConfirm = useCallback(() => {
    // 验证映射配置
    const columnMappings: ColumnMapping[] = mappings.map((m, index) => ({
      id: `mapping-${index}`,
      sourceColumn: m.sourceColumn,
      outputName: m.targetColumn,
      order: index
    }))
    
    const result = validateMappings(
      columnMappings,
      sourceHeaders,
      targetHeaders,
      requiredColumns
    )
    
    // 如果验证失败，阻止确认
    if (!canConfirmMappings(result)) {
      setValidationResult(result)
      return
    }
    
    // 添加未映射的源列（可选：可以添加空映射表示删除该列）
    onConfirm(columnMappings)
  }, [mappings, onConfirm, sourceHeaders, targetHeaders, requiredColumns])

  // 处理重置
  const handleReset = useCallback(() => {
    setMappings([])
  }, [])

  // 检查目标列是否已映射
  const getMappedTargetForSource = useCallback((sourceColumn: string): string | null => {
    const mapping = mappings.find(m => m.sourceColumn === sourceColumn)
    return mapping?.targetColumn ?? null
  }, [mappings])

  // 检查目标列是否已被使用
  const isTargetUsed = useCallback((targetColumn: string): boolean => {
    return mappings.some(m => m.targetColumn === targetColumn)
  }, [mappings])

  // 检查是否是必需列
  const isRequiredColumn = useCallback((targetColumn: string): boolean => {
    return requiredColumns.includes(targetColumn)
  }, [requiredColumns])

  // 检查必需列是否已映射
  const isRequiredMapped = useCallback((targetColumn: string): boolean => {
    if (!isRequiredColumn(targetColumn)) return true
    return mappings.some(m => m.targetColumn === targetColumn)
  }, [mappings, isRequiredColumn])

  // 焦点处理
  const handleTargetKeyDown = useCallback((e: React.KeyboardEvent, targetColumn: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const availableSources = sourceHeaders.filter(s => !mappings.some(m => m.sourceColumn === s))
      if (availableSources.length > 0) {
        handleTargetSelect(availableSources[0], targetColumn)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const targetIndex = targetHeaders.indexOf(targetColumn)
      if (targetIndex < targetHeaders.length - 1) {
        setFocusedTarget(targetHeaders[targetIndex + 1])
        targetColumnRefs.current.get(targetHeaders[targetIndex + 1])?.focus()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const targetIndex = targetHeaders.indexOf(targetColumn)
      if (targetIndex > 0) {
        setFocusedTarget(targetHeaders[targetIndex - 1])
        targetColumnRefs.current.get(targetHeaders[targetIndex - 1])?.focus()
      }
    }
  }, [targetHeaders, sourceHeaders, mappings, handleTargetSelect])

  // 渲染对话框
  if (!visible) {
    return <></>
  }

  // 可用的源列（未映射的）
  const availableSources = sourceHeaders.filter(s => !mappings.some(m => m.sourceColumn === s))
  // 已映射的源列
  const mappedSources = sourceHeaders.filter(s => mappings.some(m => m.sourceColumn === s))

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div style={styles.header}>
          <h2 style={styles.title}>手动列名映射</h2>
          <button style={styles.closeBtn} onClick={onCancel} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 说明文字 */}
        <div style={styles.hint}>
          将左侧源列拖拽到目标列，或点击目标列选择源列进行映射。带 <span style={styles.requiredStar}>*</span> 的列为必需列。
          {!validationResult.isValid && (
            <div style={styles.validationError}>
              {validationResult.errors.map((error, index) => (
                <div key={index} style={styles.errorItem}>
                  {error.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 主内容区 - 两栏布局 */}
        <div style={styles.content}>
          {/* 左侧 - 源列 */}
          <div style={styles.column}>
            <h3 style={styles.columnTitle}>源列（文件列名）</h3>
            <div style={styles.columnContent}>
              {/* 已映射的源列 */}
              {mappedSources.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionLabel}>已映射</div>
                  {mappedSources.map(source => {
                    const mapping = mappings.find(m => m.sourceColumn === source)
                    return (
                      <div
                        key={source}
                        ref={el => { if (el) sourceColumnRefs.current.set(source, el) }}
                        style={{
                          ...styles.sourceItem,
                          ...styles.mappedItem,
                          opacity: draggedSource === source ? 0.5 : 1
                        }}
                        draggable
                        onDragStart={() => handleDragStart(source)}
                        onDragEnd={handleDragEnd}
                        tabIndex={0}
                        role="listitem"
                      >
                        <span style={styles.dragHandle}>⋮⋮</span>
                        <span style={styles.sourceName}>{source}</span>
                        <span style={styles.arrow}>→</span>
                        <span style={styles.mappedTarget}>{mapping?.targetColumn}</span>
                        <button
                          style={styles.removeBtn}
                          onClick={() => handleRemoveMapping(source)}
                          aria-label={`移除${source}的映射`}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              
              {/* 未映射的源列 */}
              {availableSources.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionLabel}>未映射</div>
                  {availableSources.map(source => (
                    <div
                      key={source}
                      ref={el => { if (el) sourceColumnRefs.current.set(source, el) }}
                      style={{
                        ...styles.sourceItem,
                        opacity: draggedSource === source ? 0.5 : 1
                      }}
                      draggable
                      onDragStart={() => handleDragStart(source)}
                      onDragEnd={handleDragEnd}
                      tabIndex={0}
                      role="listitem"
                    >
                      <span style={styles.dragHandle}>⋮⋮</span>
                      <span style={styles.sourceName}>{source}</span>
                    </div>
                  ))}
                </div>
              )}

              {sourceHeaders.length === 0 && (
                <div style={styles.emptyHint}>无源列</div>
              )}
            </div>
          </div>

          {/* 中间 - 连接线区域 */}
          <div style={styles.divider}>
            <div style={styles.dividerLine} />
          </div>

          {/* 右侧 - 目标列 */}
          <div style={styles.column}>
            <h3 style={styles.columnTitle}>目标列（期望列名）</h3>
            <div style={styles.columnContent}>
              {targetHeaders.map(target => {
                const isMapped = mappings.some(m => m.targetColumn === target)
                const mappedSource = mappings.find(m => m.targetColumn === target)?.sourceColumn
                const isRequired = isRequiredColumn(target)
                const hasRequiredError = !isRequiredMapped(target) && isRequired

                return (
                  <div
                    key={target}
                    ref={el => { if (el) targetColumnRefs.current.set(target, el) }}
                    style={{
                      ...styles.targetItem,
                      ...(hasRequiredError ? styles.targetItemError : {}),
                      ...(isMapped ? styles.targetItemMapped : {}),
                      ...(focusedTarget === target ? styles.targetItemFocused : {})
                    }}
                    onDragOver={e => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'link'
                    }}
                    onDrop={() => handleDrop(target)}
                    onClick={() => {
                      // 点击打开下拉选择
                      const select = document.getElementById(`select-${target}`) as HTMLSelectElement
                      if (select) select.focus()
                    }}
                    onKeyDown={e => handleTargetKeyDown(e, target)}
                    tabIndex={0}
                    role="listitem"
                    aria-label={`目标列${target}${isRequired ? '，必需' : ''}${isMapped ? `，已映射${mappedSource}` : ''}`}
                  >
                    {/* 列名标签 */}
                    <div style={styles.targetLabel}>
                      {isRequired && <span style={styles.requiredStar}>*</span>}
                      <span style={styles.targetName}>{target}</span>
                    </div>

                    {/* 映射状态显示 */}
                    {isMapped ? (
                      <div style={styles.mappedInfo}>
                        <span style={styles.mappedSourceLabel}>← {mappedSource}</span>
                      </div>
                    ) : (
                      /* 下拉选择 */
                      <select
                        id={`select-${target}`}
                        style={styles.select}
                        value=""
                        onChange={e => {
                          if (e.target.value) {
                            handleTargetSelect(e.target.value, target)
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="">选择源列...</option>
                        {availableSources.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        {/* 也显示已映射到其他目标的源列（允许重新映射） */}
                        {mappedSources.filter(s => s !== mappedSource).map(s => (
                          <option key={s} value={s}>
                            {s}（已映射）
                          </option>
                        ))}
                      </select>
                    )}

                    {/* 必需列错误提示 */}
                    {hasRequiredError && (
                      <div style={styles.errorHint}>必需列未映射</div>
                    )}
                  </div>
                )
              })}

              {targetHeaders.length === 0 && (
                <div style={styles.emptyHint}>无目标列</div>
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div style={styles.footer}>
          <button style={styles.resetBtn} onClick={handleReset}>
            重置
          </button>
          <div style={styles.footerRight}>
            <button style={styles.cancelBtn} onClick={onCancel}>
              取消
            </button>
            <button
              ref={confirmBtnRef}
              style={{
                ...styles.confirmBtn,
                ...(!validationResult.isValid ? styles.confirmBtnDisabled : {})
              }}
              onClick={handleConfirm}
              disabled={!validationResult.isValid}
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  dialog: {
    background: '#fff',
    borderRadius: 8,
    width: '90vw',
    maxWidth: 900,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e8e8e8'
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a1a'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#8c8c8c',
    padding: 4,
    lineHeight: 1
  },
  hint: {
    padding: '12px 20px',
    fontSize: 13,
    color: '#595959',
    background: '#fafafa',
    borderBottom: '1px solid #e8e8e8'
  },
  requiredStar: {
    color: '#ff4d4f',
    fontWeight: 600
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 300
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0
  },
  columnTitle: {
    margin: 0,
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: '#262626',
    background: '#f5f5f5',
    borderBottom: '1px solid #e8e8e8'
  },
  columnContent: {
    flex: 1,
    overflow: 'auto',
    padding: 12
  },
  section: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 8,
    fontWeight: 500
  },
  sourceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    marginBottom: 6,
    background: '#f0f5ff',
    borderRadius: 4,
    border: '1px solid #d9e4ff',
    cursor: 'grab',
    transition: 'all 0.15s ease'
  },
  mappedItem: {
    background: '#e6f7e6',
    borderColor: '#b7eb8f'
  },
  dragHandle: {
    color: '#8c8c8c',
    fontSize: 14,
    cursor: 'grab',
    userSelect: 'none'
  },
  sourceName: {
    flex: 1,
    fontSize: 13,
    color: '#262626',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  arrow: {
    color: '#52c41a',
    fontSize: 14,
    fontWeight: 600
  },
  mappedTarget: {
    fontSize: 13,
    color: '#389e0d',
    fontWeight: 500
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#8c8c8c',
    cursor: 'pointer',
    padding: 2,
    fontSize: 12,
    lineHeight: 1
  },
  divider: {
    width: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dividerLine: {
    width: 1,
    height: '80%',
    background: '#e8e8e8'
  },
  targetItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 12px',
    marginBottom: 8,
    background: '#fff',
    borderRadius: 4,
    border: '1px solid #d9d9d9',
    transition: 'all 0.15s ease',
    cursor: 'pointer'
  },
  targetItemMapped: {
    background: '#f6ffed',
    borderColor: '#b7eb8f'
  },
  targetItemError: {
    background: '#fff2f0',
    borderColor: '#ffccc7'
  },
  targetItemFocused: {
    borderColor: '#1677ff',
    boxShadow: '0 0 0 2px rgba(22, 119, 255, 0.2)'
  },
  targetLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  targetName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#262626'
  },
  mappedInfo: {
    display: 'flex',
    alignItems: 'center'
  },
  mappedSourceLabel: {
    fontSize: 12,
    color: '#389e0d',
    fontWeight: 500
  },
  select: {
    width: '100%',
    padding: '4px 8px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid #d9d9d9',
    background: '#fff'
  },
  errorHint: {
    fontSize: 11,
    color: '#cf1322'
  },
  emptyHint: {
    color: '#bfbfbf',
    fontSize: 13,
    textAlign: 'center',
    padding: 20
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid #e8e8e8',
    background: '#fafafa'
  },
  footerRight: {
    display: 'flex',
    gap: 8
  },
  resetBtn: {
    padding: '6px 14px',
    fontSize: 13,
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    color: '#595959'
  },
  cancelBtn: {
    padding: '6px 14px',
    fontSize: 13,
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    color: '#595959'
  },
  confirmBtn: {
    padding: '6px 20px',
    fontSize: 13,
    border: 'none',
    borderRadius: 4,
    background: '#1677ff',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 500
  },
  confirmBtnDisabled: {
    background: '#bfbfbf',
    cursor: 'not-allowed'
  },
  validationError: {
    marginTop: 8,
    padding: '8px 12px',
    background: '#fff2f0',
    borderRadius: 4,
    border: '1px solid #ffccc7'
  },
  errorItem: {
    fontSize: 12,
    color: '#cf1322',
    marginBottom: 4
  }
}