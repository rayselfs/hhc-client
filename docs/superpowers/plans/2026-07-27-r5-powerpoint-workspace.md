# R5 PowerPoint-like Presentation Workspace Implementation Plan

> Execute continuously on `feat/media-projection`. Use TDD for every behavior change and preserve
> the R2 session writer and R3/R4 projection contracts.

## Task 1 — Pure editor commands

- Add command tests for selected-slide reorder, bounds selection, multi-object patching, nudge,
  align, distribute, and snap candidates.
- Implement the smallest immutable commands in `lib/presentation-editor-commands.ts`.
- Verify focused tests, typecheck, and lint; commit.

## Task 2 — Presentation quick bar semantics

- Add F5 and Shift+F5 shortcut definitions and tests.
- Change the presentation header from start/stop ambiguity to explicit Present from Beginning and
  Present from Current Slide actions.
- Preserve draft commit and exact revision flush before projection.
- Verify header and projection action tests; commit.

## Task 3 — Slide rail operations

- Add resizable rail state and accessible keyboard alternatives.
- Add selected-slide drag reorder using the pure command.
- Preserve insert before/after, copy, paste, duplicate, multi-select, and delete behavior.
- Add projected/next markers independent from selection.
- Verify component tests; commit.

## Task 4 — Stage precision and object editing

- Add object multi-selection and marquee bounds selection.
- Apply multi-object pointer moves through one session draft.
- Add keyboard nudge, snap guides, align, and distribute.
- Wire shape, ellipse, line, and image crop commands into Ribbon/contextual controls.
- Verify pure and component tests; commit.

## Task 5 — Zoom, inspector, Notes, and status

- Add centered 25–200% zoom controls and fit reset.
- Add contextual position/size inspector with align/distribute controls.
- Add collapsible Notes pane with one transaction per completed edit.
- Add status bar with slide, selection, projection, and zoom state.
- Verify component tests and responsive layout assertions; commit.

## Task 6 — Responsive Ribbon and cleanup

- Add Text Format contextual tab.
- Make Ribbon labels and panels degrade intentionally at wide, medium, and compact widths.
- Remove obsolete presentation-only branches after replacement paths are verified.
- Run focused and full quality gates, update R5 roadmap progress, and commit.
