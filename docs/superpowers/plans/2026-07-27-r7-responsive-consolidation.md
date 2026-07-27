# R7 Responsive Consolidation Implementation Plan

## Task 1 — Shared primitives

- Implement the shared workspace and projection-session primitives with no new dependencies.
- Add responsive behavior tests.

## Task 2 — Adopt in Media and Presentation

- Replace Media flex ratios with `ResponsivePanelGroup`.
- Apply shared shell, navigator, stage, inspector, and compact sheet behavior to Presentation.
- Adopt `ProjectionSessionControl` in the global live bar.

## Task 3 — Verified cleanup

- Audit production references to projection context methods, route wrappers, and stores.
- Remove only proven dead exports and update mocks/tests.

## Task 4 — Release gates

- Run full repository quality gates and bundle budgets.
- Run browser E2E.
- Build fresh Windows unpacked package and run native/runtime packaged E2E.
- Update roadmap and finish the feature branch.
