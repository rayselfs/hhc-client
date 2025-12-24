# Composables Documentation

This document outlines the usage rules and best practices for key composables in the project.

## useElectron

**Path**: `src/composables/useElectron.ts`

**Purpose**: 
The primary entry point for all Electron Inter-Process Communication (IPC) and environment-specific logic. It abstracts `window.electronAPI` calls and provides safe fallbacks or error handling.

**Key Methods**:
- **Environment Check**: 
    - `isElectron()`: Returns `true` if running in Electron.
- **Window Management**:
    - `checkProjectionWindow()`: Checks if the projection window is open.
    - `ensureProjectionWindow()`: Opens the projection window if closed.
    - `closeProjectionWindow()`: Closes the projection window.
    - `getDisplays()`: Returns available displays.
- **Messaging**:
    - `sendToProjection(data)`: Sends `AppMessage` to the projection window.
    - `sendToMain(data)`: Sends `AppMessage` to the main process.
    - `onMainMessage(callback)` / `onProjectionMessage(callback)`: Event listeners.
- **File System**:
    - `getFilePath(file)`: Gets the absolute path of a file object.
    - `saveFile(sourcePath)`: Saves a file to the persistent user data directory.
- **Feature APIs**:
    - **Timer**: `timerCommand`, `timerInitialize`, `onTimerTick`.
    - **Bible**: `getBibleVersions`, `getBibleContent`, `searchBibleVerses`.
    - **System**: `updateLanguage`, `getSystemLocale`, `resetUserData`.

**Rules**:
- **ALWAYS** use `useElectron` for any IPC calls. Do NOT access `window.electronAPI` directly in components.
- Wrap Electron-specific logic with `if (isElectron())` blocks if the component might run in a web browser.

## useProjectionMessaging

**Path**: `src/composables/useProjectionMessaging.ts`

**Purpose**:
Manages high-level communication logic between the Main Window and the Projection Window. It handles message debouncing, deduplication, and state synchronization orchestration.

**Key Methods**:
- `setProjectionState(showDefault: boolean, view?: ViewType)`:
    - The main function to control what is shown on the projection screen.
    - Automatically ensures the projection window exists.
    - Updates the local store state.
    - Sends `CHANGE_VIEW` and `TOGGLE_PROJECTION_CONTENT` messages.
- `sendProjectionMessage(type, data, options)`: 
    - Generic function to send messages with built-in debouncing (default 100ms).
- `sendBatchMessages(messages, force)`:
    - efficiently sends multiple messages.
- `sendLocaleUpdate(locale)`: 
    - Helper to sync language changes to the projection window.

**Rules**:
- Use `useProjectionMessaging` (specifically `setProjectionState`) when implementing features that control the projection display (e.g., showing a bible verse, lyrics, or media).
- Avoid calling `useElectron().sendToProjection` directly for high-frequency updates (like sliding sliders); use `sendProjectionMessage` to benefit from debouncing.