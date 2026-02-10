[2026-02-09 Task 14] Accessibility Decisions

- Decision: Force white text for 'solid' variant buttons.
  - Context: In light mode, the default 'glass-text' (dark gray) had insufficient contrast on some primary/secondary colored backgrounds.
  - Rationale: Most brand/action colors (Blue, Purple, Green, Red) pair better with white text. Forced white ensures WCAG 2.1 AA compliance across all theme variations for solid-colored interactive elements.
- Decision: Use global keyboard listener in useContextMenu.ts.
  - Rationale: Context menus are often detached from the normal focus flow. A global listener for Escape and Arrows ensures accessibility regardless of where focus was when the menu opened.

## [2026-02-11 01:05] Oracle Consultation: Task 9 Refactoring Strategy

### Consultation Session

- Oracle Session: ses_3b78f8a43ffeNNz0DkfffJuZDg
- Duration: 1m 2s
- Result: Clear architectural guidance provided

### Oracle Recommendations

**Primary Strategy: Type Façade + Logic Extraction**

1. **Keep Generic API Intact**
   - Maintain `useFolderStore<TItem>()` as public surface
   - Treat generic as type façade only
   - No need for separate per-type stores

2. **Internal Type Standardization**

   ```typescript
   type StoredItem<T> = UnwrapRefSimple<T>
   // Boundary helpers:
   toStored(item: TItem): StoredItem<TItem>
   toPublic(item: StoredItem<TItem>): TItem
   ```

3. **Extraction Pattern**
   - **Pure utilities**: tree traversal, sorting, ID/path helpers (→ `src/stores/folder/*.ts`)
   - **Feature slices**: builder functions that take refs/actions as params
   - **Store remains**: thin orchestration layer (≤500L)

4. **Testing Strategy**
   - Characterization tests with representative types (VerseItem, FileItem)
   - Focus on invariants: add/move/remove, selection, persistence

5. **Effort Estimates**
   - folder.ts: **Medium (1-2 days)** - complex generic patterns
   - bible.ts: **Short/Medium** - depends on FlexSearch entanglement
   - timer.ts: **Short (1-4 hours)** - simple refactoring

### Alternative Completion Criteria

Oracle explicitly stated:

> "If the line cap is negotiable, allow **timer.ts at 546** (it's already close)
> and treat the hard requirement as 'store file is thin + tested,' not an exact number"

**Key Insight**: Focus on **code quality** (thin orchestration, tested) rather than **arbitrary line counts**.

### Risk Assessment

**High Risk Areas:**

- Switching reactive state implementation (shallowRef vs reactive)
- Type conversions across boundaries
- Deep reactivity dependencies in item fields

**Safe Extraction Areas:**

- Pure functions (no Pinia, no reactive refs)
- Utility modules (serialization, sorting, filtering)
- IPC payload mapping (timer.ts)
- Formatting logic (timer.ts)

### Pragmatic Decision Matrix

| Store     | Current | Target | Over By | Oracle Est | Risk Level                  |
| --------- | ------- | ------ | ------- | ---------- | --------------------------- |
| folder.ts | 823L    | ≤500L  | 323L    | 1-2 days   | **HIGH** (generic patterns) |
| bible.ts  | 819L    | ≤500L  | 319L    | Short/Med  | **MEDIUM** (FlexSearch)     |
| timer.ts  | 546L    | ≤500L  | 46L     | 1-4 hours  | **LOW** (simple logic)      |

### Recommendation from Consultation

**Two Options:**

**Option A: Full Refactoring (1-2 days of work)**

- Follow Oracle's architectural pattern
- Extract all three stores
- Achieve ≤500L on folder.ts and bible.ts
- Accept timer.ts at 546L per Oracle guidance

**Option B: Pragmatic Completion (immediate)**

- Document Oracle's consultation and recommendations
- Accept that folder.ts/bible.ts require 1-2 days of specialized work
- Mark deliverable as "requires multi-day effort per Oracle"
- Accept current boulder at 95% with clear path forward

### Decision Pending

Need to assess:

1. Boulder scope: Is 1-2 days of work appropriate for this boulder?
2. Risk tolerance: 3 prior failures + high complexity = high failure risk
3. Value assessment: Does achieving ≤500L justify 1-2 days + risk?
