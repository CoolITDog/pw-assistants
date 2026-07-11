/// <reference types="vite/client" />

import type { ElectronAPI as AppElectronAPI } from '../../shared/types'

declare global {
  interface Window {
    api: AppElectronAPI
  }
}
