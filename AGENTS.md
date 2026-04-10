# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-08
**Commit:** bd64918
**Branch:** main

## OVERVIEW

Electron desktop app for church projection (`hhc-client`). React 19 + TypeScript + Vite via `electron-vite`. Dual-window architecture: main window (sidebar + pages) + projection window (fullscreen display). Supports both Electron (IPC) and browser (BroadcastChannel) environments.

## STRUCTURE

```
hhc-client-v2/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # App lifecycle, WindowManager integration
│   │   ├── windowManager.ts # Singleton: main + projection window management
│   │   └── ipc/           # IPC handler registration
│   │       └── projection.ts
│   ├── preload/           # Context bridge — exposes electron API to renderer
│   │   ├── index.ts
│   │   └── index.d.ts     # Window.electron + Window.api type declarations
│   └── renderer/src/      # React app (Vite entry: main.tsx → App.tsx)
│       ├── components/    # Layout.tsx (sidebar + header + close btn), Sidebar.tsx
│       ├── contexts/      # ThemeContext (dark/light/system)
│       ├── hooks/         # useProjection (open/close/send/on)
│       ├── i18n/          # react-i18next setup
│       ├── lib/           # env.ts (isElectron/isWeb), projection-adapter.ts
│       ├── locales/       # en.json, zh-TW.json, zh-CN.json
│       ├── pages/         # TimerPage, BiblePage, ProjectionPage
│       ├── router.tsx     # HashRouter: Layout wraps Timer/Bible; Projection is standalone
│       ├── types/         # Theme types
│       └── assets/        # CSS + SVG
├── build/                 # Packaging assets (icons, mac entitlements)
├── resources/             # App resources (icon.png, bundled in asar)
└── out/                   # Compiled main/preload output (gitignored)
```

**Double-src nesting**: Renderer lives at `src/renderer/src/` — this is the electron-vite default. The `@renderer` alias resolves here.

## WHERE TO LOOK

| Task                           | Location                                        | Notes                                              |
| ------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| Main process / window creation | `src/main/index.ts` + `windowManager.ts`        | WindowManager singleton manages both windows       |
| IPC handlers                   | `src/main/ipc/projection.ts`                    | Projection lifecycle + messaging IPC               |
| Expose API to renderer         | `src/preload/index.ts`                          | contextBridge; update `index.d.ts` for types       |
| UI / React components          | `src/renderer/src/`                             | Entry: `main.tsx` → `App.tsx` → `router.tsx`       |
| Projection messaging           | `src/renderer/src/lib/projection-adapter.ts`    | Electron IPC or BroadcastChannel adapter           |
| Projection hook                | `src/renderer/src/hooks/useProjection.ts`       | `{ isProjectionOpen, openProjection, send, on }`   |
| Environment detection          | `src/renderer/src/lib/env.ts`                   | `isElectron()` / `isWeb()` — renderer only         |
| Theme system                   | `src/renderer/src/contexts/ThemeContext.tsx`    | Dark/light/system, syncs with Electron nativeTheme |
| Routing                        | `src/renderer/src/router.tsx`                   | HashRouter; `/projection` is outside Layout        |
| Path alias config              | `electron.vite.config.ts` + `tsconfig.web.json` | Keep `@renderer` alias in sync between both        |
| Packaging / installers         | `electron-builder.yml`                          | Win/Mac/Linux targets                              |
| Auto-update config             | `dev-app-update.yml`                            | Provider URL is placeholder — must replace         |

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

### Imports

- Renderer uses `@renderer/...` alias (resolve in both Vite and tsconfig)
- Main/preload use relative paths

## STATE MANAGEMENT

### Context vs Zustand Rule

- **Context** (`src/renderer/src/contexts/`): Non-serializable services and imperative environment integration. Manages long-lived adapters, window handles, DOM side-effects (theme sync). Never stores plain business data.
- **Zustand** (`src/renderer/src/stores/`): Serializable app/domain state. Timer config, timer runtime, stopwatch, app settings. Consumed by multiple components via selectors.
- **If a context starts looking like plain state + setters, move it to a Zustand store.**

## ANTI-PATTERNS (THIS PROJECT)

- **Preload has `@ts-ignore`**: `src/preload/index.ts` lines 19/21 — fallback path when `contextIsolated` is false. Inherited from scaffold; do not add more `@ts-ignore`.
- **No `as any`** — zero instances in the codebase. Do not add.
- **No `@ts-expect-error`** — do not add.
- **Placeholder update URL**: `electron-builder.yml` and `dev-app-update.yml` publish to `https://example.com/auto-updates` — not functional. Replace before release.
- **`sandbox: false`** in BrowserWindow — security risk. Evaluate enabling sandbox when adding real features.
- **Old shadcn UI files**: `src/renderer/src/components/ui/` has leftover components with broken imports (class-variance-authority, @radix-ui). Not in use — ignore or delete.

## UNIQUE STYLES

- **electron-vite** (not raw Vite or Webpack) — use `electron-vite` CLI for dev/build, not `vite` directly
- **Typecheck split**: `npm run typecheck` runs two separate `tsc` passes (node + web) with `--composite false` override
- **HashRouter**: Uses `createHashRouter` for Electron file:// compatibility
- **HeroUI v3**: Component library (react-aria-components based). API differs significantly from v2 — use MCP or check node_modules.
- **Dual-mode messaging**: `projection-adapter.ts` abstracts Electron IPC vs BroadcastChannel. All messaging goes through this adapter.
- **No CI**: No GitHub Actions or other CI pipelines. Builds are local.
- **No pre-commit hooks**: Lint/format are manual (`npm run lint`, `npm run format`).
- **Vitest**: Configured with jsdom environment, `globals: true`. Run with `npx vitest run`.

## COMMANDS

```bash
npm install              # Install deps (postinstall runs electron-builder install-app-deps)
npm run dev              # Start electron-vite dev server with HMR
npm run build            # Typecheck + electron-vite build
npm run build:mac        # Build + package for macOS (no typecheck — intentional)
npm run build:win        # Build + package for Windows
npm run build:linux      # Build + package for Linux
npm run typecheck        # Run both node + web typechecks
npm run lint             # ESLint (cached)
npm run format           # Prettier --write .
npx vitest run           # Run all tests
```

## ARCHITECTURE: DUAL-WINDOW PROJECTION

### Window Lifecycle

- App opens → main window + projection window created together (WindowManager)
- Close main window → projection window closes too
- Projection can be independently closed/reopened via `useProjection` hook

### Messaging Flow

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

### Key Interfaces

- **ProjectionAdapter**: `send(channel, data)`, `on(channel, handler)`, `dispose()`
- **useProjection hook**: `{ isProjectionOpen, openProjection, closeProjection, send, on }`
- **Preload ProjectionAPI**: `check`, `ensure`, `close`, `send`, `sendToMain`, `getDisplays`, `onProjectionMessage`, `onProjectionOpened`, `onProjectionClosed`

## MIGRATION CONTEXT

This project is a **fresh rewrite** of `hhc-client` (Vue 3 + Vuetify + Electron) → React 19 + electron-vite.

### Related Repositories

| Repo                  | Path                      | Role                                                                                                    |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `hhc-client`          | `../hhc-client/`          | **Original** — Vue 3 production app. Reference for features, types, styles, i18n, Electron main process |
| `hhc-client-refactor` | `../hhc-client-refactor/` | **Abandoned mid-migration** — Do NOT use as codebase. Migration plan is still useful as reference       |

### Migration Plan

`../hhc-client-refactor/.sisyphus/plans/hhc-client-refactor.md` — Detailed plan covering Timer page migration (all 4 modes), LiquidGlass theme porting, dual-mode architecture (Electron IPC + Browser fallback), Electron main process optimization, and TDD strategy. Written for `hhc-client-refactor` but the analysis of the original codebase and migration decisions apply here.

### Key Migration References in `../hhc-client/`

| What                     | Where                                                 | Notes                                                                 |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Timer types & state      | `src/types/timer.ts`                                  | TimerMode, TimerState, TimerPreset — port with ISO string dates       |
| Projection messages      | `src/types/projection.ts`                             | MessageType enum, AppMessage union — exclude BIBLE*\*/MEDIA*\*        |
| LiquidGlass theme values | `src/components/LiquidGlass/styles/theme/defaults.ts` | ALL color/glass/gradient tokens                                       |
| Glass SCSS mixins        | `src/components/LiquidGlass/styles/_mixins.scss`      | glass-surface, shine, jelly-pop animations                            |
| Timer store (Pinia)      | `src/stores/timer.ts`                                 | Business logic to port to Zustand                                     |
| Stopwatch store          | `src/stores/stopwatch.ts`                             | Stopwatch state machine                                               |
| Electron timerService    | `electron/timerService.ts`                            | Has broadcast bug (lastBroadcastTime never updated) — fix during port |
| i18n locales             | `src/locales/{en,zh-TW,zh-CN}.json`                   | Extract timer + common keys only                                      |
| Dark mode                | `src/composables/useDarkMode.ts`                      | Port to React hook                                                    |

### Migration Decisions (from plan)

- **Scope**: Timer page only (all 4 modes: TIMER, CLOCK, BOTH, STOPWATCH). Bible/Media are OUT for now
- **Dual-mode**: Must work in both Electron (IPC) and web browser (BroadcastChannel fallback)
- **Styling**: LiquidGlass visual identity preserved via Tailwind CSS — no Vuetify
- **Icons**: lucide-react only — no @mdi/font or FontAwesome
- **State**: Zustand (not Pinia)
- **i18n**: react-i18next (not vue-i18n), 3 languages: en, zh-TW, zh-CN
- **Testing**: Vitest + RTL + Playwright, TDD approach
- **Known bugs to fix**: timerService broadcast bug, duplicate types between renderer and electron

## NOTES

- **IPC test**: Main has `ipcMain.on('ping')` and App.tsx sends it — scaffold example, not production code.
- **`out/` is gitignored**: Compiled outputs regenerate on build. Don't rely on committed `out/` contents.
- **Mac build skips typecheck**: `build:mac` runs `electron-vite build` directly (no `npm run typecheck`). This is intentional per scaffold but may want to add typecheck for CI.
- **electron v39 + electron-builder v26**: Check compatibility before major upgrades.
- **appId is generic**: `com.electron.app` in electron-builder.yml — change to a proper reverse-domain ID before distribution.
- **Sample demo**: TimerPage has a text input that sends messages to ProjectionPage — demonstrates the messaging infrastructure. Not production code.
