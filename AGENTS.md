# PROJECT KNOWLEDGE BASE

**Updated:** 2026-04-11
**Commit:** 3e3833c
**Branch:** main

## OVERVIEW

Electron desktop app for church projection (`hhc-client`). React 19 + TypeScript + Vite via `electron-vite`. Dual-window architecture: main window (sidebar + pages) + projection window (fullscreen display). **Dual-mode**: runs in both Electron (IPC) and browser (BroadcastChannel/Web Worker) environments.

## STRUCTURE

```
hhc-client-v2/
├── src/
│   ├── main/                # Electron main process
│   │   ├── index.ts         # App lifecycle, WindowManager integration
│   │   ├── windowManager.ts # Singleton: main + projection window management
│   │   ├── timerService.ts  # Main-process timer broadcast service
│   │   └── ipc/             # IPC handler registration
│   │       ├── projection.ts
│   │       ├── timer.ts
│   │       └── validate.ts  # Centralized sender validation
│   ├── preload/             # Context bridge — exposes electron API to renderer
│   │   ├── index.ts
│   │   └── index.d.ts      # Window.electron + Window.api type declarations
│   └── renderer/src/        # React app (Vite entry: main.tsx → App.tsx)
│       ├── components/      # Layout, Sidebar, Header, Timer/, projection/, Preferences/
│       ├── contexts/        # ThemeContext, TimerEngineContext, ProjectionContext, ContextMenuContext
│       ├── lib/             # env.ts, projection-adapter.ts, timer-adapter.ts, utils, etc.
│       ├── stores/          # Zustand: timer.ts, stopwatch.ts, settings.ts, selectors/
│       ├── workers/         # timer.worker.ts (Web Worker for browser-mode tick)
│       ├── pages/           # TimerPage, BiblePage, ProjectionPage, WelcomePage
│       ├── i18n/            # react-i18next setup
│       ├── locales/         # en.json, zh-TW.json, zh-CN.json
│       ├── types/           # Theme types
│       └── assets/          # CSS + SVG
├── build/                   # Packaging assets (icons, mac entitlements)
├── resources/               # App resources (icon.png, bundled in asar)
└── out/                     # Compiled main/preload output (gitignored)
```

**Double-src nesting**: Renderer lives at `src/renderer/src/` — electron-vite default. The `@renderer` alias resolves here.

## WHERE TO LOOK

| Task                           | Location                                           | Notes                                                      |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------------------------- |
| Main process / window creation | `src/main/index.ts` + `windowManager.ts`           | WindowManager singleton manages both windows               |
| IPC handlers                   | `src/main/ipc/`                                    | projection.ts, timer.ts, validate.ts                       |
| Timer main-process service     | `src/main/timerService.ts`                         | Broadcasts timer state to projection window                |
| Expose API to renderer         | `src/preload/index.ts`                             | contextBridge; update `index.d.ts` for types               |
| UI / React components          | `src/renderer/src/components/`                     | Timer/, projection/, Preferences/, Layout, etc.            |
| Timer engine (adapter bridge)  | `src/renderer/src/contexts/TimerEngineContext.tsx` | Bridges adapter ↔ Zustand stores                           |
| Timer adapter (dual-mode)      | `src/renderer/src/lib/timer-adapter.ts`            | BrowserTimerAdapter (Worker) vs ElectronTimerAdapter (IPC) |
| Timer Worker                   | `src/renderer/src/workers/timer.worker.ts`         | setInterval(100ms) tick loop for browser mode              |
| Projection messaging           | `src/renderer/src/lib/projection-adapter.ts`       | Electron IPC or BroadcastChannel adapter                   |
| Environment detection          | `src/renderer/src/lib/env.ts`                      | `isElectron()` / `isWeb()` — renderer only                 |
| State (Zustand)                | `src/renderer/src/stores/`                         | timer.ts, stopwatch.ts, settings.ts, selectors/            |
| Theme system                   | `src/renderer/src/contexts/ThemeContext.tsx`       | Dark/light/system, syncs with Electron nativeTheme         |
| Routing                        | `src/renderer/src/router.tsx`                      | HashRouter; `/projection` is outside Layout                |
| Path alias config              | `electron.vite.config.ts` + `tsconfig.web.json`    | Keep `@renderer` alias in sync between both                |
| CSP policy                     | `src/renderer/index.html`                          | Affects web mode only; Electron is lenient                 |
| Packaging / installers         | `electron-builder.yml`                             | Win/Mac/Linux targets                                      |

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

## ANTI-PATTERNS

- **No `as any`** — zero instances in the codebase. Do not add.
- **No `@ts-expect-error`** — do not add.
- **Preload has `@ts-ignore`**: `src/preload/index.ts` lines 19/21 — inherited scaffold fallback. Do not add more.
- **`sandbox: false`** in BrowserWindow — security risk. Evaluate enabling when adding real features.
- **Placeholder update URL**: `electron-builder.yml` and `dev-app-update.yml` publish to `https://example.com/auto-updates`. Replace before release.
- **appId is generic**: `com.electron.app` in electron-builder.yml. Change before distribution.

## PROJECT-SPECIFIC NOTES

- **electron-vite** (not raw Vite or Webpack) — use `electron-vite` CLI for dev/build
- **Typecheck split**: `npm run typecheck` runs two separate `tsc` passes (node + web)
- **HashRouter**: `createHashRouter` for Electron file:// compatibility
- **HeroUI v3**: Component library (react-aria-components based). API differs from v2 — check node_modules or use MCP.
- **No CI**: Builds are local. No GitHub Actions.
- **No pre-commit hooks**: Lint/format are manual (`npm run lint`, `npm run format`).
- **Vitest**: jsdom environment, `globals: true`. Run with `npx vitest run`.
- **`out/` is gitignored**: Compiled outputs regenerate on build.
- **Mac build skips typecheck**: `build:mac` runs `electron-vite build` directly — intentional.

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
