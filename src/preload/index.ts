import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { 
  ElectronAPI, 
  SheetData, 
  ExportData, 
  MultiSheetExportData,
  MatchAnalysisResult,
  MappingTemplate,
  EnhancedColumnMapping 
} from '../shared/types'

const api: ElectronAPI = {
  openFile: () => ipcRenderer.invoke('file:open'),
  readSheet: (filePath: string, sheetName: string): Promise<SheetData> =>
    ipcRenderer.invoke('file:readSheet', filePath, sheetName),
  saveFile: () => ipcRenderer.invoke('export:saveFile'),
  exportExcel: (filePath: string, data: ExportData): Promise<void> =>
    ipcRenderer.invoke('export:excel', filePath, data),
  exportMultiSheet: (filePath: string, data: MultiSheetExportData): Promise<void> =>
    ipcRenderer.invoke('export:multiSheet', filePath, data),
  openDirectory: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('export:openDirectory', dirPath),
  
  // 新增接口 - 手动列名映射功能
  readSheetWithMatchCheck: (
    filePath: string, 
    sheetName: string, 
    expectedHeaders?: string[]
  ): Promise<MatchAnalysisResult> =>
    ipcRenderer.invoke('file:readSheetWithMatchCheck', filePath, sheetName, expectedHeaders),
  
  saveMappingTemplate: (template: MappingTemplate): Promise<void> =>
    ipcRenderer.invoke('file:saveMappingTemplate', template),
  
  loadMappingTemplates: (): Promise<MappingTemplate[]> =>
    ipcRenderer.invoke('file:loadMappingTemplates'),
  
  applyMappingTemplate: (
    sourceHeaders: string[], 
    templateId: string
  ): Promise<EnhancedColumnMapping[]> =>
    ipcRenderer.invoke('file:applyMappingTemplate', sourceHeaders, templateId)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
