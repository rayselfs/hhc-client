# Learnings — constant deduplication

- Extracted VIDEO_EXTENSIONS and NON_NATIVE_VIDEO_EXTENSIONS to src/config/media.ts to create single source of truth.
- Kept original values exactly to avoid behavior changes.
- Followed existing config file pattern (export const ...).
- Verified by running type-check and unit tests; all tests passed.
- Verification commands used:
  - npm run type-check
  - npm run test:unit
  - grep -r "const VIDEO_EXTENSIONS\|const NON_NATIVE_VIDEO_EXTENSIONS" src/composables/ (no results)

Recommendation: Add a small comment in media.ts if lists need future extension and consider using a centralized media utility for related helpers.

- Lazy-load verification: After changing Home route to dynamic import, ran type-check and build; HomeView produced separate CSS and JS assets:
  - assets/HomeView-AdnSXXDm.js
  - assets/HomeView-7uW4MG3u.css
    Verification commands: `npm run type-check`, `npm run build`, `ls dist-electron/renderer/assets/ | grep -i home`
- Added barrel export files for Timer and Media/Preview to match existing patterns (e.g., Bible, Media, Alert). Files created:
  - src/components/Timer/index.ts (exports 9 components)
  - src/components/Media/Preview/index.ts (exports 6 components)

Pattern notes:

- Use "export { default as Name } from './Name.vue'" for Vue single-file components.
- Barrel files live at the folder root and re-export individual .vue files to simplify imports.

Verification performed:

- vue-tsc type-check: passed
- npm run build: passed
- grep for imports referencing the new barrels: no direct usages found (safe to add barrels without breaking imports)

Next steps: If consumers should import from the barrel, open a follow-up task to refactor import sites to use the barrel paths.

## Component move: ContextMenu, ExtendedToolbar, GlobalOverlays

- Used LSP (attempted) and grep to locate importers. LSP was not responding in time, installed `@vue/language-server` globally to resolve but still experienced timeouts. Fell back to repository grep searches for import paths.
- Moved files with `mv` into target folders: Shared and Main
- Updated importer paths directly where matches were found (MediaToolbar.vue, BiblePreview.vue, MultiFunction/Control.vue, HomeView.vue)
- Added barrel exports:
  - src/components/Shared/index.ts → ContextMenu
  - src/components/Main/index.ts → ExtendedToolbar, GlobalOverlays
- Verified files exist at new locations and that no .vue files remain at src/components root
- Ran `npm run type-check` after changes — no errors reported

Notes:

- When LSP fails, use precise grep patterns to find string imports (but avoid grep as primary tool per guidelines). Documented instances where grep was used due to LSP instability.
- Keep moves atomic and run type-check between moves in bigger refactors. For this wave we moved all three then updated imports; if more widespread usage is discovered, consider moving one at a time.

## Type splitting: common.ts → domain-specific files (Wave 2)

Successfully split 527-line common.ts into domain-specific type files:

### Created files:

- `src/types/projection.ts` (108 lines) - MessageType, ViewType, AppMessage, message interfaces
- `src/types/timer.ts` (65 lines) - TimerMode, TimerPreset, timer message types
- `src/types/bible.ts` (extended existing file +30 lines) - Bible message types added to existing API types
- `src/types/media.ts` (28 lines) - MediaUpdateMessage, MediaControlMessage
- `src/types/folder.ts` (169 lines) - All folder/file/verse item types, permissions, view settings

### Final common.ts:

- **97 lines** (reduced from 527, target ≤150 met!)
- Kept truly shared types: MenuItem, DisplayInfo, ErrorType, Environment, StorageKey, StorageCategory, getStorageKey()

### Import update strategy:

1. Created Python script to analyze imports from `@/types/common`
2. Mapped each type to target module (projection, timer, bible, media, folder, common)
3. **Fixed 47 files** automatically using regex replacements
4. Added proper `import type` for type-only imports (verbatimModuleSyntax compliance)

### Dependency management:

- **Critical**: Create `projection.ts` FIRST - other domains depend on MessageType/BaseMessage
- `timer.ts` imports from `projection.ts` (TimerTickMessage extends BaseMessage)
- `bible.ts` imports from `projection.ts` (BibleSyncContentMessage extends BaseMessage)
- `media.ts` imports from `projection.ts` AND `folder.ts` (MediaUpdateMessage needs FileItem)
- `common.ts` imports `ViewType` from `projection.ts` (MenuItem.component: ViewType)

### Gotchas avoided:

- **Circular deps**: Kept MessageType centralized in projection.ts (used across all domains)
- **FileSourceType**: Moved to folder.ts (even though filesystem uses it - folder is the source of truth)
- **FolderStoreConfig, FolderViewSettings**: Moved to folder.ts (not common despite store usage)
- **Bible types**: bible.ts already existed with API types - APPENDED message types instead of overwriting

### Verification:

```bash
npm run type-check  # 0 errors
npm run test:unit   # 83/83 pass
npm run build       # Success (3.7s renderer, 1.5s main)
wc -l src/types/common.ts  # 97 lines
```

### Key learnings:

1. **Python > sed/awk** for complex multi-file import updates (regex + file I/O in 30 lines)
2. **Sequential domain creation** worked better than parallel (avoided circular dep debug hell)
3. **Type-check-driven fixes** more reliable than manual grep (LSP caught all missing imports)
4. **Preserve existing comments** - all TSDoc comments copied verbatim to maintain documentation
5. **bible.ts already existed** - always check before creating new type files!

### Commit strategy:

- Group all type files + import updates in ONE commit (atomic refactor)
- Message: `refactor: split types/common.ts into domain-specific type files`
- Pre-commit: type-check + test:unit (both pass)

### Impact:

- Reduced common.ts by **81.6%** (527→97 lines)
- Created 4 new + extended 1 existing type file
- Updated 47 files with correct domain imports
- **Zero breaking changes** (all tests pass, build succeeds)
- Enables future domain-specific type evolution without common.ts bloat

## pdfjs-dist dynamic loading (Wave 3, Task 6)

Successfully converted pdfjs-dist from eager import to lazy initialization:

### Implementation:

- **Pattern**: Lazy-init function (similar to useFlexSearch worker pattern)
- **Module-level state**: `pdfjsLib` (null until first use) + `pdfjsInitPromise` (dedup concurrent inits)
- **Init function**: `async initPdfjs()` - called automatically in `loadDocument()`
- **Worker config**: Moved from top-level to inside init function (after dynamic import)

### Code changes:

```typescript
// Before (eager):
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = ...

// After (lazy):
let pdfjsLib: typeof import('pdfjs-dist') | null = null
async function initPdfjs() {
  if (pdfjsLib) return
  pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = ...
}

async loadDocument(url: string) {
  await initPdfjs()
  if (!pdfjsLib) throw new Error('Failed to initialize pdfjs-dist')
  // ... rest of loadDocument
}
```

### Bundle impact:

- **Before**: pdfjs-dist in main bundle (eager load)
- **After**: `pdf-xcU296FC.js (408.01 kB)` - separate chunk, loaded on-demand
- **Total bundle size**: 16M (unchanged - same as baseline)
- **Initial load reduction**: ~408KB (will only load when PDF opened)

### Verification:

```bash
npm run type-check  # 0 errors
npm run test:unit   # 83/83 pass
npm run build       # Success - pdfjs in separate chunk
du -sh dist-electron/renderer/  # 16M (baseline maintained)
ls dist-electron/renderer/assets/ | grep pdf  # pdf-xcU296FC.js confirmed
```

### Key learnings:

1. **Lazy init dedup critical**: Use `initPromise` to prevent concurrent dynamic imports
2. **Type-safe nullable**: `pdfjsLib | null` + runtime guard (`if (!pdfjsLib) throw`) satisfies TypeScript
3. **Worker config timing**: Must configure worker AFTER dynamic import (inside init function)
4. **Transparent to consumers**: No API changes - PdfService works exactly as before
5. **Bundle validation**: `npm run build` output shows separate chunk - easy to verify

### Comments kept:

- **Line 4**: `// Lazy-load pdfjs-dist to reduce initial bundle size` - **Necessary**: Performance optimization rationale
- **Lines 8-11**: JSDoc for `initPdfjs()` - **Necessary**: Public API documentation (module-level function)

Removed inline flow comments (e.g., "Already initialized", "Start initialization") as code is self-documenting.

### Commit:

- Message: `perf: lazy-load pdfjs-dist for smaller initial bundle`
- Files: `src/services/pdf/PdfService.ts`
- Pre-commit: `npm run type-check && npm run build`

## Font loading optimization (Wave 3, Task 7)

### Discovery: Fonts already optimized by @fontsource

Investigation revealed **no code changes needed** - @fontsource packages already include optimal font-loading strategies:

1. **font-display: swap** (built-in to all @font-face rules)
   - Prevents FOIT (Flash of Invisible Text)
   - Text renders immediately with fallback fonts
   - Web fonts swap in once loaded

2. **Unicode-range subsetting** (automatic)
   - Each font split into ~80+ unicode-range chunks
   - Only required character ranges loaded (e.g., latin-ext, chinese-tc)
   - Examples from build output:
     - `noto-sans-tc-87-wght-normal.woff2` (5.80 kB)
     - `open-sans-greek-ext-wght-normal.woff2` (4.50 kB)

3. **Variable fonts** (already using -variable packages)
   - Single file per font family supports all weights (100-900)
   - Smaller total size than multiple static weight files

### Action taken: Documentation instead of code changes

Added comprehensive JSDoc comment in `src/main.ts` documenting:

- Font loading strategy rationale
- Performance characteristics (swap, subsetting, variable fonts)
- Control vs Projection window trade-offs (per Metis Review)

**Justification**: This is a **necessary comment** (Priority 3) because:

- Documents non-obvious performance optimization built into @fontsource
- Explains architectural decision (FOUT acceptable in control, cached in projection)
- Prevents future developers from attempting unnecessary "optimizations"

### Verification:

```bash
npm run type-check  # 0 errors
npm run build       # Success
du -sh dist-electron/renderer/  # 16M (baseline maintained)
head -30 node_modules/@fontsource-variable/noto-sans-tc/index.css  # Confirmed font-display: swap
```

### Bundle analysis:

- Total font package size: 14.3M (source), split into ~80+ chunks in build
- Build output includes only used unicode ranges (subset on demand)
- No impact on bundle size (fonts already optimized)

### Key learnings:

1. **Always check upstream packages** before optimizing - @fontsource already does heavy lifting
2. **font-display: swap is built-in** to @fontsource v5+ (no custom CSS needed)
3. **Unicode-range subsetting** happens automatically with modern font packages
4. **Documentation > code** when existing implementation is already optimal
5. **"Already optimized" is a valid task outcome** - document findings and move on

### Commit:

- Message: `perf: document font loading strategy (already optimized by @fontsource)`
- Files: `src/main.ts`
- Pre-commit: `npm run type-check && npm run build`
