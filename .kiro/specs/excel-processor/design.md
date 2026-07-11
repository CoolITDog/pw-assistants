# Design Document: Excel Processor

## Overview

基于 Electron + React + TypeScript 构建的桌面应用程序。Electron 提供原生文件对话框、文件系统访问能力，并将整个应用打包为独立 .exe，无需用户安装任何运行时。React 负责 UI 渲染，ExcelJS 负责读写 .xlsx 文件，SheetJS（xlsx）负责解析 .xls / .csv。

技术选型理由：
- **Electron**: 成熟的跨平台桌面方案，打包后内嵌 Chromium + Node.js，目标机器无需任何额外安装
- **React + TypeScript**: 组件化 UI，类型安全
- **ExcelJS**: 写入 .xlsx 支持样式控制
- **SheetJS (xlsx)**: 读取 .xlsx / .xls / .csv 的事实标准库
- **electron-builder**: 打包为 Windows NSIS 安装包或便携 .exe

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Renderer Process            │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ FilePanel│  │RulePanel │  │PreviewPanel│  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       └─────────────┴──────────────┘         │
│                  App State (React)            │
│                  IPC Bridge (preload)         │
└──────────────────────┬──────────────────────┘
                       │ ipcRenderer / ipcMain
┌──────────────────────┴──────────────────────┐
│                  Main Process                │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ FileService │  │    ExportService     │  │
│  │ (SheetJS)   │  │    (ExcelJS)         │  │
│  └─────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────┘
```

进程通信通过 Electron IPC 完成，preload 脚本暴露安全的 API 给渲染进程。

---

## Components and Interfaces

### Renderer 层组件

**FilePanel** — 文件导入区
- 触发文件选择对话框
- 显示已选文件名、Sheet 选择下拉框
- 展示源数据预览表格（前 20 行）

**RulePanel** — 规则配置区
- 列映射列表：源列 → 输出列名（可拖拽排序）
- 过滤条件列表：列 + 操作符（等于/包含/大于/小于/不为空）+ 值
- 计算列配置：输出列名 + 公式表达式（支持 `{列名}` 占位符）

**PreviewPanel** — 结果预览区
- 实时展示按当前规则处理后的前 20 行数据
- 显示最终输出列名

**ExportButton** — 导出按钮
- 触发保存对话框
- 显示导出进度/结果提示

### IPC API（preload 暴露）

```typescript
interface ElectronAPI {
  openFile(): Promise<{ filePath: string; sheets: string[] } | null>
  readSheet(filePath: string, sheetName: string): Promise<SheetData>
  saveFile(): Promise<string | null>  // 返回用户选择的保存路径
  exportExcel(filePath: string, data: ExportData): Promise<void>
  openDirectory(dirPath: string): Promise<void>
}
```

---

## Data Models

```typescript
// 从文件读取的原始数据
interface SheetData {
  headers: string[]          // 列名列表
  rows: Record<string, unknown>[]  // 每行数据，key 为列名
}

// 列映射规则
interface ColumnMapping {
  id: string
  sourceColumn: string       // 源列名，空字符串表示计算列
  outputName: string         // 输出列名
  formula?: string           // 计算列公式，如 "{A列} * {B列}"
  order: number              // 输出顺序
}

// 过滤条件
interface FilterRule {
  id: string
  column: string
  operator: 'eq' | 'contains' | 'gt' | 'lt' | 'not_empty' | 'neq'
  value: string
}

// 完整规则配置（内存中维护，不持久化）
interface RuleConfig {
  columnMappings: ColumnMapping[]
  filters: FilterRule[]
}

// 导出数据结构
interface ExportData {
  headers: string[]
  rows: unknown[][]
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: 列映射输出列数一致性
*For any* SheetData 和 ColumnMapping 列表，经过列映射处理后，每一行输出数据的字段数量应等于 ColumnMapping 列表的长度。
**Validates: Requirements 2.1, 2.4**

Property 2: 过滤规则单调性
*For any* SheetData 和 FilterRule 列表，应用过滤后的行数应小于或等于原始行数。
**Validates: Requirements 2.2**

Property 3: 计算列公式求值稳定性
*For any* 行数据和合法公式字符串，对同一行数据多次求值应返回相同结果（幂等性）。
**Validates: Requirements 2.3**

Property 4: 导出数据完整性
*For any* 经过规则处理后的数据集，导出为 .xlsx 后重新读取，行数和列数应与导出前一致。
**Validates: Requirements 3.1, 3.2**

Property 5: 过滤条件正确性
*For any* 应用了过滤规则的结果集，结果中的每一行都应满足所有过滤条件。
**Validates: Requirements 2.2**

---

## Error Handling

| 场景 | 处理方式 |
|------|----------|
| 文件格式不支持 | 显示 toast 错误提示，不改变当前状态 |
| 文件读取失败（损坏/权限） | 显示具体错误信息 |
| 公式表达式语法错误 | 在计算列输入框下方显示内联错误，预览中该列显示 `#ERROR` |
| 导出路径无写入权限 | 显示错误提示 |
| 导出时数据为空 | 提示用户当前规则过滤后无数据 |

---

## Testing Strategy

### 单元测试（Vitest）

针对纯函数逻辑：
- `applyFilters(rows, filters)` — 过滤逻辑
- `applyMappings(rows, mappings)` — 列映射逻辑
- `evaluateFormula(formula, row)` — 公式求值
- `processSheet(sheetData, ruleConfig)` — 完整处理流程

### 属性测试（fast-check + Vitest）

使用 fast-check 生成随机输入验证上述 Correctness Properties，每个属性测试运行 100 次以上。

测试标注格式：`// Feature: excel-processor, Property N: <property_text>`

### 集成测试

- 使用真实 .xlsx 文件测试完整的读取 → 处理 → 导出流程
- 验证导出文件可被 SheetJS 正确重新读取（Property 4）
