# Presentation Rendering Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct PowerPoint point sizing and preserve editable slide layout from import through
projection.

**Architecture:** Keep canvas pixels as the persisted coordinate system. Convert point values only
at Ribbon boundaries, contain the unchanged slide surface in projection, and extend text elements
with optional imported runs shared by DOM and SVG renderers.

**Tech Stack:** TypeScript, React 19, Electron/browser renderer, Vitest

## Global Constraints

- No document-wide migration or guessed conversion of stored font sizes.
- Do not change direct PPTX rendering.
- Projection must contain without crop or stretch.
- Imported fixed frames must not auto-grow.
- Imported runs are display fidelity only; the first plain-text edit clears them.
- No new dependencies.

---

### Task 1: Point and Canvas Unit Contract

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`

**Interfaces:**
- Produces: `presentationPointsToCanvasPx(points, documentWidth): number`
- Produces: `presentationCanvasPxToPoints(px, documentWidth): number`

- [x] Add failing helper tests for 72pt at widths 1920 and 1280 and round-trip conversion.
- [x] Add a failing workspace test that selects 72 and expects a 144px model value at width 1920.
- [x] Implement the two pure helpers and use them for Ribbon value, selection, and +/- changes.
- [x] Run focused tests and commit.

### Task 2: Projection Contain Geometry

**Files:**
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Test: `src/renderer/src/components/Projection/__tests__/FileProjection.editable-payload.test.tsx`

**Interfaces:**
- Consumes: editable document `width` and `height`
- Produces: a viewport-bounded wrapper with `data-editable-projection-frame`

- [x] Add a failing test asserting the dynamic `min(100vw, ...)` width and height expressions.
- [x] Wrap `EditableSlideSurface` in the contain frame and let the surface fill it.
- [x] Run the focused projection test and commit.

### Task 3: Remove Unsafe Slide Size and Restore Default Background

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`

**Interfaces:**
- Removes: current Design Ribbon Slide Size selector and local resize helper
- Preserves: `defaultSlideBackground` through `loadEditablePresentationSnapshot`

- [x] Add failing tests that the selector is absent and a custom default background survives load.
- [x] Remove the dimensions-only resize path.
- [x] Normalize and return persisted `defaultSlideBackground` during parse.
- [x] Run focused tests and commit.

### Task 4: Preserve Imported Fixed Frames

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`

**Interfaces:**
- Consumes: resolved `TextShapeFrame.height`
- Produces: imported text with the exact same fixed height

- [x] Add a failing PPTX conversion test whose estimated text height exceeds its frame.
- [x] Remove imported frame auto-growth and the unused height estimator.
- [x] Run focused import tests and commit.

### Task 5: Preserve Imported Text Runs

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Modify: `src/renderer/src/components/Common/EditableSlideSurface.tsx`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`
- Test: `src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx`

**Interfaces:**
- Produces: optional `EditableTextElement.runs: EditableTextRun[]`
- Produces: per-run non-editing DOM spans
- Plain-text edit writes `runs: undefined`

- [x] Add failing conversion tests for mixed font size, bold, italic, underline, color, and paragraph
      breaks.
- [x] Add failing surface tests for styled spans and run clearing on input.
- [x] Add the optional run type, resolve imported run styles, render spans, and clear runs on edit.
- [x] Run focused import/surface tests and commit.

### Task 6: Match SVG Thumbnail Run Rendering

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`

**Interfaces:**
- Consumes: `EditableTextElement.runs`
- Produces: escaped SVG `tspan` nodes with run-specific font attributes

- [x] Add a failing thumbnail test for two differently styled runs.
- [x] Render run `tspan` nodes, retaining the uniform text fallback.
- [x] Run thumbnail and import tests and commit.

### Task 7: Batch Verification

- [x] Run all editable presentation, surface, workspace, preview, payload, and projection tests.
- [x] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [x] Run `npx vitest run` and `npm run build`.
- [x] Mark this plan complete and inspect repository state.
