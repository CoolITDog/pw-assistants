# Project Structure

```
src/
  main/           # Electron main process (Node.js)
    index.ts      # App entry, BrowserWindow setup, IPC handler registration
    fileService.ts  # File open dialog, xlsx reading, header detection/normalization
    exportService.ts # Save dialog, ExcelJS write, multi-sheet export, openDirectory
  preload/
    index.ts      # contextBridge — exposes window.api to renderer
    index.d.ts    # Type declarations for preload
  renderer/
    index.html    # HTML entry point
    src/
      main.tsx    # React entry, mounts <App />
      App.tsx     # Root component — owns all state, orchestrates panels
      components/
        FilePanel.tsx     # File import UI, sheet selector
        RulePanel.tsx     # Tab container for all rule types
        PreviewPanel.tsx  # Live preview table of processed output
        ExportButton.tsx  # Export trigger, calls window.api export methods
        Rules/
          CurveRulePanel.tsx  # UI for curve (piecewise interpolation) rules
  shared/         # Code shared between main and renderer (no Electron imports)
    types.ts      # All shared TypeScript interfaces and the ElectronAPI type
    processor.ts  # Pure data transformation: applyFilters, applyMappings,
                  #   evaluateFormula, applyCurveRules, interpolate, processSheet
    processor.test.ts  # Vitest + fast-check tests for processor logic
```

## Key Conventions

- `src/shared/` must remain free of Electron/browser imports — it runs in both processes and in tests
- All types are defined in `src/shared/types.ts`; import from there, never redefine locally
- IPC channel names use `namespace:action` format (e.g. `file:open`, `export:excel`)
- Renderer accesses the OS only via `window.api` — never import Node/Electron modules in renderer code
- Inline styles (`React.CSSProperties` objects) are used throughout the renderer — no CSS files or CSS-in-JS libraries
- UI text is in Chinese; code identifiers and comments may be English or Chinese
- Rule state (mappings, filters, curveRules) lives in `App.tsx` and is passed down as props — no global state library
- `processSheet` in `processor.ts` is the single entry point for data transformation; it composes filters → curve rules → mappings in that order
