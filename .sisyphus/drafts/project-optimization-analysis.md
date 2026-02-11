# Draft: HHC Client 專案結構與程式碼優化分析

## 分析來源

- Agent 1: 元件目錄結構分析 (4m 11s)
- Agent 2: 依賴與複用分析 (5m 57s)
- Agent 3: 效能與可擴展性分析 (3m 56s)

---

## 一、元件目錄結構 — 發現與問題

### 當前結構概覽

```
src/components/
├── ContextMenu.vue          ← 根層級，未分類
├── ExtendedToolbar.vue      ← 根層級，未分類
├── GlobalOverlays.vue       ← 根層級，未分類
├── Alert/                   (2 components, has index.ts)
├── Bible/                   (8 components, has index.ts)
│   ├── Selector/            (2 components, has index.ts)
│   └── MultiFunction/       (3 components, has index.ts)
├── LiquidGlass/             (12 UI primitives, has index.ts + plugin.ts)
│   ├── composables/         (3 files)
│   ├── constants/           (2 files + index.ts)
│   ├── styles/              (4 SCSS + theme/)
│   └── [12 component folders, each with index.ts]
├── Main/                    (5 components, has index.ts)
├── Media/                   (12 components, has index.ts)
│   └── Preview/             (5 components, NO index.ts) ← 缺少 barrel
├── Shared/                  (4 components, has index.ts)
├── Shortcuts/               (2 components, has index.ts)
├── Timer/                   (9 components, NO index.ts) ← 缺少 barrel
└── Updater/                 (1 component, has index.ts)
```

### 問題 1: 根層級元件未分類

- `ContextMenu.vue` — 被 Bible、Media、MultiFunction 使用，屬於共用元件
- `ExtendedToolbar.vue` — 應用層級工具列
- `GlobalOverlays.vue` — 全域覆蓋層聚合器

### 問題 2: 缺少 barrel exports

- `Timer/` — 無 index.ts（9 個元件）
- `Media/Preview/` — 無 index.ts（5 個元件）

### 問題 3: 分類邊界不清

- `Shared/` 只有 4 個 folder-related 對話框，但 ContextMenu 這種更通用的元件反而在根層級
- `Main/` 混合了對話框（AboutDialog, SettingsDialog）和 UI 元素（BottomSpacer）

---

## 二、依賴與複用 — 發現與問題

### 高複用元件（核心穩定區）

| 元件           | 使用次數 | 使用者                                                                   |
| -------------- | -------- | ------------------------------------------------------------------------ |
| LiquidIcon     | 6+       | LiquidBtn, LiquidChip, LiquidTextField, LiquidSearchBar, LiquidBtnToggle |
| ContextMenu    | 4+       | BiblePreview, MediaToolbar, MultiFunction/Control                        |
| MediaThumbnail | 3+       | MediaItem, PresenterSidebar, PresenterGrid                               |

### Hub 元件（高耦合風險區）

| 元件           | 依賴數量                        | 風險                   |
| -------------- | ------------------------------- | ---------------------- |
| MediaPresenter | 5 子元件 + 5 stores/composables | 修改影響範圍大         |
| GlobalOverlays | 8 個全域對話框                  | 容易成為 god component |

### 單一使用元件（可能可以內聯）

- `FFmpegInstallGuideDialog` — 只被 SettingsDialog 引用
- `UpdateNotification` — 只被 GlobalOverlays 引用

### Composable 使用分析

| Composable           | 使用數                | 行數 | 狀態                         |
| -------------------- | --------------------- | ---- | ---------------------------- |
| useSentry            | 31 files (82 matches) | 61L  | ✅ 小且穩定                  |
| useProjectionManager | 13 files (28 matches) | 292L | ⚠️ 中大型，核心              |
| useMediaOperations   | 多檔案                | 396L | ⚠️ 大型，組合多個 composable |
| useIndexedDB         | 多檔案                | 395L | ⚠️ 大型，通用 DB 包裝        |
| useFileSystem        | 多檔案                | 388L | ⚠️ 大型，檔案系統抽象        |
| useMediaUpload       | 多檔案                | 279L | ⚠️ 中型                      |
| useFolderManager     | stores                | 227L | ✅ 專注樹操作                |

### 重複程式碼

- `VIDEO_EXTENSIONS` / `NON_NATIVE_VIDEO_EXTENSIONS` 定義在兩個地方：
  - `useMediaUpload.ts:17-28`
  - `useMediaProcessing.ts:6-11`

### Store 依賴鏈

- `timer.ts` → imports `stopwatch.ts`（可接受的緊密關聯）
- `useProjectionManager` → imports 5 個 stores（projection, mediaProjection, bibleProjection, timerProjection, timer）— 設計上的協調層
- `folder.ts` 有 38 個 `as any` 用於 Vue reactivity 解決方案

---

## 三、效能與可擴展性 — 發現與問題

### 路由配置

- HomeView **急切載入**（非 lazy）
- ProjectionView 已 lazy-loaded ✅
- HomeView 內部已用 defineAsyncComponent 載入控制佈局 ✅

### Bundle 分析

- Vite manualChunks 已設定：vue-vendor, vuetify-vendor, utils-vendor, sentry-vendor
- **pdfjs-dist 急切載入** — PdfService.ts 頂層 `import * as pdfjsLib from 'pdfjs-dist'`（重度 bundle 影響）
- flexsearch 在 Worker 中（✅ 正確隔離）
- 4 個 @fontsource 字型在 main.ts 急切載入

### 大型 Vue 檔案 (>300 行)

| 檔案                      | 行數 | 類型                   |
| ------------------------- | ---- | ---------------------- |
| BiblePreview.vue          | 495L | Feature                |
| SettingsDialog.vue        | 491L | Dialog                 |
| MultiFunction/Control.vue | 448L | Feature                |
| LiquidBtn.vue             | 446L | UI Primitive           |
| MediaControl.vue          | 443L | Layout                 |
| BooksDialog.vue           | 440L | Dialog                 |
| PdfViewer.vue             | 423L | Feature (heavy canvas) |
| MediaItemList.vue         | 400L | Feature                |
| MediaPresenter.vue        | 369L | Feature                |
| MediaPlayer.vue           | 368L | Preview                |
| MediaProjection.vue       | 367L | Layout                 |
| MediaVideoControls.vue    | 325L | Controls               |
| LiquidSearchBar.vue       | 316L | UI Primitive           |
| LiquidChip.vue            | 301L | UI Primitive           |

### 大型 TS 檔案 (>200 行)

| 檔案                         | 行數 | 類型       |
| ---------------------------- | ---- | ---------- |
| folder.ts (store)            | 823L | Store      |
| bible.ts (store)             | 819L | Store      |
| timer.ts (store)             | 546L | Store      |
| common.ts (types)            | 526L | Types      |
| useVideoPlayer.ts            | 398L | Composable |
| useMediaOperations.ts        | 396L | Composable |
| useIndexedDB.ts              | 395L | Composable |
| useFileSystem.ts             | 388L | Composable |
| useFlexSearch.ts             | 319L | Composable |
| apply.ts (theme)             | 282L | Utility    |
| PdfService.ts                | 278L | Service    |
| useMediaUpload.ts            | 279L | Composable |
| LocalProvider.ts             | 242L | Provider   |
| FileSystemProviderFactory.ts | 218L | Factory    |

### 服務層

- PdfService — 良好的抽象（快取、取消渲染、縮圖）
- FileSystem Provider Factory — 可擴展的 Provider 模式
- 但 PdfService 需要改為動態 import

---

## 四、綜合評估 — 優化方向

### A. 元件結構重組（中等優先）

- 移動根層級元件到適當分類
- 補充缺少的 barrel exports
- 考慮是否需要更細粒度的子分類

### B. 重複程式碼消除（低風險高價值）

- 提取共用常數（VIDEO_EXTENSIONS）
- 統一定義位置

### C. 效能優化（高影響）

- pdfjs-dist 動態載入
- 字型延遲載入
- HomeView lazy loading

### D. 大型檔案拆分（長期維護性）

- 14 個 Vue 檔案 > 300 行
- 14 個 TS 檔案 > 200 行
- types/common.ts 526 行可按域拆分

### E. 可擴展性改進（未來功能基礎）

- 服務層已有良好模式，可繼續擴展
- Composable 組合模式清晰
- Store 需要更好的邊界定義

---

## 用戶決策（已確認）

1. **優化範圍**：全部 10 項都做
2. **根層級元件歸類**：依功能歸類
   - ContextMenu → Shared/
   - ExtendedToolbar → Main/
   - GlobalOverlays → Main/
3. **types 拆分策略**：按功能域拆分
   - types/timer.ts, types/bible.ts, types/media.ts, types/folder.ts, types/projection.ts + types/common.ts（共用）
4. **大型元件拆分順序**：按影響排序
   - 優先：PdfViewer（canvas）→ SettingsDialog（最大）→ MediaPresenter（最多依賴）
5. **測試策略**：重構搭配測試
   - 每次拆分都加上對應的 unit test 確保行為不變
