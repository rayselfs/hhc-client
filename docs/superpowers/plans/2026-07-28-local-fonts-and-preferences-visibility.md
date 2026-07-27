# Local Fonts and Preferences Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permission-safe local font discovery to the presentation Ribbon and remove unfinished
or duplicated Preferences content.

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

- [ ] Add failing tests for unsupported access, blank removal, deduplication, sorting, and stable
      merge order.
- [ ] Run the focused test and confirm failure.
- [ ] Implement the smallest helper around `window.queryLocalFonts()`.
- [ ] Run the focused test and commit.

### Task 2: Presentation Ribbon Integration

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`

- [ ] Add a failing test that mocks `window.queryLocalFonts`, clicks the accessible load button,
      and expects a returned family in the native select.
- [ ] Add a failing test that a selected imported family remains an option before enumeration.
- [ ] Run the focused test and confirm failure.
- [ ] Add local font state and a click handler that preserves existing options on error.
- [ ] Render the button only when the API is supported; disable and spin it while loading.
- [ ] Add translated labels and warning copy.
- [ ] Run all presentation workspace tests and commit.

### Task 3: Preferences Cleanup

**Files:**
- Modify: `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`
- Delete: `src/renderer/src/components/Control/UserMenu/SoundboardSettings.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`

- [ ] Replace the Soundboard navigation test with an absence assertion.
- [ ] Add an assertion that Storage Usage content appears exactly once.
- [ ] Run the focused test and confirm current failures.
- [ ] Remove the Soundboard category, route, render branch, component, and Preferences-only locale
      strings.
- [ ] Remove the duplicate `storage.usage` branch.
- [ ] Run the focused test and commit.

### Task 4: Verification

- [ ] Run all presentation workspace and Preferences tests.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Run `npx vitest run` and `npm run build`.
- [ ] Mark this plan complete and inspect repository state.

