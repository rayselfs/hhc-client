# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Status

- [ ] Task Path: .claudecode/current_task.md
- [ ] Plan Path: .claudecode/current_plan.md

## Project Overview

HHC Client is a desktop application for churches built with Electron + Vue 3 + TypeScript. It provides timer, Bible reader, and media projection features with a two-window architecture: a main control window and a secondary projection window.

## Common Commands

```bash
npm run dev              # Start development (Vite + Electron)
npm run build            # Type-check and build for production
npm run type-check       # Run vue-tsc type checking
npm run test:unit        # Run Vitest unit tests
npm run lint             # Run ESLint with auto-fix
npm run format           # Format src/ with Prettier

# Platform-specific builds
npm run electron:build:mac-arm       # macOS Apple Silicon
npm run electron:build:mac-intel     # macOS Intel
npm run electron:build:mac-universal # macOS Universal
npm run electron:build:win           # Windows x64
```

## Architecture

### Two-Window Design

The app runs two browser windows managed by `electron/windowManager.ts`:

- **Main Window** (1200x800): Control interface at route `/`
- **Projection Window**: Full-screen display on secondary monitor at route `/projection`

Windows communicate via IPC messages using a standardized `MessageType` enum (defined in `src/types/common.ts`).

### Electron Main Process (`electron/`)

| File               | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `main.ts`          | Entry point, initializes all services             |
| `windowManager.ts` | Singleton managing both windows                   |
| `timerService.ts`  | Timer logic running at 60Hz, broadcasts via IPC   |
| `preload.ts`       | Context bridge exposing safe APIs to renderer     |
| `file.ts`          | File operations with `local-resource://` protocol |
| `api.ts`           | Bible API proxy with streaming support            |
| `handlers.ts`      | Display detection, message routing, locale        |

### Vue Renderer (`src/`)

**Key Directories:**

- `views/` - HomeView (main) and ProjectionView
- `layouts/control/` - BibleControl, TimerControl, MediaControl
- `layouts/projection/` - BibleProjection, TimerProjection, MediaProjection
- `stores/` - Pinia stores (bible, timer, media, folder, projection, etc.)
- `composables/` - Reusable logic hooks (30+ composables)
- `services/media/` - FileSystemProvider pattern with Local/Web implementations
- `types/` - TypeScript definitions including `electron.d.ts` for IPC typing

**Path Alias:** `@/*` maps to `./src/*`

### IPC Communication

Renderer uses `window.electronAPI` (typed in `src/types/electron.d.ts`) for:

- **Invoke** (request/response): file ops, Bible API, projection management
- **Send** (one-way): `send-to-projection`, `send-to-main`
- **On** (listeners): `timer-tick`, `projection-message`, `main-message`

### State Synchronization

Main window broadcasts state to projection via debounced messages. When projection opens, it requests full state via `SYSTEM_GET_STATE` message.

### File System

Uses provider pattern (`src/services/media/`):

- `LocalProvider.ts` - Electron file access via `local-resource://` protocol
- `WebProvider.ts` - Browser File System Access API fallback
- Factory: `useFileSystemFactory()` composable

### Data Storage

- **IndexedDB** (`useIndexedDB.ts`): Bible content and search indices
- **localStorage** (`useLocalStorage.ts`): Settings and folder structure
- **Search**: FlexSearch for Bible full-text search (`useFlexSearch.ts`)

## Environment

Requires `.env` file:

```bash
VITE_BIBLE_API_HOST=http://localhost:8080
```

## Code Style

- Vue 3 Composition API with `<script setup lang="ts">`
- Vuetify 3 for UI components (auto-imported)
- ESLint flat config with Vue + TypeScript + Prettier
- Tests in `src/**/__tests__/` using Vitest + jsdom
