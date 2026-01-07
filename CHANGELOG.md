# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Phase 2] - 2026-01-07

### Added

- **Flat Indexing**: Implementation of `folderMap` and `itemMap` for O(1) folder tree traversal.
- **Lazy Loading**: Integrated Electron IPC `list-directory` for on-demand file scanning.
- **Virtual Scroll**: Refactored `MediaFileList.vue` using Vuetify `VVirtualScroll` with responsive row chunking.
- **fs-extra**: Transitioned Electron backend to `fs-extra` for improved file operation stability.

## [Unreleased]

### Added

- **Media Optimization (Phase 1)**:
  - 實作 `FileSystemProvider` 抽象層，將檔案操作與儲存實現解耦。
  - 新增 `FileSystemProviderFactory` 與 `LocalProvider`。
  - 引入 `ItemPermissions` 權限系統，支援來源導向的 UI 控制。
  - 將檔案上傳與複製邏輯從組件整合至 `useFolderStore`。
- **Media**: 新增建立資料夾時的預設名稱功能。
- **Media**: 新增副本 (Copy) 功能，並實作 Electron `copy-file` IPC 方法。

### Changed

- **Media**: 優化拖拽 (Drag and Drop) 的樣式與實作方式。
- **Media**: 優化選擇框 (Selection Box) 背景透明度。
- **Media**: 點擊投影片檔案時自動清除目前的選取狀態。
- **Media**: 右鍵選單點擊項目後自動關閉。

### Fixed

- **Locale**: 修復媒體介面的多語系翻譯問題。
- **Locale**: 修復右鍵選單編輯模式下的語系錯誤。

---

## [1.3.5] - 2026-01-05

### Fixed

- **System**: 修復 Windows 環境下 `userData` 路徑讀取問題。
- **System**: 實作檔案刪除功能。

## [1.3.4] - 2026-01-02

### Added

- **Bible**: 整合 `FlexSearch` 全文檢索引擎，大幅提升聖經搜索效能。
- **Bible**: 新增 `useFlexSearch` composable 並移除舊有的 Electron 搜索方式。
- **UI**: 將版本選擇與載入邏輯移動至 `GlobalOverlays` 以優化啟動速度。

### Fixed

- **Build**: 修復 Vite 編譯時 Web Worker 的路徑配對問題。
- **Locale**: 修復投影視窗的多語系顯示異常。
