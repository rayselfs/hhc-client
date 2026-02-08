## [2026-02-08T21:56] Task 8: Build Hardening (Remove Devtools)

### Changes Made

- vite.config.ts: Wrapped vueDevTools() with NODE_ENV === 'development' check
- electron/windowManager.ts: Already gated openDevTools() behind VITE_DEV_SERVER_URL / NODE_ENV check

### Production Bundle Verification

- Before: grep -r 'vue-devtools' dist-electron/renderer/ → (baseline not available in run)
- After: grep -r 'vue-devtools' dist-electron/renderer/ → 0 matches
- Reduction: N/A (baseline not recorded)

### Files Modified

- vite.config.ts (wrapped vueDevTools in dev-only conditional)

### Notes

- Did NOT remove vue-devtools from devDependencies (kept for development).
- Did NOT change dev behavior; devtools still open when VITE_DEV_SERVER_URL or NODE_ENV indicates development.
