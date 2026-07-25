import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { 
  openFile, 
  readSheet, 
  readSheetWithMatchCheck,
  saveMappingTemplate,
  loadMappingTemplates,
  applyMappingTemplate
} from './fileService'
import { saveFile, exportExcel, exportMultiSheet, openDirectory } from './exportService'
import { 
  getExpectedHeaders, 
  setExpectedHeaders, 
  resetExpectedHeaders,
  getDefaultExpectedHeaders,
  hasSheetConfig
} from './configService'
import type { ExportData, MultiSheetExportData, MatchAnalysisResult, MappingTemplate, EnhancedColumnMapping } from '../shared/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  // 文件操作
  ipcMain.handle('file:open', () => openFile())
  ipcMain.handle('file:readSheet', (_event, filePath: string, sheetName: string) =>
    readSheet(filePath, sheetName)
  )
  ipcMain.handle('file:readSheetWithMatchCheck', (
    _event, 
    filePath: string, 
    sheetName: string, 
    expectedHeaders?: string[]
  ) => readSheetWithMatchCheck(filePath, sheetName, expectedHeaders))
  ipcMain.handle('file:saveMappingTemplate', (_event, template: MappingTemplate) =>
    saveMappingTemplate(template)
  )
  ipcMain.handle('file:loadMappingTemplates', () => loadMappingTemplates())
  ipcMain.handle('file:applyMappingTemplate', (_event, sourceHeaders: string[], templateId: string) =>
    applyMappingTemplate(sourceHeaders, templateId)
  )
  
  // 配置管理 - 期望列名
  ipcMain.handle('config:getExpectedHeaders', (_event, sheetName?: string) => getExpectedHeaders(sheetName))
  ipcMain.handle('config:hasSheetConfig', (_event, sheetName: string) => hasSheetConfig(sheetName))
  ipcMain.handle('config:setExpectedHeaders', (_event, headers: string[], sheetName?: string) => 
    setExpectedHeaders(headers, sheetName)
  )
  ipcMain.handle('config:resetExpectedHeaders', () => resetExpectedHeaders())
  ipcMain.handle('config:getDefaultExpectedHeaders', () => getDefaultExpectedHeaders())
  
  // 导出操作
  ipcMain.handle('export:saveFile', (_event, defaultFileName?: string) => saveFile(defaultFileName))
  ipcMain.handle('export:excel', (_event, filePath: string, data: ExportData) =>
    exportExcel(filePath, data)
  )
  ipcMain.handle('export:multiSheet', (_event, filePath: string, data: MultiSheetExportData) =>
    exportMultiSheet(filePath, data)
  )
  ipcMain.handle('export:openDirectory', (_event, dirPath: string) => openDirectory(dirPath))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.excel-processor')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
