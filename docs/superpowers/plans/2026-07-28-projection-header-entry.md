# Projection Header Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant now-projecting row and expose one consistent round projection toggle
in generic and presentation headers.

**Architecture:** Keep projection behavior in the existing headers and projection action helpers.
Delete the status-row-only code, use the same explicit button geometry at both call sites, and
retain alternate presentation starts as keyboard shortcuts.

**Tech Stack:** TypeScript, React 19, HeroUI v3, Vitest

## Global Constraints

- No projection context, IPC, or browser adapter contract changes.
- Header projection controls are `size-10 min-w-10 rounded-full p-0`.
- Presentation click starts from the current slide when closed and stops when open.
- F5 starts from the beginning; Shift+F5 starts from the current slide.
- No new component abstraction or dependency.

---

### Task 1: Remove the Now-Projecting Row

**Files:**
- Modify: `src/renderer/src/components/Control/Layout.tsx`
- Delete: `src/renderer/src/components/Control/NowProjectingBar.tsx`
- Delete: `src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx`
- Delete: `src/renderer/src/lib/projection-session-summary.ts`
- Delete: `src/renderer/src/lib/__tests__/projection-session-summary.test.ts`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`

**Interfaces:**
- Removes: `NowProjectingBar`
- Removes: `deriveNowProjectingStatus`
- Preserves: `ProjectionRecoveryNotice`

- [ ] Remove the `NowProjectingBar` import and render site from `Layout`.
- [ ] Delete the component, status helper, and their isolated tests.
- [ ] Delete the three orphaned `nowProjecting` locale objects.
- [ ] Run `rg -n "NowProjecting|nowProjecting|projection-session-summary" src/renderer/src` and
      expect no matches.
- [ ] Run `npm run typecheck` and commit.

### Task 2: Restore the Generic Round Toggle

**Files:**
- Modify: `src/renderer/src/components/Control/Header/Header.tsx`
- Test: `src/renderer/src/components/Control/Header/__tests__/Header.test.tsx`

**Interfaces:**
- Preserves: existing `handleProjectionAction(): Promise<void>`
- Produces: one ungrouped `Button` with `size-10 min-w-10 rounded-full p-0`

- [ ] Add a failing test that the projection button has round fixed-size classes and no
      `[role="group"]` ancestor.
- [ ] Run the focused test and verify it fails because the current button has `px-6` and a group.
- [ ] Remove the single-child `ButtonGroup`, set `size="lg"`, and apply the explicit round classes.
- [ ] Run the focused header tests and commit.

### Task 3: Replace the Presentation Action Group

**Files:**
- Modify: `src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx`
- Test: `src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx`

**Interfaces:**
- Consumes: `useProjection(): { isProjectionOpen, stopProjection }`
- Consumes: `stopProjectionSession({ stopProjection }): Promise<void>`
- Produces: one round start/stop button

- [ ] Add failing tests that one round start button exists, no visible beginning button exists, and
      the start button presents the current slide.
- [ ] Add a failing open-session test that the button is labeled “Stop projection” and delegates to
      `stopProjectionSession`.
- [ ] Run the focused tests and verify the group/start-stop expectations fail.
- [ ] Use `useProjection`, remove `ButtonGroup` and `ChevronsLeft`, and implement one round toggle.
- [ ] Keep the current F5/Shift+F5 shortcut test unchanged and run the complete header test file.
- [ ] Commit.

### Task 4: Batch Verification

- [ ] Run both header test files.
- [ ] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Run `npx vitest run` and `npm run build`.
- [ ] Mark this plan complete and inspect repository state.
