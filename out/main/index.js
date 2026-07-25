"use strict";
const electron = require("electron");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const Store = require("electron-store");
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
const defaultMatchConfig = {
  autoMatch: {
    enableFuzzyMatch: true,
    fuzzyThreshold: 0.85,
    enableSubstringMatch: false,
    ignoredChars: [" ", "_", "-"],
    synonymMapping: {}
  },
  manualMapping: {
    showSuggestions: true,
    suggestionLimit: 10,
    highlightRequiredColumns: true
  },
  templates: {
    userTemplatePath: "",
    systemTemplatePath: "",
    autoApplyThreshold: 0.8
  }
};
function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/[_\s\-]+/g, "").replace(/[^\w\u4e00-\u9fa5]/g, "");
}
function levenshteinDistance(source, target) {
  const m = source.length;
  const n = target.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from(
    { length: m + 1 },
    (_, i) => Array.from({ length: n + 1 }, (_2, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 1; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        // 删除
        dp[i][j - 1] + 1,
        // 插入
        dp[i - 1][j - 1] + cost
        // 替换
      );
    }
  }
  return dp[m][n];
}
function calculateSimilarity(source, target) {
  if (source === target) return 1;
  const maxLength = Math.max(source.length, target.length);
  if (maxLength === 0) return 1;
  const distance = levenshteinDistance(source, target);
  return 1 - distance / maxLength;
}
function findExactMatches(sourceHeaders, targetHeaders) {
  const suggestions = [];
  const matchedTargets = /* @__PURE__ */ new Set();
  for (const source of sourceHeaders) {
    const normalizedSource = normalizeHeader(source);
    for (const target of targetHeaders) {
      if (matchedTargets.has(target)) continue;
      const normalizedTarget = normalizeHeader(target);
      if (normalizedSource === normalizedTarget) {
        suggestions.push({
          sourceHeader: source,
          suggestedTarget: target,
          confidence: 1
        });
        matchedTargets.add(target);
        break;
      }
    }
  }
  return suggestions;
}
function findFuzzyMatches(sourceHeaders, targetHeaders, threshold = 0.6) {
  const suggestions = [];
  const matchedTargets = /* @__PURE__ */ new Set();
  const exactMatches = findExactMatches(sourceHeaders, targetHeaders);
  const exactSourceHeaders = new Set(exactMatches.map((m) => m.sourceHeader));
  for (const source of sourceHeaders) {
    if (exactSourceHeaders.has(source)) continue;
    const normalizedSource = normalizeHeader(source);
    let bestMatch = null;
    for (const target of targetHeaders) {
      if (matchedTargets.has(target)) continue;
      const normalizedTarget = normalizeHeader(target);
      const similarity = calculateSimilarity(normalizedSource, normalizedTarget);
      if (similarity >= threshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { target, similarity };
        }
      }
    }
    if (bestMatch) {
      suggestions.push({
        sourceHeader: source,
        suggestedTarget: bestMatch.target,
        confidence: bestMatch.similarity
      });
      matchedTargets.add(bestMatch.target);
    }
  }
  return suggestions;
}
function findSubstringMatches(sourceHeaders, targetHeaders) {
  const suggestions = [];
  const matchedTargets = /* @__PURE__ */ new Set();
  const exactMatches = findExactMatches(sourceHeaders, targetHeaders);
  const fuzzyMatches = findFuzzyMatches(
    sourceHeaders,
    targetHeaders,
    defaultMatchConfig.autoMatch.fuzzyThreshold
  );
  const matchedSourceHeaders = /* @__PURE__ */ new Set([
    ...exactMatches.map((m) => m.sourceHeader),
    ...fuzzyMatches.map((m) => m.sourceHeader)
  ]);
  for (const source of sourceHeaders) {
    if (matchedSourceHeaders.has(source)) continue;
    const normalizedSource = normalizeHeader(source);
    for (const target of targetHeaders) {
      if (matchedTargets.has(target)) continue;
      const normalizedTarget = normalizeHeader(target);
      const isSubstring = normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource);
      if (isSubstring && normalizedSource.length > 1 && normalizedTarget.length > 1) {
        const similarity = calculateSimilarity(normalizedSource, normalizedTarget);
        suggestions.push({
          sourceHeader: source,
          suggestedTarget: target,
          confidence: similarity
        });
        matchedTargets.add(target);
        break;
      }
    }
  }
  return suggestions;
}
function checkMissingRequiredColumns(requiredColumns, mappings) {
  const mappedTargets = new Set(mappings.map((m) => m.suggestedTarget));
  return requiredColumns.filter((col) => !mappedTargets.has(col));
}
function calculateMatchScore(sourceCount, targetCount, mappings) {
  if (sourceCount === 0 && targetCount === 0) return 1;
  if (sourceCount === 0 || targetCount === 0) return 0;
  const maxCount = Math.max(sourceCount, targetCount);
  const matchedCount = mappings.length;
  const exactMatches = mappings.filter((m) => m.confidence === 1);
  const fuzzyMatches = mappings.filter((m) => m.confidence < 1);
  if (exactMatches.length === matchedCount && matchedCount === maxCount) {
    return 1;
  }
  const exactScore = exactMatches.length / maxCount;
  const fuzzyScore = fuzzyMatches.length > 0 ? fuzzyMatches.reduce((sum, m) => sum + m.confidence, 0) / maxCount : 0;
  const score = exactScore * 0.7 + fuzzyScore * 0.3;
  return Math.min(1, Math.max(0, score));
}
function analyzeColumnMatching(sourceHeaders, targetHeaders, config = defaultMatchConfig) {
  const exactMatches = findExactMatches(sourceHeaders, targetHeaders);
  let fuzzyMatches = [];
  if (config.autoMatch.enableFuzzyMatch) {
    fuzzyMatches = findFuzzyMatches(
      sourceHeaders,
      targetHeaders,
      config.autoMatch.fuzzyThreshold
    );
  }
  let substringMatches = [];
  if (config.autoMatch.enableSubstringMatch) {
    substringMatches = findSubstringMatches(sourceHeaders, targetHeaders);
  }
  const allMatches = [...exactMatches, ...fuzzyMatches, ...substringMatches];
  const uniqueMatches = deduplicateMatches(allMatches);
  const synonymAdjustedMatches = applySynonymMapping(
    uniqueMatches,
    config.autoMatch.synonymMapping
  );
  const matchScore = calculateMatchScore(
    sourceHeaders.length,
    targetHeaders.length,
    synonymAdjustedMatches
  );
  const needsManualMapping = matchScore < config.templates.autoApplyThreshold || synonymAdjustedMatches.length < targetHeaders.length;
  const missingRequired = checkMissingRequiredColumns(
    targetHeaders,
    synonymAdjustedMatches
  );
  const suggestedMappings = generateSuggestedMappings(
    synonymAdjustedMatches,
    sourceHeaders,
    targetHeaders
  );
  return {
    exactMatches,
    fuzzyMatches: synonymAdjustedMatches.filter((m) => m.confidence < 1),
    matchScore,
    needsManualMapping: needsManualMapping || missingRequired.length > 0,
    missingRequiredColumns: missingRequired,
    suggestedMappings
  };
}
function deduplicateMatches(matches) {
  const seen = /* @__PURE__ */ new Map();
  for (const match of matches) {
    const existing = seen.get(match.sourceHeader);
    if (!existing || match.confidence > existing.confidence) {
      seen.set(match.sourceHeader, match);
    }
  }
  return Array.from(seen.values());
}
function applySynonymMapping(matches, synonymMapping) {
  if (Object.keys(synonymMapping).length === 0) return matches;
  return matches.map((match) => {
    const normalizedSource = normalizeHeader(match.sourceHeader);
    for (const [canonical, synonyms] of Object.entries(synonymMapping)) {
      const normalizedSynonyms = synonyms.map((s) => normalizeHeader(s));
      if (normalizedSynonyms.includes(normalizedSource)) {
        return {
          ...match,
          suggestedTarget: canonical,
          confidence: match.confidence * 0.95
          // 同义词匹配降低一点置信度
        };
      }
    }
    return match;
  });
}
function generateSuggestedMappings(matched, sourceHeaders, targetHeaders) {
  const matchedSource = new Set(matched.map((m) => m.sourceHeader));
  const matchedTarget = new Set(matched.map((m) => m.suggestedTarget));
  const suggestions = [...matched];
  for (const source of sourceHeaders) {
    if (!matchedSource.has(source)) {
      suggestions.push({
        sourceHeader: source,
        suggestedTarget: "",
        confidence: 0
      });
    }
  }
  for (const target of targetHeaders) {
    if (!matchedTarget.has(target)) {
      suggestions.push({
        sourceHeader: "",
        suggestedTarget: target,
        confidence: 0
      });
    }
  }
  return suggestions;
}
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
    throw new Error("文件为空");
  }
  const headerRowCount = detectHeaderRows(aoa);
  const sourceHeaders = buildHeaders(aoa, headerRowCount);
  const targetHeaders = expectedHeaders && expectedHeaders.length > 0 ? expectedHeaders : sourceHeaders;
  const matchResult = analyzeColumnMatching(
    sourceHeaders,
    targetHeaders,
    defaultMatchConfig
  );
  return matchResult;
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
async function saveFile(defaultFileName) {
  const result = await electron.dialog.showSaveDialog({
    title: "保存导出文件",
    defaultPath: defaultFileName ?? "output.xlsx",
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
const DEFAULT_GANGLIU_HEADERS = [
  "距坝里程",
  "断面号",
  "天然深泓",
  "多年平均水面线",
  "0.05_天然水面线",
  "0.05_3198",
  "0.05_3200",
  "0.05_3202",
  "0.2_天然水面线",
  "0.2_3198",
  "0.2_3200",
  "0.2_3202"
];
const DEFAULT_ZHILIU_HEADERS = [
  "距坝里程",
  "断面号",
  "天然深泓",
  "多年平均水面线",
  "0.05_天然水面线",
  "0.05_3202",
  "0.05_3198",
  "0.05_3200",
  "0.2_天然水面线",
  "0.2_3198",
  "0.2_3200",
  "0.2_3202"
];
const DEFAULT_SHEET_HEADERS = {
  "干流": DEFAULT_GANGLIU_HEADERS,
  "支流": DEFAULT_ZHILIU_HEADERS
};
const DEFAULT_EXPECTED_HEADERS = DEFAULT_GANGLIU_HEADERS;
const store = new Store({
  name: "excel-processor-config",
  defaults: {
    sheetHeaders: DEFAULT_SHEET_HEADERS,
    expectedHeaders: DEFAULT_EXPECTED_HEADERS
  }
});
function getExpectedHeaders(sheetName) {
  if (sheetName) {
    const sheetHeaders = store.get("sheetHeaders", DEFAULT_SHEET_HEADERS);
    if (sheetHeaders[sheetName]) {
      return sheetHeaders[sheetName];
    }
  }
  return store.get("expectedHeaders", DEFAULT_EXPECTED_HEADERS);
}
function hasSheetConfig(sheetName) {
  const sheetHeaders = store.get("sheetHeaders", DEFAULT_SHEET_HEADERS);
  return sheetName in sheetHeaders;
}
function setExpectedHeaders(headers, sheetName) {
  if (!Array.isArray(headers)) {
    throw new Error("期望列名必须是数组");
  }
  const validHeaders = headers.filter((h) => h && typeof h === "string" && h.trim() !== "");
  if (sheetName) {
    const sheetHeaders = store.get("sheetHeaders", DEFAULT_SHEET_HEADERS);
    sheetHeaders[sheetName] = validHeaders;
    store.set("sheetHeaders", sheetHeaders);
  } else {
    store.set("expectedHeaders", validHeaders);
  }
}
function resetExpectedHeaders() {
  store.set("sheetHeaders", DEFAULT_SHEET_HEADERS);
  store.set("expectedHeaders", DEFAULT_EXPECTED_HEADERS);
}
function getDefaultExpectedHeaders() {
  return [...DEFAULT_EXPECTED_HEADERS];
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
  electron.ipcMain.handle("file:readSheetWithMatchCheck", (_event, filePath, sheetName, expectedHeaders) => readSheetWithMatchCheck(filePath, sheetName, expectedHeaders));
  electron.ipcMain.handle(
    "file:saveMappingTemplate",
    (_event, template) => saveMappingTemplate()
  );
  electron.ipcMain.handle("file:loadMappingTemplates", () => loadMappingTemplates());
  electron.ipcMain.handle(
    "file:applyMappingTemplate",
    (_event, sourceHeaders, templateId) => applyMappingTemplate()
  );
  electron.ipcMain.handle("config:getExpectedHeaders", (_event, sheetName) => getExpectedHeaders(sheetName));
  electron.ipcMain.handle("config:hasSheetConfig", (_event, sheetName) => hasSheetConfig(sheetName));
  electron.ipcMain.handle(
    "config:setExpectedHeaders",
    (_event, headers, sheetName) => setExpectedHeaders(headers, sheetName)
  );
  electron.ipcMain.handle("config:resetExpectedHeaders", () => resetExpectedHeaders());
  electron.ipcMain.handle("config:getDefaultExpectedHeaders", () => getDefaultExpectedHeaders());
  electron.ipcMain.handle("export:saveFile", (_event, defaultFileName) => saveFile(defaultFileName));
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
