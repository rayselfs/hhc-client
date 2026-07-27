# R6 Media Observability and Delivery Implementation Plan

## Task 1 — Durable job observation

- Add media-job subscriptions and a route-independent query hook.
- Build the persistent Background Task Tray with retry, pause/resume, cancel, and progress.
- Mount it once in the shared Layout and add component tests.

## Task 2 — Actionable readiness

- Replace the hover badge with an actionable Readiness Issue Drawer.
- Preserve all non-ready items in the session report.
- Route repairable incidents to existing queue or Recovery Center actions.

## Task 3 — Revision cache and slide-scoped delivery

- Cache editable documents by canonical blob revision.
- Verify slide payloads include only current-slide assets.
- Verify repeated slide changes reuse the parsed document.

## Task 4 — Canonical editable storage

- Stop writing duplicate editable document derived assets.
- Remove legacy mirrors during initialization.
- Correct accounting and persistence tests.

## Task 5 — Verification and closure

- Run focused and full quality gates.
- Update R6 roadmap evidence and commit.
