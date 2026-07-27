# R7 Responsive Consolidation and Release Design

## Status

Approved by continuous-roadmap authorization on 2026-07-27.

## Goal

Replace page-specific desktop-only workspace composition with a small shared shell and prove the
completed projection workflow in browser and packaged Electron lifecycles.

## Shared primitives

- `WorkspaceShell`: route-sized, overflow-safe workspace root.
- `ResponsivePanelGroup`: wide three-panel, medium stage plus navigator, compact stage plus
  mutually-exclusive overlay panels.
- `StageViewport`: primary operator surface.
- `NavigatorRail`: slide or playlist navigation.
- `InspectorPanel`: contextual settings.
- `ProjectionSessionControl`: shared live-session status/action composition.
- `ReadinessIssueDrawer` and `BackgroundTaskTray`: R6 operational overlays.

## Responsive behavior

- Wide (1280+): navigator, stage, and inspector can coexist.
- Medium (768–1279): navigator and stage remain; inspector becomes an overlay.
- Compact (<768): stage is primary; navigator and inspector are opened as mutually exclusive
  sheets with explicit close controls.

Presentation keeps its user-resized navigator width at wide/medium sizes. Media uses the same panel
contract and no longer relies on page-specific flex ratios.

## Cleanup

Remove only APIs and wrappers whose production references are zero after consolidation. Preserve
the real File Explorer trash route and projection fallback because both still have active
contracts. Dependency count remains unchanged.

## Release gates

- full Vitest, typecheck, lint, production build, and bundle budgets;
- browser control/projection E2E;
- fresh Windows unpacked package, native runtime check, and packaged projection E2E;
- macOS packaged smoke remains enforced in tag CI because this host is Windows.
