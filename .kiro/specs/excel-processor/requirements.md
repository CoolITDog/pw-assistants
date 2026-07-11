# Requirements Document

## Introduction

一个桌面应用程序，用于读取 Excel/CSV 表格数据，根据用户在界面上配置的规则对数据进行处理和转换，并将结果导出为新的 Excel 文件保存到本地。应用程序打包后可在任意 Windows 电脑上独立运行，无需安装 Node.js 或其他开发环境。

## Glossary

- **App**: 桌面应用程序本体
- **Source_File**: 用户导入的原始表格文件（.xlsx / .xls / .csv）
- **Rule**: 用户在界面上定义的数据处理规则（列映射、过滤条件、计算列等）
- **Output_File**: 经过规则处理后生成并保存到本地的新表格文件（.xlsx）
- **Column_Mapping**: 将源表格的列映射到输出表格的列的配置
- **Filter**: 按条件筛选行数据的规则
- **Formula**: 基于源列计算新列值的表达式

## Requirements

### Requirement 1: 导入源表格文件

**User Story:** 作为用户，我想导入 Excel 或 CSV 文件，以便程序能读取其中的数据进行处理。

#### Acceptance Criteria

1. WHEN 用户点击"导入文件"按钮，THE App SHALL 打开文件选择对话框，支持选择 .xlsx、.xls、.csv 格式的文件
2. WHEN 用户选择文件后，THE App SHALL 读取并在界面中预览表格的前若干行数据及列名
3. IF 文件格式不支持或文件损坏，THEN THE App SHALL 显示明确的错误提示信息
4. WHEN 文件包含多个 Sheet，THE App SHALL 允许用户选择要处理的 Sheet

### Requirement 2: 配置数据处理规则

**User Story:** 作为用户，我想通过界面配置数据处理规则，以便灵活定义输出表格的结构和内容。

#### Acceptance Criteria

1. THE App SHALL 提供列映射配置，允许用户将源列映射到输出列，并可自定义输出列名
2. THE App SHALL 支持配置行过滤条件，按列值筛选需要保留的数据行
3. THE App SHALL 支持配置计算列，允许用户输入基于源列的简单公式（如加减乘除、字符串拼接）
4. THE App SHALL 支持配置输出列的排列顺序
5. WHEN 用户完成规则配置，THE App SHALL 实时预览按规则处理后的数据结果

### Requirement 3: 生成并导出输出表格

**User Story:** 作为用户，我想将处理后的数据导出为新的 Excel 文件保存到本地，以便后续使用。

#### Acceptance Criteria

1. WHEN 用户点击"生成表格"，THE App SHALL 打开文件保存对话框，允许用户指定输出文件路径和文件名
2. THE App SHALL 将处理结果导出为 .xlsx 格式文件
3. WHEN 导出完成，THE App SHALL 显示成功提示，并提供打开文件所在目录的快捷操作
4. IF 导出过程中发生错误，THEN THE App SHALL 显示具体错误信息

### Requirement 4: 独立打包与分发

**User Story:** 作为用户，我想将程序打包为可执行文件，以便在没有开发环境的电脑上直接运行。

#### Acceptance Criteria

1. THE App SHALL 可被打包为 Windows 可执行文件（.exe）或安装包
2. WHEN 在未安装 Node.js 的 Windows 电脑上运行打包后的程序，THE App SHALL 正常启动并运行所有功能
3. THE App SHALL 将所有依赖项内嵌到打包产物中，无需用户额外安装任何运行时环境
