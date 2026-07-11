# Implementation Plan: Excel Processor

## Overview

按照以下顺序实现：项目脚手架 → 核心数据处理逻辑 → Electron 主进程服务 → React UI 组件 → 集成联调 → 打包配置。

## Tasks

- [x] 1. 初始化项目结构
  - 使用 electron-vite 脚手架初始化 Electron + React + TypeScript 项目
  - 安装依赖：xlsx（SheetJS）、exceljs、fast-check（属性测试）、vitest
  - 配置 electron-builder 打包为 Windows NSIS 安装包
  - 配置 TypeScript 路径别名和 Vitest 测试环境
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. 实现核心数据处理逻辑（纯函数，无 UI 依赖）
  - [x] 2.1 实现 `applyFilters(rows, filters): rows` 过滤函数
    - 支持操作符：eq / neq / contains / gt / lt / not_empty
    - _Requirements: 2.2_
  - [ ]* 2.2 为 applyFilters 编写属性测试
    - **Property 2: 过滤规则单调性** — 过滤后行数 <= 原始行数
    - **Property 5: 过滤条件正确性** — 结果中每行都满足所有过滤条件
    - **Validates: Requirements 2.2**
  - [x] 2.3 实现 `applyMappings(rows, mappings): rows` 列映射函数
    - 支持源列映射、自定义输出列名、按 order 排序
    - _Requirements: 2.1, 2.4_
  - [x]* 2.4 为 applyMappings 编写属性测试
    - **Property 1: 列映射输出列数一致性** — 输出每行字段数等于映射数量且顺序正确
    - **Validates: Requirements 2.1, 2.4**
  - [x] 2.5 实现 `evaluateFormula(formula, row): unknown` 公式求值函数
    - 支持 `{列名}` 占位符替换，支持加减乘除和字符串拼接
    - 语法错误时返回 `#ERROR`
    - _Requirements: 2.3_
  - [ ]* 2.6 为 evaluateFormula 编写属性测试
    - **Property 3: 计算列公式求值稳定性** — 同一行数据和公式多次求值结果相同
    - **Validates: Requirements 2.3**
  - [x] 2.7 实现 `processSheet(sheetData, ruleConfig): ExportData` 完整处理流程
    - 组合 applyFilters + applyMappings + evaluateFormula
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Checkpoint — 确保所有单元测试和属性测试通过，如有疑问请告知用户

- [x] 4. 实现 Electron 主进程服务
  - [x] 4.1 实现 FileService：使用 SheetJS 读取 .xlsx / .xls / .csv
    - `openFile()` — 打开文件对话框，返回文件路径和 Sheet 列表
    - `readSheet(filePath, sheetName)` — 读取指定 Sheet，返回 SheetData
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 4.2 实现 ExportService：使用 ExcelJS 写出 .xlsx
    - `saveFile()` — 打开保存对话框，返回用户选择的路径
    - `exportExcel(filePath, data)` — 将 ExportData 写入 .xlsx 文件
    - `openDirectory(dirPath)` — 用系统文件管理器打开目录
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.3 在 preload 脚本中通过 contextBridge 暴露 ElectronAPI
    - 暴露 openFile / readSheet / saveFile / exportExcel / openDirectory
    - _Requirements: 1.1, 3.1_

- [x] 5. 实现 React UI 组件
  - [x] 5.1 实现 FilePanel 组件
    - 导入文件按钮、Sheet 选择下拉框、源数据预览表格（前 20 行）
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 5.2 实现 RulePanel 组件
    - 列映射列表（可增删、可拖拽排序、自定义输出列名）
    - 过滤条件列表（列 + 操作符 + 值）
    - 计算列配置（输出列名 + 公式输入框，内联错误提示）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 5.3 实现 PreviewPanel 组件
    - 展示 processSheet 处理后的前 20 行结果
    - 当规则变更时自动重新计算并刷新
    - _Requirements: 2.5_
  - [x] 5.4 实现 ExportButton 组件及导出流程
    - 调用 saveFile() 获取路径，调用 exportExcel() 写文件
    - 导出成功后显示提示并提供"打开目录"按钮
    - 导出失败时显示错误信息
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Checkpoint — 启动开发模式，手动验证完整流程（导入 → 配置 → 预览 → 导出），确保无报错

- [ ] 7. 集成属性测试：导出 round-trip 验证
  - [ ]* 7.1 编写导出完整性属性测试
    - **Property 4: 导出数据完整性** — 导出 .xlsx 后重新读取，行数和列数与导出前一致
    - **Validates: Requirements 3.1, 3.2**

- [ ] 8. 配置打包并生成 Windows 安装包
  - 配置 electron-builder：target NSIS，arch x64
  - 确认打包产物在无 Node.js 环境下可正常运行
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 9. Final Checkpoint — 确保所有测试通过，打包产物可正常启动

## Notes

- 标有 `*` 的子任务为可选测试任务，可跳过以加快 MVP 进度
- 核心处理逻辑（Task 2）为纯函数，与 Electron/UI 完全解耦，便于独立测试
- 属性测试使用 fast-check，每个属性运行 100 次以上
