# Excel Processor

基于 Electron + React + TypeScript 的 Excel 数据处理桌面应用。

## 环境要求

- Node.js >= 18
- npm >= 9

## 安装依赖

```bash
npm install
```

## 开发

启动开发模式（热更新）：

```bash
npm run dev
```

运行单元测试：

```bash
npm run test
```

## 打包

### 第一步：编译构建

```bash
npm run build
```

### 第二步：打包为安装包

```bash
npm run dist
```

打包产物输出在 `release/` 目录，Windows 下会生成 `.exe` 安装程序（NSIS 格式，x64）。

也可以一步完成构建 + 打包：

```bash
npm run dist
```

> `dist` 脚本内部已包含 `npm run build`，无需单独执行。

## 目录结构

```
src/
  main/       # Electron 主进程
  preload/    # 预加载脚本
  renderer/   # React 渲染进程
  shared/     # 主进程与渲染进程共享的逻辑和类型
```
