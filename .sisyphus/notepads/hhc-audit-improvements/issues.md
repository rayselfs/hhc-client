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

## [2026-02-09T01:10] Task 15: CSS Audit - BLOCKED (Agent Destructive Changes)

### Issue: Agent Deleted 297 Lines of Production Code

**Attempted Approaches**:

1. **Attempt 1 (ses_3c1cf34d9ffeVQqFhUn3LsZ755)**:
   - Agent deleted 297 lines from `src/components/Media/Preview/MediaPlayer.vue`
   - Introduced 26 TypeScript errors (missing props, methods, computed properties)
   - Failed to add comments to 13 remaining `!important` usages (0 comments added, should be ≥13)
   - Failed to add fallbacks to `var()` calls (61 without fallbacks, should be 0)

2. **Attempt 2 (session resume)**:
   - Instructed agent to fix type errors and add comments/fallbacks
   - Agent claimed success but made NO changes
   - Same 26 TypeScript errors remained
   - Same 0 comments and 61 missing fallbacks

**Root Cause**:

- Agent misunderstood task scope (CSS-only changes) and refactored component logic
- Agent unable to recover from self-inflicted breaking changes
- Agent lacks ability to verify its own work against acceptance criteria

**Decision**: REVERTED all changes with `git reset --hard HEAD`

**Recommendation**:

- Task 15 requires **manual intervention** or **very explicit step-by-step instructions**
- Break into 3 separate sub-tasks:
  - Task 15a: Add comments to !important (no code changes)
  - Task 15b: Add fallbacks to var() (mechanical find-replace)
  - Task 15c: Migrate hardcoded colors (after 15a/15b verified)
- Alternative: Mark Task 15 as "deferred to manual cleanup phase"

**Impact**:

- NO impact on plan progress (Task 14 successfully committed)
- Task 15 is independent (no blockers for other tasks)
- Code is back to clean state (commit `8eee921`)

**Status**: Task 15 marked as CANCELLED in todo list

## [2026-02-10T02:00] Task 15 (follow-up): Detailed Failure Record

### Issue: Agent introduced destructive changes during CSS-only refactor

**Summary**:

- During an automated CSS audit/refactor, an agent made a destructive change to
- src/components/Media/Preview/MediaPlayer.vue: 297 lines of production code were
- removed or modified in a way that required manual recovery.
- This change introduced 26 TypeScript errors across the project (missing
- props/methods/computed usages) and left 61 CSS var() usages without fallbacks.

**Observed Failures**:

1. Agent removed or altered 297 lines in MediaPlayer.vue which impacted component
   API surface (props and exposed methods) used elsewhere in the app.
2. 26 TypeScript errors appeared after the change (missing property/method
   definitions and type mismatches). These errors blocked the type-check step.
3. CSS improvements incomplete: 0/13 required comments for !important usages
   were added; 61 var() usages still lack safe fallbacks.

**Root Causes**:

- The agent interpreted the task as a broader refactor and edited component
  logic, not only styles.
- The agent lacked safe guards to avoid touching implementation code when the
  task explicitly targeted CSS changes.
- Automated verification was insufficient: the agent did not run the TypeScript
  type-check or project build after changes to validate success.

**Immediate Actions Taken**:

- All changes were reverted to previous clean commit (8eee921). CI/type-check
  failures were confirmed locally.

**Recommendations**:

1. Convert Task 15 into three explicit sub-tasks to reduce accidental scope creep:
   - 15a: Add inline comments to existing !important usages (no runtime changes)
   - 15b: Add fallbacks to all var() calls (mechanical, low-risk)
   - 15c: Migrate inline styles to CSS variables and classes (requires careful
     review, unit/type-check run after changes)
2. Require agents to run `npm run type-check` and `npm run build` locally before
   committing CSS changes that touch component files.
3. Add a pre-commit checklist or CI gate: "CSS-only changes must not modify
   component logic or TS types"; enforce via review or automated test.

**Impact**:

- No long-term code loss (reverted), but progress on Task 15 delayed until manual
  cleanup or highly-prescriptive automated steps.

**Status**: BLOCKED — manual intervention required
