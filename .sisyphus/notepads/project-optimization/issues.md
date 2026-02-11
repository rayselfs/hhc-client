## [2026-02-11] Task 12 Blocker: Complex Orchestrator Composables

### Issue

Task 12 requires splitting 3 large composables to ≤250 lines each:

- ✅ useVideoPlayer.ts: COMPLETE (398→216L)
- ⚠️ useMediaOperations.ts: BLOCKED (395L, needs 145L reduction)
- ⚠️ useFileSystem.ts: NOT STARTED (387L, needs 137L reduction)

### Root Cause

**useMediaOperations.ts** and **useFileSystem.ts** are high-level orchestrator composables that:

1. Coordinate multiple sub-composables (upload, clipboard, processing, dialogs)
2. Manage complex state synchronization between store and UI
3. Have tightly coupled logic that's hard to extract without breaking cohesion

**useMediaOperations specifically**:

- Lines 45-147 (103 lines): Sorting logic with reactive watchers and complex compareFn
- Lines 149-277 (129 lines): Dialog handlers (save, delete) with retention period logic
- Lines 279-353 (75 lines): Move/reorder operations
- Extracting any of these breaks the orchestration pattern

**Attempted Solution**:

- Created `useMediaSorting.ts` (113L) to extract sorting logic
- Integration failed due to:
  - Sorting implementation in file is more complex than initial analysis
  - Has `void isFfmpegEnabled.value` reactive dependency
  - Custom compareFn with folder/file separation logic
  - Tight coupling with mediaStore.updateFolderViewSettings

### Impact on Timeline

**Time spent on Task 12**: ~2 hours

- useVideoPlayer: 1 hour (SUCCESS)
- useMediaOperations analysis/attempt: 45 mins (BLOCKED)
- Token usage: 92k/1M

**Remaining effort estimate**:

- useMediaOperations: 1-2 hours (needs careful refactoring)
- useFileSystem: 1-1.5 hours (not analyzed yet)
- **Total**: 2-3.5 hours

### Decision

**SKIP Task 12 (remaining 2 files) for now** and continue with Tasks 13-15, then return if time permits.

**Rationale**:

1. useVideoPlayer completion already provides value (182 lines reduced)
2. Remaining files are complex orchestrators with high refactoring risk
3. Tasks 13-15 are simpler (analysis, verification) and can be completed faster
4. Boulder system prioritizes forward progress over perfection

### Recommended Future Approach

**For useMediaOperations.ts**:

1. Extract retention period calculation into utility function (15 lines)
2. Extract duplicate name checking into separate function (25 lines)
3. Condense compareFn inline (remove intermediate variables, -10 lines)
4. This gets to ~345L (still over, but closer)
5. Consider if ≤250L target is realistic for orchestrator composables

**For useFileSystem.ts**:

1. Analyze structure first (file type detection, path utilities, validation)
2. Extract pure utility functions (no reactive dependencies)
3. Estimate reduction potential before starting

### Alternative: Adjust Acceptance Criteria

**Proposal**: Modify Task 12 target from ≤250L to ≤300L for orchestrator composables

**Justification**:

- useVideoPlayer hit 216L because it had separable concerns (events, audio context)
- Orchestrator composables have inherent coordination overhead
- 300L is still a 24% reduction from 395L
