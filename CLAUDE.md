# CLAUDE.md - Electron + Vue 3 Project

## Core Tech & Architecture

- **Stack**: Electron 38, Vue 3 (Composition API), TS 5, Pinia, Vuetify 3.
- **Storage**: IndexedDB (via `idb`), LocalStorage, `fs-extra` (Main process).
- **Windows**: Main (`/`) and Projection (`/projection`). Communication via IPC `MessageType`.
- **Services**: `src/services/` for business logic; `src/stores/` for state.

## Critical Commands

- **Dev/Build**: `npm run dev`, `npm run build`
- **Quality**: `npm run lint`, `npm run format`, `npm run type-check`, `npm run test:unit`
- **Release**: `npm run electron:build:[mac-arm|mac-intel|win]`

## Style & Patterns

- **TS**: Strict typing (no `any`). Use `PascalCase` for Interfaces (no `I` prefix) and Enums.
- **Naming**: `PascalCase.vue` for components; `kebab-case.ts` for others.
- **Vue**: Use `<script setup lang="ts">`. Scoped SCSS with CSS variables.
- **Error Handling**: Always wrap Async/IPC in `try/catch` with `reportError`.
- **Stores**: Use Setup Store pattern. Use `uuidv4()` for IDs.

## Resource Map

- **Components**: `src/components/`, `src/layouts/`
- **Logic/Types**: `src/services/`, `src/types/` (Check `common.ts` for IPC)
- **State**: `src/stores/`
