# Product

Excel Processor is a Windows desktop application for processing Excel/CSV data files. Users import a spreadsheet, configure transformation rules, preview the result, and export a new Excel file.

## Core Workflow

1. Import — open an `.xlsx`, `.xls`, or `.csv` file and select a sheet
2. Configure rules — define column mappings, filters, formula columns, and curve (piecewise-linear interpolation) rules
3. Preview — live preview of the processed output
4. Export — write the result to a new `.xlsx` file (single or multi-sheet)

## Key Capabilities

- Column mapping: rename, reorder, or drop columns
- Calculated columns: formula expressions using `{列名}` placeholder syntax
- Filter rules: eq, neq, contains, gt, lt, not_empty operators
- Curve rules: map a numeric column through user-defined control points via piecewise linear interpolation
- Multi-sheet export

## Target Users

Internal/domain users processing structured tabular data (e.g. engineering measurement data). UI and user-facing text is in Chinese.
