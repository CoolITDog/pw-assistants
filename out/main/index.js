"use strict";
const electron = require("electron");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const XLSX__namespace = /* @__PURE__ */ _interopNamespaceDefault(XLSX);
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
async function openFile() {
  const result = await electron.dialog.showOpenDialog({
    title: "选择表格文件",
    filters: [
      { name: "表格文件", extensions: ["xlsx", "xls", "csv"] },
      { name: "所有文件", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  try {
    const workbook = XLSX__namespace.readFile(filePath, { bookSheets: true });
    const sheets = workbook.SheetNames;
    return { filePath, sheets };
  } catch (err) {
    throw new Error(`无法读取文件：${err.message}`);
  }
}
async function readSheet(filePath, sheetName) {
  let workbook;
  try {
    workbook = XLSX__namespace.readFile(filePath);
  } catch (err) {
    throw new Error(`文件读取失败：${err.message}`);
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" 不存在`);
  }
  const aoa = XLSX__namespace.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (aoa.length === 0) {
    return { headers: [], rows: [] };
  }
  console.log("[readSheet] raw rows (first 5):", JSON.stringify(aoa.slice(0, 5), null, 2));
  const headerRowCount = detectHeaderRows(aoa);
  console.log("[readSheet] detected header rows:", headerRowCount);
  const headers = buildHeaders(aoa, headerRowCount);
  console.log("[readSheet] built headers:", headers);
  const rows = [];
  for (let i = headerRowCount; i < aoa.length; i++) {
    const rowArr = aoa[i];
    if (rowArr.every((v) => v === "" || v == null)) continue;
    const rowObj = {};
    headers.forEach((header, idx) => {
      const val = rowArr[idx] ?? "";
      rowObj[header] = normalizeCell(val);
    });
    rows.push(rowObj);
  }
  return { headers, rows };
}
function normalizeCell(val) {
  if (typeof val === "number") {
    return parseFloat(val.toFixed(6));
  }
  if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) {
    return parseFloat(Number(val).toFixed(6));
  }
  return val;
}
function detectHeaderRows(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 5); i++) {
    const firstCell = aoa[i][0];
    if (firstCell !== "" && firstCell != null && !isNaN(Number(firstCell))) {
      return Math.max(i, 1);
    }
  }
  return 1;
}
function buildHeaders(aoa, headerRowCount) {
  if (headerRowCount === 1) {
    return aoa[0].map(
      (h, i) => h === "" || h == null ? `列${i + 1}` : String(h)
    );
  }
  const colCount = Math.max(...aoa.slice(0, headerRowCount).map((r) => r.length));
  const filledRows = [];
  for (let r = 0; r < headerRowCount; r++) {
    const row = aoa[r].slice();
    const filled = [];
    let lastVal = "";
    for (let c = 0; c < colCount; c++) {
      const v = row[c];
      if (v !== "" && v != null) lastVal = String(v);
      filled.push(lastVal);
    }
    filledRows.push(filled);
  }
  const headers = [];
  for (let c = 0; c < colCount; c++) {
    const parts = [];
    for (let r = 0; r < headerRowCount; r++) {
      const val = filledRows[r][c] ?? "";
      if (val && !parts.includes(val)) {
        parts.push(val);
      }
    }
    headers.push(parts.length > 0 ? parts.join("_") : `列${c + 1}`);
  }
  return headers;
}
async function readSheetWithMatchCheck(filePath, sheetName, expectedHeaders) {
  throw new Error("Not implemented yet: readSheetWithMatchCheck");
}
async function saveMappingTemplate(template) {
  throw new Error("Not implemented yet: saveMappingTemplate");
}
async function loadMappingTemplates() {
  throw new Error("Not implemented yet: loadMappingTemplates");
}
async function applyMappingTemplate(sourceHeaders, templateId) {
  throw new Error("Not implemented yet: applyMappingTemplate");
}
async function saveFile() {
  const result = await electron.dialog.showSaveDialog({
    title: "保存导出文件",
    defaultPath: "output.xlsx",
    filters: [{ name: "Excel 文件", extensions: ["xlsx"] }]
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}
async function exportExcel(filePath, data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.addRow(data.headers);
  for (const row of data.rows) {
    worksheet.addRow(row);
  }
  try {
    await workbook.xlsx.writeFile(filePath);
  } catch (err) {
    throw new Error(`导出失败：${err.message}`);
  }
}
async function exportMultiSheet(filePath, data) {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of data.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRow(sheet.headers);
    for (const row of sheet.rows) {
      worksheet.addRow(sheet.headers.map((h) => row[h] ?? ""));
    }
  }
  try {
    await workbook.xlsx.writeFile(filePath);
  } catch (err) {
    throw new Error(`导出失败：${err.message}`);
  }
}
async function openDirectory(dirPath) {
  const targetDir = dirPath.endsWith(".xlsx") || dirPath.endsWith(".xls") || dirPath.endsWith(".csv") ? path.dirname(dirPath) : dirPath;
  await electron.shell.openPath(targetDir);
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    if (is.dev) {
      mainWindow.webContents.openDevTools();
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function registerIpcHandlers() {
  electron.ipcMain.handle("file:open", () => openFile());
  electron.ipcMain.handle(
    "file:readSheet",
    (_event, filePath, sheetName) => readSheet(filePath, sheetName)
  );
  electron.ipcMain.handle("file:readSheetWithMatchCheck", (_event, filePath, sheetName, expectedHeaders) => readSheetWithMatchCheck());
  electron.ipcMain.handle(
    "file:saveMappingTemplate",
    (_event, template) => saveMappingTemplate()
  );
  electron.ipcMain.handle("file:loadMappingTemplates", () => loadMappingTemplates());
  electron.ipcMain.handle(
    "file:applyMappingTemplate",
    (_event, sourceHeaders, templateId) => applyMappingTemplate()
  );
  electron.ipcMain.handle("export:saveFile", () => saveFile());
  electron.ipcMain.handle(
    "export:excel",
    (_event, filePath, data) => exportExcel(filePath, data)
  );
  electron.ipcMain.handle(
    "export:multiSheet",
    (_event, filePath, data) => exportMultiSheet(filePath, data)
  );
  electron.ipcMain.handle("export:openDirectory", (_event, dirPath) => openDirectory(dirPath));
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.excel-processor");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  registerIpcHandlers();
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
