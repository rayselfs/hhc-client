# Local Fonts and Preferences Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permission-safe local font discovery to the presentation Ribbon and remove unfinished
Preferences content.

**Architecture:** Keep experimental browser API typing and normalization in one renderer helper.
Invoke it only from the Ribbon button's user gesture, then merge the returned families into local
component state. Preferences changes are deletion-only.

**Tech Stack:** TypeScript, React 19, Chromium Local Font Access, Tailwind CSS v4, Vitest

## Global Constraints

- No native module, preload IPC, background enumeration, or persisted font inventory.
- Imported font families must remain selectable even if they are not installed.
- Local font failure must not change the current font selection.
- Soundboard page and playback behavior remain untouched.

---

### Task 1: Local Font Normalization

**Files:**
- Create: `src/renderer/src/lib/local-fonts.ts`
- Test: `src/renderer/src/lib/__tests__/local-fonts.test.ts`

**Interfaces:**
- Produces: `supportsLocalFontAccess(): boolean`
- Produces: `queryLocalFontFamilies(): Promise<string[]>`
- Produces: `mergeFontFamilies(...groups: Array<readonly string[]>): string[]`

- [x] Add failing tests for unsupported access, blank removal, deduplication, sorting, and stable
      merge order.
- [x] Run the focused test and confirm failure.
- [x] Implement the smallest helper around `window.queryLocalFonts()`.
- [x] Run the focused test and commit.

### Task 2: Presentation Ribbon Integration

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`

- [x] Add a failing test that mocks `window.queryLocalFonts`, clicks the accessible load button,
      and expects a returned family in the native select.
- [x] Add a failing test that a selected imported family remains an option before enumeration.
- [x] Run the focused test and confirm failure.
- [x] Add local font state and a click handler that preserves existing options on error.
- [x] Render the button only when the API is supported; disable and spin it while loading.
- [x] Add translated labels and warning copy.
- [x] Run all presentation workspace tests and commit.

### Task 3: Preferences Cleanup

**Files:**
- Modify: `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`
- Delete: `src/renderer/src/components/Control/UserMenu/SoundboardSettings.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`

- [x] Replace the Soundboard navigation test with an absence assertion.
- [x] Add an assertion that Storage Usage content appears exactly once.
- [x] Run the focused test and confirm the Soundboard assertion fails.
- [x] Remove the Soundboard category, route, render branch, component, and Preferences-only locale
      strings.
- [x] Confirm the existing Storage Usage branch is already singular; make no source change.
- [x] Run the focused test and commit.

### Task 4: Verification

- [x] Run all presentation workspace and Preferences tests.
- [x] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [x] Run `npx vitest run` and `npm run build`.
- [x] Mark this plan complete and inspect repository state.
