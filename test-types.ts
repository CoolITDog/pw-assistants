// Test file to verify new types are correctly defined
import type { 
  ElectronAPI, 
  MatchAnalysisResult, 
  MappingTemplate, 
  EnhancedColumnMapping,
  ColumnMappingSuggestion
} from './src/shared/types'

// Test that the new methods are properly typed
declare const api: ElectronAPI;

// Test 1: readSheetWithMatchCheck
async function testReadSheetWithMatchCheck() {
  const result: MatchAnalysisResult = await api.readSheetWithMatchCheck(
    'test.xlsx',
    'Sheet1',
    ['column1', 'column2', 'column3']
  );
  
  // Should have all the expected properties
  console.log('Match score:', result.matchScore);
  console.log('Needs manual mapping:', result.needsManualMapping);
  console.log('Exact matches:', result.exactMatches.length);
  console.log('Fuzzy matches:', result.fuzzyMatches.length);
  console.log('Missing required columns:', result.missingRequiredColumns);
  console.log('Suggested mappings:', result.suggestedMappings.length);
}

// Test 2: MappingTemplate type
const template: MappingTemplate = {
  id: 'template-1',
  name: 'Engineering Template',
  description: 'Template for engineering data',
  sourcePatterns: ['A', 'B', 'C'],
  targetHeaders: ['距坝里程', '测量值', '时间戳'],
  mappings: [
    {
      id: 'mapping-1',
      sourceColumn: 'A',
      outputName: '距坝里程',
      mappingType: 'manual',
      isRequired: true,
      createdAt: new Date(),
      order: 1
    }
  ],
  createdAt: new Date(),
  usageCount: 5
};

// Test 3: saveMappingTemplate
async function testSaveMappingTemplate() {
  await api.saveMappingTemplate(template);
  console.log('Template saved successfully');
}

// Test 4: loadMappingTemplates
async function testLoadMappingTemplates() {
  const templates: MappingTemplate[] = await api.loadMappingTemplates();
  console.log(`Loaded ${templates.length} templates`);
}

// Test 5: applyMappingTemplate
async function testApplyMappingTemplate() {
  const sourceHeaders = ['A', 'B', 'C', 'D'];
  const mappings: EnhancedColumnMapping[] = await api.applyMappingTemplate(
    sourceHeaders,
    'template-1'
  );
  console.log(`Generated ${mappings.length} mappings from template`);
}

// Test 6: EnhancedColumnMapping type
const enhancedMapping: EnhancedColumnMapping = {
  id: 'enhanced-1',
  sourceColumn: 'source_col',
  outputName: 'output_col',
  mappingType: 'auto',
  confidence: 0.95,
  isRequired: false,
  createdAt: new Date(),
  order: 1
};

// Test 7: ColumnMappingSuggestion type
const suggestion: ColumnMappingSuggestion = {
  sourceHeader: 'old_name',
  suggestedTarget: 'new_name',
  confidence: 0.8
};

console.log('Type checking passed! All new types are properly defined.');