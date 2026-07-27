# Platform Safety and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate browser projection sessions, validate native VLC commands, correct background
status counts, and finish Recovery Center reachability.

**Architecture:** Extend the existing projection adapter envelope, add narrow validators at the
existing IPC handlers, correct the tray derivation in place, and delete speculative Recovery types
while exposing already-implemented actions.

**Tech Stack:** TypeScript, React 19, Electron IPC, BroadcastChannel, Zustand, Vitest

## Global Constraints

- Electron projection transport behavior remains unchanged.
- No new dependency, service, event bus, or recovery issue source.
- Runtime validation happens before native VLC runtime loading or mutation.
- Destructive recovery actions require confirmation.

---

### Task 1: Browser Projection Session Isolation

**Files:**
- Modify: `src/renderer/src/lib/projection-adapter.ts`
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/pages/ProjectionPage.tsx`
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Test: `src/renderer/src/lib/__tests__/projection-adapter.test.ts`
- Test: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`
- Test: `src/renderer/src/pages/__tests__/ProjectionPage.test.tsx`

- [ ] Add failing adapter tests for wrong session and same-role messages.
- [ ] Add failing context/page tests for session URL and adapter propagation.
- [ ] Run focused tests and confirm failures.
- [ ] Add session ID and sender role to browser envelopes and strict receive checks.
- [ ] Put the session ID in popup URL and window name.
- [ ] Pass the parsed browser session to both projection-side adapters.
- [ ] Run all projection transport tests and commit.

### Task 2: VLC IPC Runtime Validation

**Files:**
- Modify: `src/main/ipc/projection-vlc.ts`
- Test: `src/main/__tests__/ipc/projection-vlc.test.ts`

- [ ] Add failing tests for malformed start, probe, seek, volume, and enum values.
- [ ] Confirm invalid payloads currently reach runtime/player code.
- [ ] Add minimal unknown-payload validators at handler registration.
- [ ] Run the VLC handler tests and commit.

### Task 3: Background Task Counts

**Files:**
- Modify: `src/renderer/src/components/Control/BackgroundTaskTray.tsx`
- Test: `src/renderer/src/components/Control/__tests__/BackgroundTaskTray.test.tsx`

- [ ] Add a failing test with active and failed jobs after the first 30 rows.
- [ ] Derive counts from all jobs while rendering only the first 30.
- [ ] Run the focused test and commit.

### Task 4: Recovery Reachability and Freshness

**Files:**
- Modify: `src/renderer/src/components/Control/RecoveryCenter/RecoveryCenterPanel.tsx`
- Modify: `src/renderer/src/components/Control/RecoveryCenter/RecoveryIndicator.tsx`
- Modify: `src/renderer/src/types/recovery-center.ts`
- Modify: `src/renderer/src/stores/recovery-center.ts`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/components/Control/RecoveryCenter/__tests__/RecoveryCenterPanel.test.tsx`
- Test: `src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx`
- Test: `src/renderer/src/stores/__tests__/recovery-center.test.ts`

- [ ] Add failing tests that all issue actions render and destructive cancel asks for confirmation.
- [ ] Add failing assertions that Projection filter UI/types are absent and legacy state becomes
      `all`.
- [ ] Add a failing indicator test for media-job notifications and dismissed issues.
- [ ] Render all actions and route destructive actions through the existing confirm dialog.
- [ ] Delete dead Projection recovery types and locale strings; migrate persisted state.
- [ ] Refresh the indicator on media-job changes and window focus, excluding dismissed IDs.
- [ ] Run Recovery tests and commit.

### Task 5: Verification

- [ ] Run all projection, VLC, background-task, Recovery, and Preferences tests.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Run `npx vitest run` and `npm run build`.
- [ ] Mark this plan complete and inspect repository state.

