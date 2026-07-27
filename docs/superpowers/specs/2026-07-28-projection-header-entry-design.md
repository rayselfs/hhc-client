# Projection Header Entry Design

## Goal

Keep one consistent projection control in the right side of every applicable header and remove the
redundant now-projecting status bar.

## Root Causes

- `Layout` renders `NowProjectingBar` below every header whenever a projection session exists.
- The generic header wraps one icon button in a `ButtonGroup` and adds horizontal padding, which
  turns the icon-only control into a pill.
- The presentation route replaces the generic header with `PresentationWorkspaceHeader`.
- That custom header explicitly renders a two-button group for “Present from Current Slide” and
  “Present from Beginning”; the group is application code, not behavior added by HeroUI.

## Options Considered

1. Keep both presentation actions in a menu. This preserves discoverability but still adds UI that
   is not required and duplicates the existing shortcuts.
2. Create a shared projection-button abstraction. This prevents minor visual drift, but two simple
   call sites do not justify another component.
3. Use the same native `Button` contract in both headers and keep alternate starts as shortcuts.
   This is the smallest solution and is selected.

## Decisions

### Remove the now-projecting bar completely

`Layout` will no longer mount `NowProjectingBar`. The component, its status-only derivation helper,
their tests, and the orphaned `nowProjecting` locale blocks will be deleted.

Projection recovery remains visible through `ProjectionRecoveryNotice`; session operation remains
available from the header button. No replacement status row is introduced.

### Use one round header projection button

Both headers use an icon-only outline button with an explicit `size-10 min-w-10 rounded-full p-0`
shape. This matches the collapsed search toggle height and makes the shape independent of HeroUI
group styling.

The generic header removes the single-child `ButtonGroup` and the `px-6` override.

### Make the presentation button a toggle

When projection is closed, clicking the presentation header button saves the active document and
starts from the current slide. When projection is open, the same button stops the projection
session. It uses the same Monitor/X icon and accessible start/stop labels as the generic header.

The button is disabled only when projection is closed and no active document exists.

### Preserve keyboard starts

F5 continues to present from the beginning. Shift+F5 continues to present from the current slide.
The second visible “Present from Beginning” button is removed.

## Compatibility

- No projection context, IPC, or browser adapter contracts change.
- The projection owner rule remains unchanged: only explicit button or shortcut actions start
  presentation content.
- Existing save-before-present behavior remains mandatory.
- Browser and Electron use the same header implementation.

## Verification

- Generic header tests prove the button is round, has no group ancestor, and still starts/stops.
- Presentation header tests prove exactly one projection button is visible, current-slide start and
  stop both work, and F5/Shift+F5 retain distinct behavior.
- Source and locale searches prove no `NowProjectingBar`, status helper, or `nowProjecting` keys
  remain.
- Focused tests, typecheck, lint, full Vitest, and production build must pass.
