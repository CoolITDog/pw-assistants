# Tech Stack

## Framework & Runtime

- **Electron 31** — desktop shell (main + renderer processes)
- **electron-vite 2** — build tooling, dev server, and bundling
- **React 18** + **TypeScript 5** — renderer UI
- **electron-builder 24** — packaging and distribution (Windows portable `.exe`)

## Libraries

- `xlsx` — reading `.xlsx`/`.xls`/`.csv` files (main process)
- `exceljs` — writing output `.xlsx` files (main process)
- `decimal.js` — available for precise numeric operations
- `fast-check` — property-based testing

## Testing

- **Vitest 1** with `fast-check` for property-based tests
- Test files live alongside source: `src/shared/processor.test.ts`

## Common Commands

```bash
# Development
npm run dev          # start electron-vite dev server + Electron

# Build & Package
npm run build        # compile all processes via electron-vite
npm run dist         # build + package to release/ (Windows portable exe)

# Testing
npm test             # run tests once (vitest --run)
npm run test:watch   # run tests in watch mode
```

## IPC Pattern

All file system and OS operations go through Electron IPC:
- Main process handlers registered in `src/main/index.ts` via `ipcMain.handle`
- Renderer calls via `window.api.*` (typed as `ElectronAPI` in `src/shared/types.ts`)
- Preload bridge in `src/preload/index.ts` using `contextBridge.exposeInMainWorld('api', ...)`

## TypeScript Config

Three tsconfig files:
- `tsconfig.json` — root/references
- `tsconfig.node.json` — main + preload processes
- `tsconfig.web.json` — renderer process
