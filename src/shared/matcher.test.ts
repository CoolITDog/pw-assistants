/**
 * 列名匹配算法测试
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  levenshteinDistance,
  calculateSimilarity,
  findExactMatches,
  findFuzzyMatches,
  findSubstringMatches,
  checkMissingRequiredColumns,
  calculateMatchScore,
  analyzeColumnMatching,
  getColumnMatchStatus,
  defaultMatchConfig
} from './matcher'

describe('normalizeHeader', () => {
  it('should trim whitespace', () => {
    expect(normalizeHeader('  列名  ')).toBe('列名')
  })

  it('should convert to lowercase', () => {
    expect(normalizeHeader('ABC')).toBe('abc')
  })

  it('should remove underscores, spaces, and hyphens', () => {
    expect(normalizeHeader('距_坝-里程 ')).toBe('距坝里程')
  })

  it('should remove non-word characters', () => {
    expect(normalizeHeader('列@名#1')).toBe('列名1')
  })
})

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0)
  })

  it('should return length difference for empty strings', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3)
    expect(levenshteinDistance('abc', '')).toBe(3)
  })

  it('should calculate correct edit distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
  })
})

describe('calculateSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(calculateSimilarity('test', 'test')).toBe(1)
  })

  it('should return 1 for empty strings', () => {
    expect(calculateSimilarity('', '')).toBe(1)
  })

  it('should return 0 for completely different strings', () => {
    expect(calculateSimilarity('abc', 'xyz')).toBe(0)
  })

  it('should return similarity between 0 and 1', () => {
    const similarity = calculateSimilarity('hello', 'hallo')
    expect(similarity).toBeGreaterThan(0)
    expect(similarity).toBeLessThan(1)
  })
})

describe('findExactMatches', () => {
  it('should find exact matches', () => {
    const source = ['距坝里程', '测量值', '备注']
    const target = ['距坝里程', '测量值', '备注']
    const result = findExactMatches(source, target)

    expect(result).toHaveLength(3)
    expect(result[0].confidence).toBe(1)
    expect(result[1].confidence).toBe(1)
    expect(result[2].confidence).toBe(1)
  })

  it('should be case insensitive', () => {
    const source = ['ABC', 'DEF']
    const target = ['abc', 'def']
    const result = findExactMatches(source, target)

    expect(result).toHaveLength(2)
  })

  it('should ignore whitespace', () => {
    const source = ['列 名', '测 试']
    const source2 = ['列名', '测试']
    const result = findExactMatches(source, source2)

    expect(result).toHaveLength(2)
  })

  it('should not assign same target to multiple sources', () => {
    const source = ['A', 'B']
    const target = ['X']
    const result = findExactMatches(source, target)

    expect(result).toHaveLength(0)
  })
})

describe('findFuzzyMatches', () => {
  it('should find similar matches above threshold', () => {
    const source = ['距坝里程1']
    const target = ['距坝里程']
    const result = findFuzzyMatches(source, target, 0.6)

    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBeGreaterThan(0.6)
  })

  it('should not match strings below threshold', () => {
    const source = ['abc']
    const target = ['xyz']
    const result = findFuzzyMatches(source, target, 0.6)

    expect(result).toHaveLength(0)
  })

  it('should return best match only', () => {
    const source = ['test']
    const target = ['test1', 'test2']
    const result = findFuzzyMatches(source, target, 0.5)

    expect(result).toHaveLength(1)
  })
})

describe('checkMissingRequiredColumns', () => {
  it('should return empty when all required columns are mapped', () => {
    const required = ['A', 'B', 'C']
    const mappings = [
      { sourceHeader: 'X', suggestedTarget: 'A', confidence: 1 },
      { sourceHeader: 'Y', suggestedTarget: 'B', confidence: 1 },
      { sourceHeader: 'Z', suggestedTarget: 'C', confidence: 1 }
    ]
    const result = checkMissingRequiredColumns(required, mappings)

    expect(result).toHaveLength(0)
  })

  it('should return missing columns', () => {
    const required = ['A', 'B', 'C']
    const mappings = [
      { sourceHeader: 'X', suggestedTarget: 'A', confidence: 1 }
    ]
    const result = checkMissingRequiredColumns(required, mappings)

    expect(result).toContain('B')
    expect(result).toContain('C')
  })
})

describe('calculateMatchScore', () => {
  it('should return 1 for perfect match', () => {
    const mappings = [
      { sourceHeader: 'A', suggestedTarget: 'A', confidence: 1 },
      { sourceHeader: 'B', suggestedTarget: 'B', confidence: 1 }
    ]
    const score = calculateMatchScore(2, 2, mappings)

    expect(score).toBe(1)
  })

  it('should return score between 0 and 1', () => {
    const mappings = [
      { sourceHeader: 'A', suggestedTarget: 'A', confidence: 1 }
    ]
    const score = calculateMatchScore(2, 2, mappings)

    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('should return 0 when no mappings', () => {
    const score = calculateMatchScore(3, 3, [])

    expect(score).toBe(0)
  })
})

describe('analyzeColumnMatching', () => {
  it('should return perfect match for identical headers', () => {
    const source = ['A', 'B', 'C']
    const target = ['A', 'B', 'C']
    const result = analyzeColumnMatching(source, target, defaultMatchConfig)

    expect(result.exactMatches).toHaveLength(3)
    expect(result.matchScore).toBe(1)
    expect(result.needsManualMapping).toBe(false)
  })

  it('should detect needsManualMapping for low match score', () => {
    const source = ['X', 'Y']
    const target = ['A', 'B', 'C']
    const result = analyzeColumnMatching(source, target, defaultMatchConfig)

    expect(result.needsManualMapping).toBe(true)
  })

  it('should include missing required columns', () => {
    const source = ['A']
    const target = ['A', 'B', 'C']
    const result = analyzeColumnMatching(source, target, defaultMatchConfig)

    expect(result.missingRequiredColumns).toContain('B')
    expect(result.missingRequiredColumns).toContain('C')
  })

  it('should find fuzzy matches when enabled', () => {
    const source = ['距坝里程1', '测量值']
    const target = ['距坝里程', '测量值']
    const result = analyzeColumnMatching(source, target, defaultMatchConfig)

    expect(result.exactMatches).toHaveLength(1)
    expect(result.fuzzyMatches.length).toBeGreaterThanOrEqual(1)
  })
})

describe('getColumnMatchStatus', () => {
  it('should return correct status', () => {
    const result = analyzeColumnMatching(
      ['A', 'B', 'C'],
      ['A', 'B', 'D'],
      defaultMatchConfig
    )
    const status = getColumnMatchStatus(result)

    expect(status.exactMatches).toBe(2)
    expect(status.matchScore).toBeGreaterThanOrEqual(0)
    expect(status.matchScore).toBeLessThanOrEqual(1)
  })
})

describe('Property-based tests', () => {
  it('Property: 匹配度分数在有效范围内', () => {
    const sourceHeaders = ['A', 'B', 'C']
    const targetHeaders = ['X', 'Y', 'Z']
    const result = analyzeColumnMatching(sourceHeaders, targetHeaders, defaultMatchConfig)

    expect(result.matchScore).toBeGreaterThanOrEqual(0)
    expect(result.matchScore).toBeLessThanOrEqual(1)
  })

  it('Property: 匹配置信度在有效范围内', () => {
    const sourceHeaders = ['Column1', 'Column2', 'Column3']
    const targetHeaders = ['Target1', 'Target2', 'Target3']
    const result = analyzeColumnMatching(sourceHeaders, targetHeaders, defaultMatchConfig)

    const allSuggestions = [
      ...result.exactMatches,
      ...result.fuzzyMatches,
      ...result.suggestedMappings.filter(s => s.confidence > 0)
    ]

    for (const suggestion of allSuggestions) {
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0)
      expect(suggestion.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('Property: 映射单调性 - 当所有目标都有匹配时添加更多匹配目标保持分数', () => {
    const sourceHeaders = ['A', 'B']
    const targetHeaders1 = ['A', 'B']
    const targetHeaders2 = ['A', 'B', 'C'] // C is new, doesn't match

    const result1 = analyzeColumnMatching(sourceHeaders, targetHeaders1, defaultMatchConfig)
    const result2 = analyzeColumnMatching(sourceHeaders, targetHeaders2, defaultMatchConfig)

    // When source columns all have exact matches, adding unmatched targets shouldn't increase score
    expect(result1.matchScore).toBe(1)
    // Adding more target columns that don't match won't improve the score
    expect(result2.matchScore).toBeLessThanOrEqual(result1.matchScore)
  })
})