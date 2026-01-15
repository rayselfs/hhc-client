# CLAUDE.md

> **Note**: This file provides high-level context and guidelines for Claude Code to work effectively in this repository.

## Commands

- **Development**: `npm run dev` (Vite + Electron)
- **Build**: `npm run build` (Type-check + Build)
- **Test**: `npm run test:unit` (Vitest)
- **Lint/Fix**: `npm run lint` (ESLint auto-fix)
- **Format**: `npm run format` (Prettier)
- **Type Check**: `npm run type-check` (vue-tsc)
- **Platform Builds**:
  - Mac (Apple Silicon): `npm run electron:build:mac-arm`
  - Mac (Intel): `npm run electron:build:mac-intel`
  - Windows: `npm run electron:build:win`

## Tech Stack

- **Runtime**: Electron 38 + Node.js 20+
- **Frontend**: Vue 3 (Composition API), TypeScript 5, Vite 7
- **UI Framework**: Vuetify 3 (Material Design 3)
- **State Management**: Pinia (Setup Stores)
- **Data Storage**:
  - **IndexedDB**: Bible content, Search Indices, Folder/File structure (`idb` wrapper)
  - **LocalStorage**: User preferences, simple settings
  - **Filesystem**: `fs-extra` (Electron main process only)
- **Icons**: MDI (@mdi/font), FontAwesome
- **I18n**: vue-i18n (en, zh-TW, zh-CN)
- **Error Tracking**: Sentry (Main & Renderer)
- **Updates**: electron-updater
- **Fonts**: @fontsource-variable (Local, no CDN)

## Environment Variables (.env)

- `VITE_BIBLE_API_HOST`: URL for Bible API (Default: `https://www.alive.org.tw`)
- `SENTRY_DSN` / `VITE_SENTRY_DSN`: Sentry DSN for error tracking
- `VITE_SENTRY_ENABLED`: Set to `true` to enable Sentry in development

## Project Architecture

### Window Management (`electron/windowManager.ts`)

- **Main Window**: Control interface (`/`)
- **Projection Window**: Secondary display (`/projection`)
- **Communication**: Strict IPC via `MessageType` enum.

### Data Flow

1. **Providers**: `services/filesystem/` implements `LocalProvider` & `WebProvider`.
2. **Stores**: Pinia stores manage business logic and sync with DB.
3. **IPC**:
   - **Renderer -> Main**: `window.electronAPI.invoke(channel, data)`
   - **Main -> Renderer**: `mainWindow.webContents.send(channel, data)`

### Key Directories

### Key Directories

- `src/layouts/control/`: Main window panels (Bible, Timer, Media)
- `src/layouts/projection/`: Projection window views
- `src/services/`: Business logic independent of UI (e.g., FileSystem, BibleAPI)
- `src/types/`: Shared TypeScript definitions (Crucial: `common.ts` for IPC messages)

### File Organization

```
src/
├── components/     # Reusable Vue components
├── composables/    # Reusable logic hooks (30+ composables)
├── layouts/        # Control and projection layouts
├── stores/         # Pinia stores
├── views/          # Page views
├── types/          # TypeScript definitions
├── services/       # Business logic services
├── utils/          # Utility functions
└── config/         # App configuration
```

## Code Style Guidelines

### TypeScript & Naming

- **Strict Typing**: Avoid `any`. Use `unknown` or specific interfaces.
- **Interfaces**: PascalCase, define in `src/types/`. NO `I` prefix (e.g., `FolderItem`).
- **Enums**: PascalCase name, SCREAMING_SNAKE_CASE values.
- **File Naming**:
  - Vue Components: `PascalCase.vue` (e.g., `MediaItem.vue`)
  - TS Files/Composables: `kebab-case.ts` (e.g., `timer-store.ts`, `use-folder.ts`)
- **Variables/Functions**: camelCase.
- **Import Order**:
  1. Vue/Pinia core
  2. 3rd party libs
  3. Alias (`@/...`)

### Vue Components

- **Syntax**: `<script setup lang="ts">`.
- **Props**: Use `interface Props` with `withDefaults`.
- **Error Handling**: Wrap Async/IPC calls in regex `try/catch` and use `reportError`.
  ```typescript
  try {
    await ipcCall()
  } catch (e) {
    reportError(e, { component: 'Name', operation: 'op' })
  }
  ```

### Styling (SCSS)

- **Scoped**: Always use `<style scoped>`.
- **Variables**: Use CSS variables (e.g., `var(--folder-bg)`) over hardcoded hex colors.
- **Vuetify**: Use utility classes for layout/spacing first (e.g., `d-flex pa-4`).

### Data & State

- **ID Generation**: Use `uuidv4()` for all IDs (Files, Folders).
- **Store Pattern**: Use Setup Stores (`defineStore('id', () => { ... })`).

## Definition of Done

1. **Type Check**: No TypeScript errors (`npm run type-check`).
2. **Lint**: No ESLint warnings (`npm run lint`).
3. **Tests**: Unit tests pass if logic was touched.
4. **Build**: `npm run build` succeeds.
