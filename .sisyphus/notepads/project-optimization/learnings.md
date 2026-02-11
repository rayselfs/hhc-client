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
