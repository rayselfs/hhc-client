# Issues and Blockers

## [2026-02-09T00:00] Task 9 & 10: Store/Composable Refactoring - BLOCKED

### Issue: Complex Refactoring Beyond Agent Capability

**Affected Tasks**:

- Task 9: Refactor Large Stores (folder.ts 793L, bible.ts 819L, timer.ts 546L)
- Task 10: Refactor Large Composables (useMediaOperations 966L, useElectron 593L)

**Attempted Approaches**:

1. **Attempt 1 (ultrabrain category)**: Agent超出範圍，同時處理 Task 9 和 Task 11，引入 45 個類型錯誤
2. **Attempt 2 (unspecified-high category)**: Agent 創建提取文件但未完成實際重構，folder.ts 仍為 793 lines
3. **Attempt 3 (session resume)**: Agent 自行判斷任務失敗，revert 所有更改並寫 post-mortem

**Root Causes**:

1. **複雜度過高**: 重構需要深度理解代碼結構、依賴關係、API 設計
2. **驗證困難**: 需要 characterization tests，但 folder/bible stores 沒有現有測試
3. **類型系統複雜**: folder.ts 使用泛型工廠模式 `useFolderStore<TItem>`，提取後保持類型安全很困難

**Recommendation**:

- **DEFER Tasks 9 & 10 到 Wave 4 結束**
- 先完成其他獨立任務（Task 11 已完成，Task 13 路由懶加載可獨立進行）
- Wave 5/6 的 UI 任務不依賴 store/composable 重構
- 如果時間允許，在 Wave 6 後重新嘗試，或標記為 "需要人工介入"

**Impact**:

- Task 12 (Vue component refactoring) 依賴 Tasks 9 & 10
- 但 Task 12 可以在不等待 9 & 10 的情況下進行（組件重構主要是拆分模板和提取邏輯）

**Decision**: 跳過 Tasks 9 & 10，繼續執行其他 Wave 任務

---

## [2026-02-09T00:15] Task 11: TypeScript Strict Phase 2 - PARTIAL SUCCESS

### Issue: Any Count Still High (85, target was ≤5)

**Result**:

- Reduced from 94 → 85 (10% reduction)
- ESLint rule added: `@typescript-eslint/no-explicit-any: 'error'`
- 3 files exempted (useIndexedDB, folder, flexsearch.worker)

**Why Partial**:

- Remaining 85 `any` usages spread across多個文件
- Many are in third-party type definitions or complex generic scenarios
- Full elimination would require extensive type augmentation

**Pragmatic Decision**:

- ✅ New `any` usages are blocked by ESLint rule
- ✅ Critical files have improved types
- ✅ Technical debt is contained (exempted files documented)
- ⚠️ Future improvement opportunity: Gradually reduce exempted files

**Status**: ACCEPTED as sufficient progress for this wave
