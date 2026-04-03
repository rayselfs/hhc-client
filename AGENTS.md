# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-03
**Commit:** 1d5f618
**Branch:** main

## OVERVIEW

Electron desktop app for church projection (`hhc-client`). React 19 + TypeScript + Vite via `electron-vite`. Early stage — mostly scaffold, ~275 lines of application code.

## STRUCTURE

```
hhc-client-v2/
├── src/
│   ├── main/           # Electron main process (single file: index.ts)
│   ├── preload/        # Context bridge — exposes electron API to renderer
│   ├── renderer/src/   # React app (Vite entry: main.tsx → App.tsx)
│   │   ├── assets/     # CSS + SVG
│   │   └── components/ # React components (currently only Versions.tsx)
│   └── shared/         # Cross-process utilities (env detection)
├── build/              # Packaging assets (icons, mac entitlements)
├── resources/          # App resources (icon.png, bundled in asar)
└── out/                # Compiled main/preload output (gitignored)
```

**Double-src nesting**: Renderer lives at `src/renderer/src/` — this is the electron-vite default. The `@renderer` alias resolves here.

## WHERE TO LOOK

| Task                           | Location                                        | Notes                                        |
| ------------------------------ | ----------------------------------------------- | -------------------------------------------- |
| Main process / window creation | `src/main/index.ts`                             | BrowserWindow config, IPC handlers           |
| Expose API to renderer         | `src/preload/index.ts`                          | contextBridge; update `index.d.ts` for types |
| UI / React components          | `src/renderer/src/`                             | Entry: `main.tsx` → `App.tsx`                |
| Shared cross-process logic     | `src/shared/`                                   | `env.ts` for isElectron/isDev detection      |
| Path alias config              | `electron.vite.config.ts` + `tsconfig.web.json` | Keep `@renderer` alias in sync between both  |
| Packaging / installers         | `electron-builder.yml`                          | Win/Mac/Linux targets                        |
| Auto-update config             | `dev-app-update.yml`                            | Provider URL is placeholder — must replace   |

## CONVENTIONS

### Code Style (enforced by tooling)

- **No semicolons** — Prettier `semi: false`
- **Single quotes** — `singleQuote: true`
- **Print width**: 100
- **No trailing commas** — `trailingComma: none`
- **Indent**: 2 spaces (editorconfig)

### TypeScript

- Separate tsconfigs: `tsconfig.node.json` (main/preload/shared) and `tsconfig.web.json` (renderer)
- Both extend `@electron-toolkit/tsconfig`
- `jsx: react-jsx` in web config
- Path alias: `@renderer/*` → `src/renderer/src/*`

### ESLint

- Flat config (`eslint.config.mjs`)
- `@electron-toolkit` TS + Prettier configs
- React hooks + React Refresh plugins for `.ts/.tsx`

### Imports

- Renderer uses `@renderer/...` alias (resolve in both Vite and tsconfig)
- Cross-process imports use relative paths (e.g., `../../../shared/env`)

## ANTI-PATTERNS (THIS PROJECT)

- **Preload has `@ts-ignore`**: `src/preload/index.ts` lines 19/21 — fallback path when `contextIsolated` is false. Inherited from scaffold; do not add more `@ts-ignore`.
- **No `as any`** except the existing `(window as any).electron` check in `src/shared/env.ts` — avoid adding more.
- **Placeholder update URL**: `electron-builder.yml` and `dev-app-update.yml` publish to `https://example.com/auto-updates` — not functional. Replace before release.
- **`sandbox: false`** in BrowserWindow — security risk. Evaluate enabling sandbox when adding real features.

## UNIQUE STYLES

- **electron-vite** (not raw Vite or Webpack) — use `electron-vite` CLI for dev/build, not `vite` directly
- **Typecheck split**: `npm run typecheck` runs two separate `tsc` passes (node + web) with `--composite false` override
- **No router**: Single-page app with no react-router. Add routing when needed.
- **No test framework**: No jest/vitest/playwright configured. When adding, use Vitest (matches Vite stack).
- **No CI**: No GitHub Actions or other CI pipelines. Builds are local.
- **No pre-commit hooks**: Lint/format are manual (`npm run lint`, `npm run format`).

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
```

## NOTES

- **IPC test**: Main has `ipcMain.on('ping')` and App.tsx sends it — scaffold example, not production code.
- **Versions component**: Displays Electron/Chromium/Node versions using `window.electron.process.versions` with `isElectron()` guard.
- **`out/` is gitignored**: Compiled outputs regenerate on build. Don't rely on committed `out/` contents.
- **Mac build skips typecheck**: `build:mac` runs `electron-vite build` directly (no `npm run typecheck`). This is intentional per scaffold but may want to add typecheck for CI.
- **electron v39 + electron-builder v26**: Check compatibility before major upgrades.
- **appId is generic**: `com.electron.app` in electron-builder.yml — change to a proper reverse-domain ID before distribution.
