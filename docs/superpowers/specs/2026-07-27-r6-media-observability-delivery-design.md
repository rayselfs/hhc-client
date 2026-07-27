# R6 Media Observability and Delivery Design

## Status

Approved by continuous-roadmap authorization on 2026-07-27.

## Goal

Make preparation work visible across routes, turn every readiness failure into an actionable
operator decision, and keep editable-presentation delivery proportional to the current slide.

## Selected architecture

- IndexedDB `jobs` remains the single durable task authority. A global tray observes it; individual
  pages do not own duplicate task state.
- The existing readiness report remains the single source for skipped/preparing/failed items. A
  drawer presents repair, retry, and explicit skip actions without mutating Recovery Center state.
- Recovery Center remains the single incident authority. Inline errors deep-link to its existing
  actions instead of copying incidents into component state.
- Editable presentation source blobs are the single canonical document body. Legacy derived
  document mirrors are removed and excluded from quota accounting.
- Projection payloads remain slide-scoped. A revision cache avoids reparsing the source, while the
  transport sends only the current slide and assets referenced by that slide.

## Background Task Tray

The tray is mounted in the shared layout so it survives route changes. It shows queued, running,
paused, blocked, failed, completed, and cancelled jobs; progress; retry; pause; resume; cancel; and
history dismissal. The collapsed affordance reports active and failed counts.

## Readiness Issue Drawer

The previous hover-only skipped badge becomes a button. The drawer lists each non-ready item with
its reason and one primary action:

- preparing/failed with a related job: retry or prioritize;
- sync issue: retry through the existing sync/recovery path;
- missing source: open Recovery Center;
- unsupported: explicit skip acknowledgement.

Items stay represented by the readiness report for the lifetime of the Media session even when
they are excluded from the ready playback list.

## Delivery and caching

Editable documents are cached by `blobId + revision`. Cache invalidation is revision-based, not
time-based. The projection payload contains the playlist descriptor plus one slide and only the
assets that slide references. Slide navigation reuses the cached parsed document and never sends
the complete deck.

## Storage

The `file-blobs` body is canonical. Creation and revision writes no longer clone it into
`derived-assets`; startup deletes legacy `editable-presentation-document` mirrors. Storage
accounting therefore measures the canonical source once.

## Acceptance

- tasks remain visible after route changes;
- each readiness issue exposes its reason and an action;
- failed/skipped items remain inspectable in the session;
- repeated slide navigation does not reload or serialize a full deck;
- quota totals count one editable document body;
- browser and packaged Electron gates remain green.
