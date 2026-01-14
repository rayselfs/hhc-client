<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md

This file provides guidance for agentic coding agents operating in this repository.

## Project Overview

HHC Client is a desktop application for churches built with Electron + Vue 3 + TypeScript. It provides timer, Bible reader, and media projection features with a two-window architecture: a main control window and a secondary projection window.

## Build Commands

```bash
npm run dev              # Start development (Vite + Electron)
npm run build            # Type-check and build for production
npm run type-check       # Run vue-tsc type checking
npm run preview          # Preview production build
npm run electron:build:mac-arm       # macOS Apple Silicon build
npm run electron:build:mac-intel     # macOS Intel build
npm run electron:build:mac-universal # macOS Universal build
npm run electron:build:win           # Windows x64 build
```

## Linting & Formatting

```bash
npm run lint             # Run ESLint with auto-fix
npm run format           # Format src/ with Prettier
```

## Testing

```bash
npm run test:unit        # Run all Vitest unit tests
npx vitest run src/stores/timer.test.ts  # Run single test file
npx vitest run -t "test name"            # Run tests matching pattern
```

## Code Style Guidelines

### General

- Vue 3 Composition API with `<script setup lang="ts">`
- Vuetify 3 for UI components (auto-imported)
- ESLint flat config with Vue + TypeScript + Prettier
- Tests in `src/**/__tests__/` using Vitest + jsdom

### Imports

Organize imports in this order with blank lines between groups:

1. Vue/Vue Router/Pinia core imports
2. Third-party library imports
3. Path alias imports (`@/types/*`, `@/stores/*`, `@/composables/*`, etc.)

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { TimerMode } from '@/types/common'
import { useStopwatchStore } from '@/stores/stopwatch'
```

### TypeScript

- Use explicit types for function parameters and return values
- Use interfaces for object shapes, types for unions/primitives
- Avoid `any`; use `unknown` when type is truly unknown

```typescript
interface TimerSettings {
  mode: TimerMode
  timerDuration: number // seconds
  remainingTime: number // seconds
}

type TimerStatus = 'stopped' | 'running' | 'paused'
```

### Naming Conventions

- **Variables/functions**: camelCase (`timerDuration`, `isRunning`)
- **Constants**: SCREAMING_SNAKE_CASE (`TIMER_CONFIG.MAX_PRESETS`)
- **Classes/Interfaces**: PascalCase (`TimerSettings`, `FolderItem`)
- **Enums**: PascalCase with SCREAMING_SNAKE_CASE values
- **Files**: kebab-case (`timer-store.ts`, `use-local-storage.ts`)
- **Vue components**: PascalCase (`CountdownTimer.vue`)
- **Composables**: camelCase with `use` prefix (`useLocalStorage`)

### Error Handling

Wrap IPC calls and async operations in try/catch with Sentry reporting:

```typescript
try {
  await timerInitialize({...})
} catch (error) {
  reportError(error, {
    operation: 'initialize-timer-ipc',
    component: 'TimerStore',
  })
}
```

### Vue Components

Use `withDefaults(defineProps<Props>(), {...})` for optional props:

```typescript
interface Props {
  progress: number
  timerFormattedTime: string
  size: number
  displayText?: boolean
  isWarning?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  displayText: true,
  isWarning: false,
})
```

### Stores (Pinia)

Use setup store pattern with `defineStore`:

```typescript
export const useTimerStore = defineStore('timer', () => {
  const isRunning = computed(() => state.value === 'running')
  return { isRunning }
})
```

### CSS/SCSS

- Use scoped styles
- Use CSS variables defined in theme
- Avoid hardcoded colors; use `var(--variable-name)`

```scss
.timer-display .progress-ring-fg {
  stroke: var(--timer-progress-ring-color);
  stroke-linecap: round;
}
```

### IPC Communication

Use `window.electronAPI` (typed in `src/types/electron.d.ts`):

- **Invoke** (request/response): file ops, Bible API, projection management
- **Send** (one-way): `send-to-projection`, `send-to-main`
- **On** (listeners): `timer-tick`, `projection-message`, `main-message`

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

### Path Alias

`@/*` maps to `./src/*` for cleaner imports.

## Architecture Notes

- **Two-Window Design**: Main Window (1200x800) at `/`, Projection Window full-screen at `/projection`
- **IPC Communication**: Windows communicate via `MessageType` enum
- **File System**: Provider pattern (`LocalProvider.ts` / `WebProvider.ts`)
- **Data Storage**: IndexedDB (Bible), localStorage (settings), FlexSearch (search)
