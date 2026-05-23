# PROJECT KNOWLEDGE BASE

**Updated:** 2026-05-23
**Commit:** 272ee9e
**Branch:** main

## OVERVIEW

Electron desktop app for church projection (`hhc-client`). React 19 + TypeScript + Vite via `electron-vite`. Dual-window architecture: main window (sidebar + pages) + projection window (fullscreen display). **Dual-mode**: runs in both Electron (IPC) and browser (BroadcastChannel/Web Worker) environments.

## STRUCTURE

```
hhc-client-v2/
├── .github/workflows/       # CI + CD pipelines
│   ├── ci.yml               # PR quality gates (lint, typecheck, test, build)
│   ├── build-release.yml    # Tag-triggered macOS + Windows packaging → GitHub Release
│   └── azure-static-web-apps-*.yml  # Azure SWA deploy (PR preview + tag deploy)
├── src/
│   ├── main/                # Electron main process
│   │   ├── index.ts         # App lifecycle, WindowManager integration
│   │   ├── windowManager.ts # Singleton: main + projection window management
│   │   ├── timerService.ts  # Main-process timer broadcast service
│   │   └── ipc/             # IPC handler registration
│   │       ├── app.ts       # App-level IPC (version, etc.)
│   │       ├── bible-api.ts # Bible data IPC
│   │       ├── projection.ts
│   │       ├── timer.ts
│   │       └── validate.ts  # Centralized sender validation
│   ├── preload/             # Context bridge — exposes electron API to renderer
│   │   ├── index.ts
│   │   └── index.d.ts      # Window.electron + Window.api type declarations
│   ├── shared/              # Shared between main/preload/renderer
│   │   ├── api-paths.ts
│   │   ├── constants/
│   │   ├── ipc-channels.ts  # IPC channel name constants
│   │   ├── projection-messages.ts  # Projection message types (AppMessages)
│   │   └── types/
│   └── renderer/src/        # React app (Vite entry: main.tsx → App.tsx)
│       ├── components/
│       │   ├── Common/      # Reusable: ConfirmDialog, ContextMenuOverlay, GlassDivider
│       │   ├── Control/     # Domain control panels
│       │   │   ├── Bible/   # Bible browsing + search
│       │   │   ├── Bridge/  # Bridge/connection UI
│       │   │   ├── Folder/  # Folder management
│       │   │   ├── Timer/   # Timer controls
│       │   │   ├── UserMenu/
│       │   │   ├── Header/
│       │   │   ├── Layout.tsx
│       │   │   ├── LoadingFallback.tsx
│       │   │   └── Sidebar.tsx
│       │   ├── Projection/  # Projection display components
│       │   │   ├── BibleProjection.tsx
│       │   │   ├── DefaultProjection.tsx
│       │   │   └── TimerProjection.tsx
│       │   ├── ErrorBoundary.tsx
│       │   └── RouteError.tsx
│       ├── config/          # App configuration
│       │   ├── events.ts    # Custom event names
│       │   └── shortcuts.ts # Keyboard shortcut definitions
│       ├── contexts/        # React contexts (non-serializable services only)
│       │   ├── AppInitContext.ts
│       │   ├── ConfirmDialogContext.tsx
│       │   ├── ContextMenuContext.tsx
│       │   ├── ProjectionContext.tsx  # ProjectionOwner type + useProjection()
│       │   ├── ShortcutScopeContext.tsx
│       │   ├── ThemeContext.tsx
│       │   └── TimerEngineContext.tsx
│       ├── lib/             # Utilities + adapters
│       │   ├── env.ts              # isElectron() / isWeb()
│       │   ├── projection-adapter.ts  # Dual-mode projection messaging
│       │   ├── timer-adapter.ts       # Dual-mode timer engine
│       │   ├── persist-storage.ts     # Shared Zustand persist adapter
│       │   ├── shortcut-registry.ts   # Keyboard shortcut management
│       │   ├── routes.ts             # Route path helpers
│       │   ├── bible-api.ts / bible-db.ts / bible-search.ts / bible-utils.ts
│       │   ├── folder-db.ts / createFolderContextMenu.ts
│       │   ├── app-init.ts / onboarding.ts / http.ts / aria.ts
│       │   ├── parse-duration.ts / site-data.ts / storage-prefix.ts
│       │   └── use-overlay-state.ts
│       ├── stores/          # Zustand stores
│       │   ├── timer.ts / timer-config.ts / timer-runtime.ts
│       │   ├── stopwatch.ts
│       │   ├── settings.ts
│       │   ├── bible.ts / bible-history.ts / bible-search.ts / bible-settings.ts / bible-speech.ts
│       │   ├── folder.ts
│       │   ├── file-explorer.ts
│       │   ├── media-projection.ts
│       │   ├── update.ts
│       │   └── selectors/   # folder.ts, stopwatch.ts, update.ts
│       ├── workers/         # Web Workers
│       │   └── timer.worker.ts  # setInterval(100ms) tick loop for browser mode
│       ├── pages/           # Route pages
│       │   ├── TimerPage.tsx
│       │   ├── BiblePage.tsx
│       │   ├── FilesPage.tsx
│       │   ├── FavoritesPage.tsx
│       │   ├── TrashPage.tsx        # File Explorer trash (soft-deleted items)
│       │   ├── ProjectionPage.tsx
│       │   └── WelcomePage.tsx
│       ├── i18n/            # react-i18next setup
│       ├── locales/         # en.json, zh-TW.json, zh-CN.json
│       ├── types/           # theme.ts
│       └── assets/          # CSS + SVG
├── build/                   # Packaging assets (icons, mac entitlements)
├── resources/               # App resources (icon.png, bundled in asar)
└── out/                     # Compiled main/preload output (gitignored)
```

**Double-src nesting**: Renderer lives at `src/renderer/src/` — electron-vite default. The `@renderer` alias resolves here.

## WHERE TO LOOK

| Task                           | Location                                                            | Notes                                                                               |
| ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Main process / window creation | `src/main/index.ts` + `windowManager.ts`                            | WindowManager singleton manages both windows                                        |
| IPC handlers                   | `src/main/ipc/`                                                     | app.ts, bible-api.ts, projection.ts, timer.ts, validate.ts                          |
| Timer main-process service     | `src/main/timerService.ts`                                          | Broadcasts timer state to projection window                                         |
| Shared types & constants       | `src/shared/`                                                       | IPC channels, projection messages, API paths, shared types                          |
| Expose API to renderer         | `src/preload/index.ts`                                              | contextBridge; update `index.d.ts` for types                                        |
| UI / React components          | `src/renderer/src/components/`                                      | Control/ (domain panels), Common/ (reusable), Projection/ (display)                 |
| File Explorer (files/folders)  | `src/renderer/src/pages/FilesPage.tsx` + `stores/file-explorer.ts`  | File upload, folder CRUD, favorites, trash; uses `createFolderStore`                |
| Trash / deletion flow          | `src/renderer/src/pages/TrashPage.tsx` + `lib/app-init.ts`          | Soft-deleted items; see deletion flow design note below                             |
| Folder store base              | `src/renderer/src/stores/folder.ts`                                 | `createFolderStore` factory shared by File Explorer + Bible                         |
| Folder IndexedDB ops           | `src/renderer/src/lib/folder-db.ts`                                 | All IndexedDB reads/writes for folder-records + folder-items                        |
| Timer engine (adapter bridge)  | `src/renderer/src/contexts/TimerEngineContext.tsx`                  | Bridges adapter ↔ Zustand stores                                                    |
| Timer adapter (dual-mode)      | `src/renderer/src/lib/timer-adapter.ts`                             | BrowserTimerAdapter (Worker) vs ElectronTimerAdapter (IPC)                          |
| Timer Worker                   | `src/renderer/src/workers/timer.worker.ts`                          | setInterval(100ms) tick loop for browser mode                                       |
| Projection messaging           | `src/renderer/src/lib/projection-adapter.ts`                        | Electron IPC or BroadcastChannel adapter                                            |
| Environment detection          | `src/renderer/src/lib/env.ts`                                       | `isElectron()` / `isWeb()` — renderer only                                          |
| State (Zustand)                | `src/renderer/src/stores/`                                          | timer, stopwatch, settings, bible, folder, update. Several use `persist` middleware |
| Persist storage adapter        | `src/renderer/src/lib/persist-storage.ts`                           | Shared `hhcPersistStorage` + `createPersistName()` for all persisted stores         |
| Theme system                   | `src/renderer/src/contexts/ThemeContext.tsx`                        | Dark/light/system, syncs with Electron nativeTheme                                  |
| Routing                        | `src/renderer/src/router.tsx`                                       | HashRouter; `/projection` is outside Layout                                         |
| Keyboard shortcuts             | `src/renderer/src/config/shortcuts.ts` + `lib/shortcut-registry.ts` | Centralized shortcut definitions + runtime registry                                 |
| Context menu                   | `ContextMenuContext` + `lib/createFolderContextMenu.ts`             | Generic infra + factory for domain-specific menus                                   |
| Path alias config              | `electron.vite.config.ts` + `tsconfig.web.json`                     | Keep `@renderer` alias in sync between both                                         |
| CSP policy                     | `src/renderer/index.html`                                           | Affects web mode only; Electron is lenient                                          |
| Packaging / installers         | `electron-builder.yml`                                              | Win/Mac/Linux targets                                                               |
| CI / CD                        | `.github/workflows/`                                                | ci.yml (PR gates), build-release.yml (tag release), Azure SWA (preview deploy)      |

## CONVENTIONS

### Code Style (enforced by tooling)

- **No semicolons** — Prettier `semi: false`
- **Single quotes** — `singleQuote: true`
- **Print width**: 100
- **No trailing commas** — `trailingComma: none`
- **Indent**: 2 spaces (editorconfig)

### TypeScript

- Separate tsconfigs: `tsconfig.node.json` (main/preload) and `tsconfig.web.json` (renderer)
- Both extend `@electron-toolkit/tsconfig`
- `jsx: react-jsx` in web config
- Path alias: `@renderer/*` → `src/renderer/src/*`

### ESLint

- Flat config (`eslint.config.mjs`)
- `@electron-toolkit` TS + Prettier configs
- React hooks + React Refresh plugins for `.ts/.tsx`

### Git Workflow

- **Never commit directly to main** — always create a feature branch first
- Branch naming: `feat/`, `fix/`, `refactor/`, `chore/` prefix
- Commit messages: conventional commits style (`feat:`, `fix:`, `refactor:`, etc.)
- PR to main → CI must pass → merge

### Imports

- Renderer uses `@renderer/...` alias (resolve in both Vite and tsconfig)
- Main/preload use relative paths

### Component Placement

- **Domain-specific control UI** → `components/Control/{Feature}/`
- **Projection display components** → `components/Projection/{Feature}Projection.tsx`
- **Reusable generic components** → `components/Common/`

## STATE MANAGEMENT

### Context vs Zustand Rule

- **Context** (`src/renderer/src/contexts/`): Non-serializable services and imperative environment integration. Manages long-lived adapters, window handles, DOM side-effects (theme sync). Never stores plain business data.
- **Zustand** (`src/renderer/src/stores/`): Serializable app/domain state. Timer config, timer runtime, stopwatch, app settings, bible state, folders. Consumed by multiple components via selectors.
- **If a context starts looking like plain state + setters, move it to a Zustand store.**

### Zustand Persistence Convention

Stores that need persistence use Zustand's `persist` middleware with a shared storage adapter:

```typescript
import { persist } from 'zustand/middleware'
import { hhcPersistStorage, createPersistName } from '@renderer/lib/persist-storage'

export const useMyStore = create<MyStore>()(
  persist(
    (set, get) => ({
      /* state + actions */
    }),
    {
      name: createPersistName('my-store'), // → localStorage key 'hhc-my-store'
      storage: hhcPersistStorage, // shared adapter with error toast
      version: 0, // bump + add migrate() on schema changes
      partialize: (state) => ({
        // only persist what's needed
        /* config fields only, NOT runtime/ephemeral state */
      })
    }
  )
)
```

Key rules:

- **Always use `hhcPersistStorage`** — never call `localStorage` directly from stores
- **Always use `createPersistName()`** — maintains `hhc-` prefix convention
- **Always use `partialize`** — only persist config/user-preference fields, never runtime state (status, progress, timers)
- **Set `version: 0`** — bump the version and add `migrate()` when changing persisted field shapes
- **Hydration is synchronous** — `createJSONStorage(() => localStorage)` hydrates at store creation time, no flicker
- **Auth tokens do NOT go in persisted Zustand** — use a separate secure storage service

## DUAL-MODE ARCHITECTURE

This app runs in two environments. Every feature must work in both.

### Adapter Pattern

All cross-environment logic uses adapters that abstract Electron IPC vs browser APIs:

| Adapter              | Electron Mode              | Browser Mode                       |
| -------------------- | -------------------------- | ---------------------------------- |
| `projection-adapter` | IPC via preload API        | BroadcastChannel(`hhc-projection`) |
| `timer-adapter`      | IPC via `window.api.timer` | Web Worker (`timer.worker.ts`)     |

### Dual-Window Projection

```
[Main Window]                    [Projection Window]
TimerPage / BiblePage            ProjectionPage
       │                                │
useProjection().send(channel, data)     adapter.on(channel, handler)
       │                                │
       ▼                                ▼
┌─ projection-adapter.ts ─────────────────────────────┐
│  Electron: IPC via preload API                      │
│  Browser:  BroadcastChannel('hhc-projection')       │
└─────────────────────────────────────────────────────┘
```

### Timer Engine

```
[Button click] → store.start() → status change
       │
TimerEngineContext detects status change via useEffect
       │
adapter.sendCommand('start')
       │
       ├─ Electron: IPC → main process timerService
       └─ Browser:  postMessage → timer.worker.ts (setInterval 100ms)
       │
adapter.onTick → store.tick(Date.now())
```

### Dual-Mode Pitfalls (IMPORTANT)

- **CSP only affects web mode**: `index.html` CSP policy is enforced by browsers but Electron is lenient. When adding Web Workers, WebSockets, or external fetches — **update CSP directives and test in browser**, not just Electron.
- **Resource lifecycle in React StrictMode**: Any adapter/service created via `useState(() => new Resource())` will be killed by StrictMode double-mount if `dispose()` is irreversible (e.g. `worker.terminate()`). **Create disposable resources inside `useEffect`**, not `useState`. Pattern: `ElectronAdapter.dispose()` removes listeners (reversible) vs `BrowserAdapter.dispose()` terminates Worker (irreversible).
- **Silent failures**: Electron IPC failures often throw; browser-mode failures (CSP blocks, dead Workers) are **silently swallowed**. Always check browser DevTools console when debugging web mode.
- **Feature parity testing**: Always test both `npm run dev` (Electron) AND `localhost:5173` (browser) when modifying adapters or adding new cross-environment features.

## CI / CD

| Workflow                  | File                          | Trigger               | Steps                                                                   |
| ------------------------- | ----------------------------- | --------------------- | ----------------------------------------------------------------------- |
| **CI Quality Gates**      | `ci.yml`                      | PR → main             | `npm ci` → lint → typecheck → vitest → build                            |
| **Azure Static Web Apps** | `azure-static-web-apps-*.yml` | PR → main + tag `v*`  | Build renderer → deploy preview (PR) / production (tag)                 |
| **Build and Release**     | `build-release.yml`           | tag `v*.*.*` / manual | macOS (arm64) + Windows packaging → GitHub Release (`--publish always`) |

### PR → Merge Flow

1. Create feature branch → open PR to `main`
2. CI runs **lint + typecheck + test + build** (all must pass)
3. Azure SWA deploys PR preview environment automatically
4. Code review + CI green → merge
5. PR close → Azure cleans up preview
6. Release: push `v*.*.*` tag → triggers macOS + Windows build → publishes to GitHub Releases

## ANTI-PATTERNS

- **No `as any`** — zero instances in the codebase. Do not add.
- **No `@ts-expect-error`** — do not add.
- **Preload has `@ts-ignore`**: `src/preload/index.ts` lines 19/21 — inherited scaffold fallback. Do not add more.
- **No manual `localStorage` in Zustand stores** — use `persist` middleware with `hhcPersistStorage`. Direct `localStorage.getItem/setItem` in store actions is forbidden.
- **`sandbox: false`** in BrowserWindow — security risk. Evaluate enabling when adding real features.
- **Placeholder update URL**: `electron-builder.yml` and `dev-app-update.yml` publish to `https://example.com/auto-updates`. Replace before release.
- **appId is generic**: `com.electron.app` in electron-builder.yml. Change before distribution.

## PROJECT-SPECIFIC NOTES

- **electron-vite** (not raw Vite or Webpack) — use `electron-vite` CLI for dev/build
- **Typecheck split**: `npm run typecheck` runs two separate `tsc` passes (node + web)
- **HashRouter**: `createHashRouter` for Electron file:// compatibility
- **HeroUI v3**: Component library (react-aria-components based). API differs from v2 — check node_modules or use MCP.
- **No pre-commit hooks**: Lint/format are manual (`npm run lint`, `npm run format`).
- **Vitest**: jsdom environment, `globals: true`. Run with `npx vitest run`.
- **`out/` is gitignored**: Compiled outputs regenerate on build.
- **Mac build skips typecheck**: `build:mac` runs `electron-vite build` directly — intentional.
- **PresetChips right-click**: Intentionally bypasses ContextMenu system — right-click directly removes preset without confirmation menu. This is by design for quick interaction.
- **Context menu**: Generic infrastructure in `ContextMenuContext` + `ContextMenuOverlay`. Domain-specific hooks use `createFolderContextMenu` factory. See `useBibleContextMenu`/`useFolderContextMenu` for patterns.
- **Deletion flow design — two different paths by store**:
  - **`useBibleFolderStore`** (Bible): `cleanupExpired()` on startup → **direct hard delete** based on `expiresAt`. No trash UI, no soft-delete user flow. Bible context menu calls `removeItem()` / `deleteFolder()` (hard delete).
  - **`useFileExplorerStore`** (Files): `softDeleteExpired()` on startup → moves expired items to **trash** (sets `deletedAt`). Then `purgeTrash(retentionDays × ms)` permanently deletes from IDB after retention period. Users can recover items from `/trash` before purge. Do **not** call `cleanupExpired()` for File Explorer — it bypasses trash and hard-deletes directly.

## COMMANDS

```bash
npm install              # Install deps (postinstall runs electron-builder install-app-deps)
npm run dev              # Start electron-vite dev server with HMR
npm run build            # Typecheck + electron-vite build
npm run build:mac        # Build + package for macOS
npm run build:win        # Build + package for Windows
npm run build:linux      # Build + package for Linux
npm run typecheck        # Run both node + web typechecks
npm run lint             # ESLint (cached)
npm run format           # Prettier --write .
npx vitest run           # Run all tests
```
