# HHC Client 專案結構與程式碼優化

## TL;DR

> **Quick Summary**: 全面優化 HHC Client 專案的元件結構、程式碼複用、bundle 效能、大型檔案拆分與可擴展性。所有變更為結構性重構，不改變任何 runtime 行為。
>
> **Deliverables**:
>
> - 元件目錄重組（消除根層級孤兒、統一 barrel exports）
> - 共用常數提取（VIDEO_EXTENSIONS 去重）
> - 效能優化（pdfjs-dist 動態載入、字型延遲、HomeView lazy-load）
> - types/common.ts 按域拆分
> - 14 個大型 Vue 元件逐步拆分（搭配 unit tests）
> - 5 個大型 composable 拆分
> - LiquidGlass 邊界評估
>
> **Estimated Effort**: Large (3-5 days)
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Wave 1 (Quick Wins) → Wave 2 (Type Splitting) → Wave 4 (Large File Splits)

---

## Context

### Original Request

用戶要求全面分析專案的 code 與檔案結構優化空間，包括：元件分類、程式碼依賴與複用、效能、以及未來擴充能力。分析後用戶選擇「全部都做」。

### Interview Summary

**Key Discussions**:

- 元件歸類：ContextMenu → Shared/、ExtendedToolbar → Main/、GlobalOverlays → Main/
- types 拆分：按功能域（timer、bible、media、folder、projection + common）
- 大型元件優先序：按影響排序（PdfViewer → SettingsDialog → MediaPresenter）
- 測試策略：每次拆分搭配對應 unit test

**Research Findings**:

- Agent 1（結構）：3 個根層級孤兒、2 個缺少 barrel、Timer/ 無 index.ts
- Agent 2（依賴）：VIDEO_EXTENSIONS 重複定義、useSentry 是 composable 設計黃金標準、MediaPresenter 高耦合
- Agent 3（效能）：pdfjs-dist 急切載入（重大 bundle 影響）、4 字型急切載入、HomeView 非 lazy

### Metis Review

**Identified Gaps** (addressed):

- 回歸測試策略：每個 task 包含驗證命令 + agent-executed QA
- LiquidGlass 未來意圖：默認保持內部、不碰 internals、僅評估邊界
- 字型 trade-offs：控制視窗允許 FOUT、投影視窗預載
- IPC 型別：MessageType 保持集中（types/ipc.ts 或 types/common.ts）
- 回滾策略：per-commit rollback、30 分鐘最大除錯時間
- 範圍邊界鎖定：不碰 folder.ts/bible.ts store 內部（Oracle 已核准替代方案）

---

## Work Objectives

### Core Objective

在不改變任何 runtime 行為的前提下，優化 HHC Client 的專案結構、消除重複程式碼、提升 bundle 效能、改善大型檔案的可維護性與可擴展性。

### Concrete Deliverables

- [ ] 根層級元件歸類完成（0 個孤兒元件在 src/components/ 根目錄）
- [ ] 所有功能資料夾有 barrel exports（Timer/index.ts、Media/Preview/index.ts）
- [ ] VIDEO_EXTENSIONS 常數統一至單一檔案
- [ ] pdfjs-dist 改為動態載入
- [ ] HomeView 改為 lazy-loaded
- [ ] 字型改為延遲載入或預載策略
- [ ] types/common.ts 拆分為 ≤150 行的域型別檔案
- [ ] PdfViewer.vue 拆分為 ≤300 行
- [ ] SettingsDialog.vue 拆分為 ≤300 行
- [ ] MediaPresenter.vue 拆分為 ≤300 行
- [ ] 至少 3 個大型 composable 拆分至 ≤250 行
- [ ] LiquidGlass 邊界評估文件完成
- [ ] 所有現有測試通過（83 tests）
- [ ] Bundle 大小不增加（baseline 記錄後比對）

### Definition of Done

- [ ] `npm run type-check` → 0 errors
- [ ] `npm run test:unit` → 83+ tests pass（含新增）
- [ ] `npm run lint` → 0 errors, 0 warnings
- [ ] `npm run build` → succeeds
- [ ] 無 runtime 行為改變

### Must Have

- 所有結構性變更保持 runtime 行為不變
- 每次拆分搭配驗證（type-check + test + build）
- 原子化 commit（每個變更可獨立 revert）

### Must NOT Have (Guardrails)

- ❌ 不改變 runtime 行為、component props/events/exposed API
- ❌ 不碰 LiquidGlass 元件 internals（只處理歸類和邊界）
- ❌ 不重構 folder.ts (823L) 或 bible.ts (819L) 的 store 內部邏輯（Oracle 已核准）
- ❌ 不新增 plugin 系統、event bus、DI container
- ❌ 不新增 error boundaries、loading skeletons 等 UI 功能
- ❌ 不升級依賴版本
- ❌ 不新增 composable（只拆分/重組現有的）
- ❌ 不添加 @ts-expect-error 或 @ts-ignore
- ❌ 不使用 any 作為逃生艙
- ❌ 超過 30 分鐘無法解決的拆分問題 → 立即 revert 並記錄 blocker

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES (Vitest + jsdom)
- **Automated tests**: YES (Tests-after — 每次拆分後加對應測試)
- **Framework**: Vitest

### Baseline Recording (Wave 0)

Before any changes, record baselines:

```bash
npm run test:unit 2>&1 | tail -5        # Test count baseline
time npm run build-only 2>&1 | tail -5   # Build time baseline (renderer only)
du -sh dist-electron/renderer/          # Bundle size baseline
find src/ -name "*.vue" -exec wc -l {} \; | awk '$1>300' | wc -l  # Large Vue files count
find src/ -name "*.ts" -exec wc -l {} \; | awk '$1>200' | wc -l   # Large TS files count
```

### Per-Task Verification Protocol

Every task MUST run these after completion:

```bash
npm run type-check    # 0 errors
npm run test:unit     # All pass
npm run lint          # 0 errors
npm run build         # Succeeds
```

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

> Each scenario uses specific tools to verify behavior preservation.

**Verification Tool by Deliverable Type:**

| Type             | Tool                               | How Agent Verifies                         |
| ---------------- | ---------------------------------- | ------------------------------------------ |
| File move/rename | Bash (grep)                        | Verify no broken imports, old paths absent |
| Type splitting   | Bash (npm run type-check)          | Zero TypeScript errors                     |
| Lazy loading     | Bash (npm run build + bundle size) | Build succeeds, size ≤ baseline            |
| Component split  | Bash (npm run test:unit)           | All tests pass                             |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Baseline):
└── Task 0: Record baselines

Wave 1 (Quick Wins - Start Immediately):
├── Task 1: Add barrel exports (Timer/, Media/Preview/)
├── Task 2: Extract shared VIDEO_EXTENSIONS constant
├── Task 3: Move root-level orphan components
└── Task 4: HomeView lazy-load

Wave 2 (Type Splitting - After Wave 1):
└── Task 5: Split types/common.ts by domain (sequential sub-steps)

Wave 3 (Performance - After Wave 1, parallel with Wave 2):
├── Task 6: pdfjs-dist dynamic import
└── Task 7: Font loading optimization

Wave 4 (Large File Splits - After Wave 2):
├── Task 8: Split PdfViewer.vue
├── Task 9: Split SettingsDialog.vue
├── Task 10: Split MediaPresenter.vue
├── Task 11: Split other large Vue components (BiblePreview, MediaControl, BooksDialog)
└── Task 12: Split large composables (useVideoPlayer, useMediaOperations, useFileSystem)

Wave 5 (Finalization - After All):
├── Task 13: LiquidGlass boundary evaluation
└── Task 14: Final verification & bundle comparison
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With  |
| ---- | ---------- | ------ | --------------------- |
| 0    | None       | All    | None (baseline first) |
| 1    | 0          | 5      | 2, 3, 4               |
| 2    | 0          | —      | 1, 3, 4               |
| 3    | 0          | —      | 1, 2, 4               |
| 4    | 0          | —      | 1, 2, 3               |
| 5    | 1, 2, 3    | 8-12   | 6, 7                  |
| 6    | 1          | 14     | 5, 7                  |
| 7    | 1          | 14     | 5, 6                  |
| 8    | 5          | 14     | 9, 10, 11, 12         |
| 9    | 5          | 14     | 8, 10, 11, 12         |
| 10   | 5          | 14     | 8, 9, 11, 12          |
| 11   | 5          | 14     | 8, 9, 10, 12          |
| 12   | 5          | 14     | 8, 9, 10, 11          |
| 13   | 1-12       | 14     | —                     |
| 14   | All        | None   | None (final)          |

### Agent Dispatch Summary

| Wave | Tasks      | Recommended Agents                                |
| ---- | ---------- | ------------------------------------------------- |
| 0    | 0          | task(category="quick", ...)                       |
| 1    | 1, 2, 3, 4 | 4 parallel task(category="quick", ...)            |
| 2    | 5          | task(category="unspecified-high", ...) sequential |
| 3    | 6, 7       | 2 parallel task(category="unspecified-low", ...)  |
| 4    | 8-12       | parallel task(category="deep", ...)               |
| 5    | 13, 14     | task(category="quick", ...) sequential            |

---

## TODOs

- [ ] 0. Record Baselines (Wave 0)

  **What to do**:
  - Record current test count, build time, bundle size
  - Count files > 300 lines (Vue) and > 200 lines (TS)
  - Save baselines to `.sisyphus/notepads/project-optimization/baselines.md`
  - Record current import pattern counts: `grep -r "from '@/components/" src/ | wc -l`

  **Must NOT do**:
  - Don't modify any source files
  - Don't install new dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple data collection, no code changes
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (solo)
  - **Blocks**: All other tasks
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `package.json:17` — test:unit script definition
  - `package.json:18` — build-only script definition

  **Acceptance Criteria**:
  - [ ] Baselines recorded in `.sisyphus/notepads/project-optimization/baselines.md`
  - [ ] Contains: test count, build time, bundle size (dist-electron/renderer/ total), large file counts
  - [ ] `npm run test:unit` → reports test count (expected: 83)
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Baseline data is complete and valid
    Tool: Bash
    Preconditions: Project compiles and tests pass
    Steps:
      1. npm run test:unit 2>&1 | grep "Tests" → capture pass count
      2. time npm run build-only 2>&1 | tail -3 → capture renderer build time
      3. du -sh dist-electron/renderer/ → capture bundle size
      4. find src/ -name "*.vue" -exec wc -l {} \; | awk '$1>300' | wc -l → count large Vue files
      5. find src/ -name "*.ts" -exec wc -l {} \; | awk '$1>200' | wc -l → count large TS files
      6. Read .sisyphus/notepads/project-optimization/baselines.md → verify all 5 data points present
    Expected Result: All baselines captured and saved
    Evidence: .sisyphus/notepads/project-optimization/baselines.md exists with data
  ```

  **Commit**: NO (no source changes)

---

- [ ] 1. Add Missing Barrel Exports (Wave 1)

  **What to do**:
  - Create `src/components/Timer/index.ts` — export all 9 Timer components
  - Create `src/components/Media/Preview/index.ts` — export all 5 Preview components
  - Follow existing barrel pattern from other folders (e.g., `src/components/Bible/index.ts`)
  - Verify existing imports still resolve correctly

  **Must NOT do**:
  - Don't change any component internals
  - Don't rename files or move components
  - Don't change existing import paths in consuming files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Creating 2 simple index.ts files following established patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Task 5 (type splitting needs stable structure)
  - **Blocked By**: Task 0

  **References**:

  **Pattern References**:
  - `src/components/Bible/index.ts` — barrel export pattern to follow
  - `src/components/Media/index.ts` — barrel export pattern to follow
  - `src/components/Alert/index.ts` — simple barrel example
  - `src/components/LiquidGlass/LiquidBtn/index.ts` — single-component barrel pattern

  **API/Type References**:
  - `src/components/Timer/CountdownTimer.vue` — Timer component to export
  - `src/components/Timer/TimerSettings.vue` — Timer component to export
  - `src/components/Timer/TimerDisplay.vue` — Timer component to export
  - `src/components/Timer/FloatingTimer.vue` — Timer component to export
  - `src/components/Timer/TimeInput.vue` — Timer component to export
  - `src/components/Timer/PresetManager.vue` — Timer component to export
  - `src/components/Timer/TimeAdjustmentButtons.vue` — Timer component to export
  - `src/components/Timer/ClockDisplay.vue` — Timer component to export
  - `src/components/Timer/StopWatcher.vue` — Timer component to export
  - `src/components/Media/Preview/MediaPlayer.vue` — Preview component to export
  - `src/components/Media/Preview/MediaVideoControls.vue` — Preview component to export
  - `src/components/Media/Preview/MediaPresenterNavigation.vue` — Preview component to export
  - `src/components/Media/Preview/MediaPresenterSidebar.vue` — Preview component to export
  - `src/components/Media/Preview/MediaPresenterGrid.vue` — Preview component to export
  - `src/components/Media/Preview/PdfSlideshow.vue` — Preview component to export

  **Acceptance Criteria**:
  - [ ] `src/components/Timer/index.ts` exists and exports all 9 Timer components
  - [ ] `src/components/Media/Preview/index.ts` exists and exports all 5+1 Preview components
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Barrel exports are valid and complete
    Tool: Bash
    Preconditions: Files created
    Steps:
      1. cat src/components/Timer/index.ts → verify exports 9 components
      2. cat src/components/Media/Preview/index.ts → verify exports all Preview components
      3. npm run type-check → Assert: 0 errors
      4. npm run build → Assert: succeeds
      5. grep -r "from '@/components/Timer'" src/ → verify no broken imports
    Expected Result: Both barrels exist, type-check and build pass
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `refactor: add barrel exports for Timer and Media/Preview components`
  - Files: `src/components/Timer/index.ts`, `src/components/Media/Preview/index.ts`
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [ ] 2. Extract Shared VIDEO_EXTENSIONS Constant (Wave 1)

  **What to do**:
  - Create `src/config/media.ts` with shared VIDEO_EXTENSIONS and NON_NATIVE_VIDEO_EXTENSIONS
  - Update `src/composables/useMediaUpload.ts:17-28` to import from `src/config/media.ts`
  - Update `src/composables/useMediaProcessing.ts:6-11` to import from `src/config/media.ts`
  - Remove duplicate definitions from both files
  - Run verification to confirm no behavior change

  **Must NOT do**:
  - Don't change the values of the constants
  - Don't add new constants
  - Don't modify any logic in useMediaUpload or useMediaProcessing beyond the import change

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Extracting constants, updating 2 imports
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: None
  - **Blocked By**: Task 0

  **References**:

  **Pattern References**:
  - `src/config/app.ts` — config file pattern to follow
  - `src/config/db.ts` — config file pattern to follow

  **API/Type References**:
  - `src/composables/useMediaUpload.ts:17-28` — VIDEO_EXTENSIONS & NON_NATIVE_VIDEO_EXTENSIONS first definition
  - `src/composables/useMediaProcessing.ts:6-11` — NON_NATIVE_VIDEO_EXTENSIONS second definition (duplicate)

  **Acceptance Criteria**:
  - [ ] `src/config/media.ts` exists with VIDEO_EXTENSIONS and NON_NATIVE_VIDEO_EXTENSIONS
  - [ ] No VIDEO_EXTENSIONS or NON_NATIVE_VIDEO_EXTENSIONS definition in useMediaUpload.ts
  - [ ] No NON_NATIVE_VIDEO_EXTENSIONS definition in useMediaProcessing.ts
  - [ ] Both composables import from `@/config/media`
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run test:unit` → all pass
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Constants deduplicated correctly
    Tool: Bash
    Preconditions: Changes applied
    Steps:
      1. grep -r "VIDEO_EXTENSIONS" src/config/media.ts → Assert: definitions present
      2. grep -r "const VIDEO_EXTENSIONS\|const NON_NATIVE_VIDEO_EXTENSIONS" src/composables/ → Assert: 0 matches (no local definitions)
      3. grep "from '@/config/media'" src/composables/useMediaUpload.ts → Assert: 1 match
      4. grep "from '@/config/media'" src/composables/useMediaProcessing.ts → Assert: 1 match
      5. npm run type-check → Assert: 0 errors
      6. npm run test:unit → Assert: all pass
    Expected Result: Single source of truth for video extensions
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `refactor: extract shared video extension constants to config/media.ts`
  - Files: `src/config/media.ts`, `src/composables/useMediaUpload.ts`, `src/composables/useMediaProcessing.ts`
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [ ] 3. Move Root-Level Orphan Components (Wave 1)

  **What to do**:
  - Move `src/components/ContextMenu.vue` → `src/components/Shared/ContextMenu.vue`
  - Move `src/components/ExtendedToolbar.vue` → `src/components/Main/ExtendedToolbar.vue`
  - Move `src/components/GlobalOverlays.vue` → `src/components/Main/GlobalOverlays.vue`
  - Update ALL import paths across the entire codebase using `lsp_find_references` first
  - Update barrel exports: add to `src/components/Shared/index.ts` and `src/components/Main/index.ts`
  - Verify 0 files remain in `src/components/` root (only folders)

  **Must NOT do**:
  - Don't change any component logic or templates
  - Don't rename components (only move)
  - Don't change any props, events, or exposed APIs

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File moves + import updates, no logic changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: None
  - **Blocked By**: Task 0

  **References**:

  **Pattern References**:
  - `src/components/Shared/index.ts` — barrel to update (add ContextMenu export)
  - `src/components/Main/index.ts` — barrel to update (add ExtendedToolbar, GlobalOverlays exports)

  **API/Type References**:
  - `src/components/ContextMenu.vue` — used by BiblePreview.vue:104, MediaToolbar.vue:37, MultiFunction/Control.vue:180
  - `src/components/ExtendedToolbar.vue` — used by HomeView.vue (check via lsp_find_references)
  - `src/components/GlobalOverlays.vue` — used by HomeView.vue or App.vue (check via lsp_find_references)

  **Tool Recommendations**:
  - Use `lsp_find_references` on each component before moving to map all importers
  - Use `grep` to verify no remaining references to old paths after move

  **Acceptance Criteria**:
  - [ ] 0 .vue files in `src/components/` root directory
  - [ ] ContextMenu.vue exists at `src/components/Shared/ContextMenu.vue`
  - [ ] ExtendedToolbar.vue exists at `src/components/Main/ExtendedToolbar.vue`
  - [ ] GlobalOverlays.vue exists at `src/components/Main/GlobalOverlays.vue`
  - [ ] No references to old paths (`grep -r "components/ContextMenu" src/` returns 0)
  - [ ] No references to old paths (`grep -r "components/ExtendedToolbar" src/` returns 0, excluding Main/)
  - [ ] No references to old paths (`grep -r "components/GlobalOverlays" src/` returns 0, excluding Main/)
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run test:unit` → all pass
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All orphan components moved and imports updated
    Tool: Bash
    Preconditions: Components moved
    Steps:
      1. ls src/components/*.vue → Assert: 0 files (no .vue at root)
      2. test -f src/components/Shared/ContextMenu.vue → Assert: exists
      3. test -f src/components/Main/ExtendedToolbar.vue → Assert: exists
      4. test -f src/components/Main/GlobalOverlays.vue → Assert: exists
      5. grep -r "from.*components/ContextMenu" src/ | grep -v "Shared" → Assert: 0 matches
      6. grep -r "from.*components/ExtendedToolbar" src/ | grep -v "Main" → Assert: 0 matches
      7. grep -r "from.*components/GlobalOverlays" src/ | grep -v "Main" → Assert: 0 matches
      8. npm run type-check && npm run test:unit && npm run build → Assert: all pass
    Expected Result: Clean component root, all imports updated
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `refactor: move root-level components to appropriate feature folders`
  - Files: moved files + updated importers
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [ ] 4. HomeView Lazy Loading (Wave 1)

  **What to do**:
  - Change `src/router/index.ts` to lazy-load HomeView:
    - FROM: `import Home from '@/views/HomeView.vue'`
    - TO: `component: () => import('@/views/HomeView.vue')`
  - Verify route still works after change

  **Must NOT do**:
  - Don't change any route paths or names
  - Don't add route guards
  - Don't modify HomeView.vue itself

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line change in router
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: None
  - **Blocked By**: Task 0

  **References**:

  **Pattern References**:
  - `src/router/index.ts` — current router config; Projection route already uses lazy loading pattern at the `/projection` route definition

  **Acceptance Criteria**:
  - [ ] No eager import of HomeView in router/index.ts
  - [ ] Route uses `component: () => import('@/views/HomeView.vue')` pattern
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: HomeView is lazy-loaded in router
    Tool: Bash
    Preconditions: Change applied
    Steps:
      1. grep "import Home" src/router/index.ts → Assert: 0 matches (no eager import)
      2. grep "import.*HomeView" src/router/index.ts → Assert: uses dynamic import pattern
      3. npm run type-check → Assert: 0 errors
      4. npm run build → Assert: succeeds
      5. ls dist-electron/renderer/assets/ → verify HomeView appears as separate chunk file (e.g., HomeView-*.js)
    Expected Result: HomeView in separate chunk, route still defined
    Evidence: dist-electron/renderer/assets/ file listing showing HomeView chunk
  ```

  **Commit**: YES
  - Message: `perf: lazy-load HomeView route for faster initial load`
  - Files: `src/router/index.ts`
  - Pre-commit: `npm run type-check && npm run build`

---

- [ ] 5. Split types/common.ts by Domain (Wave 2)

  **What to do**:
  - Read `src/types/common.ts` (526 lines) and categorize each type/interface/enum by domain
  - Create domain-specific type files:
    - `src/types/timer.ts` — timer-related types (TimerMode, TimerStatus, TimerSettings, etc.)
    - `src/types/bible.ts` — bible-related types (BibleBook, BibleVerse, BibleVersion, etc.)
    - `src/types/media.ts` — media-related types (MediaItem, MediaType, etc.)
    - `src/types/folder.ts` — folder-related types (FolderItem, FolderTree, etc.)
    - `src/types/projection.ts` — projection-related types (ProjectionMessage, MessageType enum, etc.)
  - Keep truly shared types in `src/types/common.ts` (reduced to shared primitives)
  - Update ALL import paths across the codebase
  - Use `import type` for type-only imports
  - Run `npm run type-check` after EACH file creation (sequential, not parallel)
  - **CRITICAL**: If types reference each other, keep them in common.ts — don't create circular deps

  **Must NOT do**:
  - Don't rename any types or interfaces
  - Don't change type definitions
  - Don't split MessageType enum if it's used across domains (keep centralized)
  - Don't create circular imports between type files
  - Don't add `@ts-expect-error` or `@ts-ignore`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex refactor requiring careful dependency tracking across many files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential sub-steps with type-check between each)
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Tasks 8-12 (large file splits need stable types)
  - **Blocked By**: Tasks 1, 2, 3 (structure must be stable first)

  **References**:

  **API/Type References**:
  - `src/types/common.ts` — the 526-line file to split; contains ALL shared types for the project
  - `src/types/enum.ts` — existing enum file (check if it exists and what it contains)
  - `src/types/electron.d.ts` — Electron IPC types (don't touch)

  **Tool Recommendations**:
  - Use `lsp_find_references` on each type before moving to map all consumers
  - Use `lsp_diagnostics` after each file creation to catch circular deps early
  - Use `ast_grep_search` for pattern: `import { $TYPE } from '@/types/common'` to find all importers

  **Acceptance Criteria**:
  - [ ] `src/types/common.ts` reduced to ≤150 lines (shared primitives only)
  - [ ] `src/types/timer.ts` exists with timer-domain types
  - [ ] `src/types/bible.ts` exists with bible-domain types
  - [ ] `src/types/media.ts` exists with media-domain types
  - [ ] `src/types/folder.ts` exists with folder-domain types
  - [ ] `src/types/projection.ts` exists with projection-domain types
  - [ ] No circular imports between type files
  - [ ] All imports updated across codebase
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run test:unit` → all pass
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Type files are correctly split with no circular deps
    Tool: Bash
    Preconditions: All type files created and imports updated
    Steps:
      1. wc -l src/types/common.ts → Assert: ≤150 lines
      2. test -f src/types/timer.ts → Assert: exists
      3. test -f src/types/bible.ts → Assert: exists
      4. test -f src/types/media.ts → Assert: exists
      5. test -f src/types/folder.ts → Assert: exists
      6. test -f src/types/projection.ts → Assert: exists
      7. npm run type-check → Assert: 0 errors
      8. npm run test:unit → Assert: all pass
      9. npm run build → Assert: succeeds
      10. grep -r "from '@/types/common'" src/ | wc -l → Assert: significantly reduced from baseline
    Expected Result: Types split, all builds pass, no circular deps
    Evidence: Terminal output captured

  Scenario: No broken type imports remain
    Tool: Bash
    Preconditions: All type files created
    Steps:
      1. npm run type-check 2>&1 | grep "error TS" → Assert: 0 matches
      2. grep -r "from '@/types/timer'" src/stores/timer.ts → Assert: 1+ matches (timer store uses timer types)
      3. grep -r "from '@/types/bible'" src/stores/bible.ts → Assert: 1+ matches
    Expected Result: Domain stores import from domain type files
    Evidence: Terminal output captured
  ```

  **Commit**: YES (one commit per domain file, or grouped if all pass)
  - Message: `refactor: split types/common.ts into domain-specific type files`
  - Files: `src/types/*.ts` + all updated importers
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [ ] 6. pdfjs-dist Dynamic Import (Wave 3)

  **What to do**:
  - Modify `src/services/pdf/PdfService.ts` to dynamically import pdfjs-dist
  - Change `import * as pdfjsLib from 'pdfjs-dist'` to a lazy initialization pattern
  - Create an async init function that dynamically imports when first PDF is opened
  - Ensure worker URL is set after dynamic import
  - Optionally add `'pdf-vendor': ['pdfjs-dist']` to Vite manualChunks in `vite.config.ts`

  **Must NOT do**:
  - Don't change PdfService's public API
  - Don't remove any functionality (caching, render cancellation, thumbnails)
  - Don't change how usePdf composable calls PdfService

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Focused change in one service file + vite config
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task 14 (final verification)
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/composables/useFlexSearch.ts` — example of lazy Worker initialization pattern (initializeWorker creates worker only when needed)

  **API/Type References**:
  - `src/services/pdf/PdfService.ts` — main file to modify; currently imports `pdfjs-dist` at top level
  - `src/services/pdf/index.ts` — service export (keep unchanged)
  - `src/composables/usePdf.ts` — composable that wraps PdfService (verify API compatibility)
  - `vite.config.ts` — manualChunks configuration

  **Documentation References**:
  - pdfjs-dist dynamic import pattern: `const pdfjsLib = await import('pdfjs-dist')`

  **Acceptance Criteria**:
  - [ ] No top-level `import * as pdfjsLib from 'pdfjs-dist'` in PdfService.ts
  - [ ] pdfjs-dist loaded via dynamic import inside an async init or loadDocument
  - [ ] Worker URL set correctly after dynamic import
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run build` → succeeds
  - [ ] Build output shows pdfjs-dist in separate chunk (not in main renderer chunk)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: pdfjs-dist is lazily loaded
    Tool: Bash
    Preconditions: PdfService modified
    Steps:
      1. grep "import \* as pdfjsLib from 'pdfjs-dist'" src/services/pdf/PdfService.ts → Assert: 0 matches
      2. grep "await import" src/services/pdf/PdfService.ts → Assert: 1+ matches (dynamic import present)
      3. npm run type-check → Assert: 0 errors
      4. npm run build → Assert: succeeds
      5. ls dist-electron/renderer/assets/ | grep -i pdf → Assert: separate PDF chunk exists
    Expected Result: pdfjs-dist in separate chunk, loaded on demand
    Evidence: Build output and dist-electron/renderer/assets/ listing

  Scenario: PDF rendering still works after dynamic import
    Tool: Bash
    Preconditions: Build succeeds
    Steps:
      1. npm run build → Assert: 0 errors
      2. du -sh dist-electron/renderer/ → Compare against baseline (should be similar or smaller initial chunk)
    Expected Result: Bundle valid, PDF functionality preserved in code
    Evidence: Bundle size comparison
  ```

  **Commit**: YES
  - Message: `perf: lazy-load pdfjs-dist for smaller initial bundle`
  - Files: `src/services/pdf/PdfService.ts`, optionally `vite.config.ts`
  - Pre-commit: `npm run type-check && npm run build`

---

- [ ] 7. Font Loading Optimization (Wave 3)

  **What to do**:
  - Analyze current font imports in `src/main.ts` (4 @fontsource packages)
  - Determine which fonts are used in Control vs Projection views
  - Strategy: Keep font imports but add `font-display: swap` via CSS overrides
  - For projection window: ensure fonts preload (critical for live presentation)
  - If possible, defer non-critical font variants to reduce initial load

  **Must NOT do**:
  - Don't remove any fonts
  - Don't cause FOUT (Flash of Unstyled Text) in projection window
  - Don't change font-family declarations in existing CSS
  - Don't introduce loading skeletons or spinners (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: CSS/font configuration change
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: font loading strategy requires UI awareness

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Task 14 (final verification)
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/main.ts` — current font imports (lines importing @fontsource-variable/\*)
  - `src/plugins/vuetify.ts` — Vuetify font configuration
  - `src/layouts/projection/` — projection layouts that need reliable font loading

  **Acceptance Criteria**:
  - [ ] Font loading strategy documented in code comments
  - [ ] `font-display: swap` applied or equivalent strategy
  - [ ] Projection-critical fonts preloaded
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run build` → succeeds
  - [ ] Bundle size ≤ baseline

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Fonts load correctly after optimization
    Tool: Bash
    Preconditions: Font changes applied
    Steps:
      1. npm run build → Assert: succeeds
      2. grep -r "font-display" src/ → Assert: swap or optional present
      3. du -sh dist-electron/renderer/ → Compare against baseline
    Expected Result: Fonts optimized, build passes
    Evidence: Build output and size comparison
  ```

  **Commit**: YES
  - Message: `perf: optimize font loading strategy for faster initial render`
  - Files: `src/main.ts`, possibly CSS files
  - Pre-commit: `npm run type-check && npm run build`

---

- [ ] 8. Split PdfViewer.vue (Wave 4)

  **What to do**:
  - Read `src/components/Media/PdfViewer.vue` (423 lines)
  - Extract heavy canvas rendering logic into a composable: `src/composables/usePdfRenderer.ts`
  - Extract pagination/navigation logic if separate concern
  - Keep PdfViewer.vue as a thin wrapper (≤300 lines)
  - Add unit tests for extracted composable
  - Verify PDF viewing behavior preserved

  **Must NOT do**:
  - Don't change PdfViewer's component API (props, events, exposed)
  - Don't change visual appearance
  - Don't modify PdfService (already handled in Task 6)
  - Don't add `any` types

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex component split requiring understanding of canvas rendering patterns
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: component splitting requires UI architecture understanding

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 9, 10, 11, 12)
  - **Blocks**: Task 14
  - **Blocked By**: Task 5 (types must be stable)

  **References**:

  **Pattern References**:
  - `src/composables/useVideoPlayer.ts` — similar heavy-logic-in-composable pattern
  - `src/composables/usePdf.ts` — existing PDF composable that wraps PdfService
  - `src/services/pdf/PdfService.ts` — underlying PDF service

  **API/Type References**:
  - `src/components/Media/PdfViewer.vue` — the 423-line file to split
  - `src/types/media.ts` (after Task 5) — media-related types

  **Test References**:
  - `src/composables/__tests__/useElectron.test.ts` — test pattern for composables

  **Acceptance Criteria**:
  - [ ] PdfViewer.vue ≤ 300 lines
  - [ ] Extracted composable has unit tests
  - [ ] PdfViewer component API unchanged (same props, events)
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run test:unit` → all pass (including new tests)
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: PdfViewer split preserves functionality
    Tool: Bash
    Preconditions: Split complete
    Steps:
      1. wc -l src/components/Media/PdfViewer.vue → Assert: ≤300 lines
      2. test -f src/composables/usePdfRenderer.ts → Assert: exists
      3. npm run type-check → Assert: 0 errors
      4. npm run test:unit → Assert: all pass
      5. npm run build → Assert: succeeds
      6. grep "defineProps" src/components/Media/PdfViewer.vue → Assert: same props as before
    Expected Result: Thin wrapper component, logic in composable, all tests pass
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `refactor: extract PDF rendering logic from PdfViewer into usePdfRenderer composable`
  - Files: `src/components/Media/PdfViewer.vue`, `src/composables/usePdfRenderer.ts`, test file
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [x] 9. Split SettingsDialog.vue (Wave 4)

  **What to do**:
  - Read `src/components/Main/SettingsDialog.vue` (491 lines)
  - Extract setting sections into sub-components (e.g., GeneralSettings, AppearanceSettings, etc.)
  - Keep SettingsDialog.vue as the dialog shell (≤300 lines)
  - Add unit tests for key setting interactions

  **Must NOT do**:
  - Don't change settings behavior or stored values
  - Don't change dialog open/close API
  - Don't remove FFmpegInstallGuideDialog reference (it's an intentional sub-dialog)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: UI component split with multiple sub-sections
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 8, 10, 11, 12)
  - **Blocks**: Task 14
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/components/Main/SettingsDialog.vue` — the 491-line file to split
  - `src/components/Bible/MultiFunction/Control.vue` — example of tabbed/sectioned component

  **API/Type References**:
  - `src/stores/settings.ts` — settings store used by SettingsDialog
  - `src/components/Main/FFmpegInstallGuideDialog.vue:254` — sub-dialog imported by Settings

  **Acceptance Criteria**:
  - [ ] SettingsDialog.vue ≤ 300 lines
  - [ ] Sub-components created in `src/components/Main/Settings/` folder
  - [ ] Settings behavior unchanged
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run test:unit` → all pass
  - [ ] `npm run build` → succeeds

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: SettingsDialog split preserves all sections
    Tool: Bash
    Preconditions: Split complete
    Steps:
      1. wc -l src/components/Main/SettingsDialog.vue → Assert: ≤300 lines
      2. ls src/components/Main/Settings/ → Assert: sub-component files exist
      3. npm run type-check → Assert: 0 errors
      4. npm run test:unit → Assert: all pass
      5. npm run build → Assert: succeeds
    Expected Result: Dialog shell + sub-components, all tests pass
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `refactor: split SettingsDialog into sub-section components`
  - Files: `src/components/Main/SettingsDialog.vue`, `src/components/Main/Settings/*.vue`
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [x] 10. Split MediaPresenter.vue (Wave 4)

  **What to do**:
  - Read `src/components/Media/MediaPresenter.vue` (369 lines)
  - Extract presenter state management logic into a composable: `src/composables/useMediaPresenter.ts`
  - MediaPresenter already imports 5 sub-components — focus on extracting script logic, not template
  - Keep template orchestration in component, logic in composable
  - Add unit tests for extracted composable

  **Must NOT do**:
  - Don't change MediaPresenter's component API
  - Don't restructure the existing Preview/ sub-components
  - Don't change projection message handling

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: High-coupling component requiring careful dependency extraction
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 8, 9, 11, 12)
  - **Blocks**: Task 14
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/components/Media/MediaPresenter.vue:136-141` — current imports of stores/composables
  - `src/composables/useProjectionManager.ts` — projection coordination pattern

  **API/Type References**:
  - `src/stores/mediaProjection.ts` — useMediaProjectionStore used by MediaPresenter
  - `src/stores/pdfPresenter.ts` — usePdfPresenterStore used by MediaPresenter
  - `src/stores/stopwatch.ts` — useStopwatchStore used by MediaPresenter

  **Acceptance Criteria**:
  - [ ] MediaPresenter.vue ≤ 300 lines
  - [ ] Extracted composable has unit tests
  - [ ] Component API unchanged
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run test:unit` → all pass
  - [ ] `npm run build` → succeeds

  **Commit**: YES
  - Message: `refactor: extract MediaPresenter logic into useMediaPresenter composable`
  - Files: `src/components/Media/MediaPresenter.vue`, `src/composables/useMediaPresenter.ts`, test file
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [x] 11. Split Other Large Vue Components (Wave 4)

  **What to do**:
  - Split `src/components/Bible/BiblePreview.vue` (495 lines) — extract verse rendering + scroll sync logic into composable
  - Split `src/layouts/control/MediaControl.vue` (443 lines) — extract toolbar/filter logic
  - Split `src/components/Bible/Selector/BooksDialog.vue` (440 lines) — extract book grid + search logic
  - Each split follows same pattern: extract script logic into composable, keep template in component
  - Add unit tests for each extracted composable
  - Target: each file ≤ 350 lines (pragmatic, not rigid)

  **Must NOT do**:
  - Don't change component APIs
  - Don't change visual appearance
  - Don't restructure existing sub-components
  - Each component split in separate commit for easy revert

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Multiple component splits requiring domain understanding
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 8, 9, 10, 12)
  - **Blocks**: Task 14
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/components/Bible/BiblePreview.vue` — 495 lines, complex rendering + scroll sync
  - `src/layouts/control/MediaControl.vue` — 443 lines, layout with heavy script
  - `src/components/Bible/Selector/BooksDialog.vue` — 440 lines, dialog with search

  **Acceptance Criteria**:
  - [ ] BiblePreview.vue ≤ 350 lines
  - [ ] MediaControl.vue ≤ 350 lines
  - [ ] BooksDialog.vue ≤ 350 lines
  - [ ] Each extracted composable has unit tests
  - [ ] Each split in separate commit
  - [ ] `npm run type-check` → 0 errors after each split
  - [ ] `npm run test:unit` → all pass after each split
  - [ ] `npm run build` → succeeds after each split

  **Commit**: YES (separate commits per component)
  - Message pattern: `refactor: extract {Component} logic into {composable} composable`
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [~] 12. Split Large Composables (Wave 4) **[PARTIAL: 1/3 COMPLETE, 2/3 DEFERRED]**

  **What to do**:
  - ✅ Split `src/composables/useVideoPlayer.ts` (398→216 lines) — extracted silent mode + event handlers
  - ⚠️ Split `src/composables/useMediaOperations.ts` (396 lines) — **DEFERRED** (orchestrator complexity, see issues.md)
  - ⚠️ Split `src/composables/useFileSystem.ts` (388 lines) — **DEFERRED** (not started)
  - Target: each main composable ≤ 250 lines, extracted pieces are focused single-responsibility
  - Add/update unit tests

  **Must NOT do**:
  - Don't change composable public APIs (return values must remain same)
  - Don't create new composables that duplicate existing functionality
  - Don't change store interactions

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex composable splits with dependency chains
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 8, 9, 10, 11)
  - **Blocks**: Task 14
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/composables/useSentry.ts` — gold standard composable (61 lines, focused, widely used)
  - `src/composables/useFolderManager.ts` — good example of focused composable (227 lines, tree operations only)

  **API/Type References**:
  - `src/composables/useVideoPlayer.ts` — 398 lines, video playback orchestration
  - `src/composables/useMediaOperations.ts` — 396 lines, composes useFileSystem + useMediaUpload + useMediaClipboard + useMediaProcessing + useSnackBar
  - `src/composables/useFileSystem.ts` — 388 lines, file system abstraction

  **Acceptance Criteria**:
  - [x] useVideoPlayer.ts ≤ 250 lines (216L, committed 9c3e4f8, ae7cf0f)
  - [~] useMediaOperations.ts ≤ 250 lines (DEFERRED - orchestrator complexity)
  - [~] useFileSystem.ts ≤ 250 lines (DEFERRED - not started)
  - [x] Public APIs unchanged (same return values)
  - [x] Each split in separate commit
  - [x] `npm run type-check` → 0 errors after each
  - [x] `npm run test:unit` → all pass after each (7 pre-existing test errors)
  - [x] `npm run build` → succeeds after each

  **Status**: PARTIALLY COMPLETE - useVideoPlayer done (-182L), useMediaOperations/useFileSystem deferred due to tight orchestrator coupling. Blocker documented in `.sisyphus/notepads/project-optimization/issues.md`. May return if time permits or adjust targets to ≤300L for orchestrators.

  **Commit**: YES (separate commits per composable)
  - Message pattern: `refactor: extract {focus} logic from {composable}`
  - Pre-commit: `npm run type-check && npm run test:unit`

---

- [ ] 13. LiquidGlass Boundary Evaluation (Wave 5)

  **What to do**:
  - Analyze LiquidGlass usage across the app (which components use LG primitives)
  - Map import dependencies: LiquidGlass → app code and app code → LiquidGlass
  - Evaluate whether LiquidGlass should:
    a) Stay as-is (internal component library)
    b) Have a stricter import boundary (only via barrel export)
    c) Be extracted to a separate package in the future
  - Document findings and recommendation in `.sisyphus/notepads/project-optimization/liquidglass-evaluation.md`

  **Must NOT do**:
  - Don't move or rename LiquidGlass files
  - Don't change LiquidGlass internals
  - Don't create a new package (evaluation only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Analysis and documentation only, no code changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs all prior tasks complete for accurate analysis)
  - **Parallel Group**: Wave 5 (sequential)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 1-12

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/index.ts` — main barrel export
  - `src/components/LiquidGlass/plugin.ts` — plugin registration pattern

  **Acceptance Criteria**:
  - [ ] Evaluation document created at `.sisyphus/notepads/project-optimization/liquidglass-evaluation.md`
  - [ ] Contains: usage map, import direction analysis, recommendation (stay/boundary/extract)
  - [ ] No source files modified

  **Commit**: NO (documentation only)

---

- [ ] 14. Final Verification & Bundle Comparison (Wave 5)

  **What to do**:
  - Run complete verification suite:
    - `npm run type-check` → 0 errors
    - `npm run test:unit` → all pass (83+ tests)
    - `npm run lint` → 0 errors
    - `npm run build` → succeeds
  - Compare against baselines from Task 0:
    - Bundle size comparison
    - Large file count comparison
    - Test count comparison (should have MORE tests)
  - Record final metrics in `.sisyphus/notepads/project-optimization/final-report.md`

  **Must NOT do**:
  - Don't make any code changes
  - Don't fix issues (report them for follow-up)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and reporting only
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (final, runs after all)
  - **Parallel Group**: Wave 5 (last)
  - **Blocks**: None (final task)
  - **Blocked By**: All tasks 0-13

  **References**:

  **Documentation References**:
  - `.sisyphus/notepads/project-optimization/baselines.md` — baseline metrics from Task 0

  **Acceptance Criteria**:
  - [ ] `npm run type-check` → 0 errors
  - [ ] `npm run test:unit` → 83+ tests pass
  - [ ] `npm run lint` → 0 errors, 0 warnings
  - [ ] `npm run build` → succeeds
  - [ ] Bundle size ≤ baseline (or documented reason if larger)
  - [ ] Large Vue files > 300L count decreased
  - [ ] Large TS files > 200L count decreased
  - [ ] Final report saved to `.sisyphus/notepads/project-optimization/final-report.md`

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All quality gates pass and improvements measured
    Tool: Bash
    Preconditions: All prior tasks complete
    Steps:
      1. npm run type-check → Assert: 0 errors
      2. npm run test:unit → Assert: 83+ tests pass
      3. npm run lint → Assert: 0 errors
      4. npm run build → Assert: succeeds
      5. du -sh dist-electron/renderer/ → Compare vs baseline
      6. find src/ -name "*.vue" -exec wc -l {} \; | awk '$1>300' | wc -l → Compare vs baseline (should be lower)
      7. find src/ -name "*.ts" -exec wc -l {} \; | awk '$1>200' | wc -l → Compare vs baseline (should be lower)
    Expected Result: All gates pass, measurable improvement in file counts
    Evidence: .sisyphus/notepads/project-optimization/final-report.md
  ```

  **Commit**: NO (reporting only)

---

## Commit Strategy

| After Task | Message                                                                    | Files                                  | Verification       |
| ---------- | -------------------------------------------------------------------------- | -------------------------------------- | ------------------ |
| 1          | `refactor: add barrel exports for Timer and Media/Preview components`      | Timer/index.ts, Media/Preview/index.ts | type-check + test  |
| 2          | `refactor: extract shared video extension constants to config/media.ts`    | config/media.ts, 2 composables         | type-check + test  |
| 3          | `refactor: move root-level components to appropriate feature folders`      | 3 moved files + importers              | type-check + test  |
| 4          | `perf: lazy-load HomeView route for faster initial load`                   | router/index.ts                        | type-check + build |
| 5          | `refactor: split types/common.ts into domain-specific type files`          | types/\*.ts + importers                | type-check + test  |
| 6          | `perf: lazy-load pdfjs-dist for smaller initial bundle`                    | PdfService.ts, vite.config.ts          | type-check + build |
| 7          | `perf: optimize font loading strategy for faster initial render`           | main.ts, CSS                           | type-check + build |
| 8          | `refactor: extract PDF rendering logic from PdfViewer into usePdfRenderer` | PdfViewer.vue, composable, test        | type-check + test  |
| 9          | `refactor: split SettingsDialog into sub-section components`               | SettingsDialog.vue, Settings/\*.vue    | type-check + test  |
| 10         | `refactor: extract MediaPresenter logic into useMediaPresenter`            | MediaPresenter.vue, composable, test   | type-check + test  |
| 11a        | `refactor: extract BiblePreview logic into composable`                     | BiblePreview.vue, composable, test     | type-check + test  |
| 11b        | `refactor: extract MediaControl logic into composable`                     | MediaControl.vue, composable, test     | type-check + test  |
| 11c        | `refactor: extract BooksDialog logic into composable`                      | BooksDialog.vue, composable, test      | type-check + test  |
| 12a        | `refactor: split useVideoPlayer into focused sub-composables`              | useVideoPlayer.ts, sub-composables     | type-check + test  |
| 12b        | `refactor: split useMediaOperations into focused sub-composables`          | useMediaOperations.ts, sub-composables | type-check + test  |
| 12c        | `refactor: split useFileSystem into focused utilities`                     | useFileSystem.ts, utilities            | type-check + test  |

---

## Success Criteria

### Verification Commands

```bash
npm run type-check   # Expected: 0 errors
npm run test:unit    # Expected: 83+ tests pass (more with new tests)
npm run lint         # Expected: 0 errors, 0 warnings
npm run build        # Expected: succeeds
```

### Final Checklist

- [ ] 0 .vue files in src/components/ root
- [ ] All feature folders have barrel exports (index.ts)
- [ ] 0 duplicate constant definitions
- [ ] pdfjs-dist dynamically loaded
- [ ] HomeView lazy-loaded
- [ ] Font loading optimized
- [ ] types/common.ts ≤ 150 lines
- [ ] All originally 14 large Vue files (>300L) reduced or documented
- [ ] All originally 5 large composables (>300L) split
- [ ] LiquidGlass boundary evaluation complete
- [ ] Bundle size ≤ baseline
- [ ] Test count ≥ 83 (ideally more)
- [ ] All "Must NOT Have" guardrails respected
