# Projection E2E Contract Design

## Goal

Align browser and packaged projection E2E coverage with the intentionally simplified single Header
projection control.

## Root Cause

The obsolete Now Projecting bar was removed from production, but both E2E suites still click its
Stop, Resume, and Close controls. Browser projection URLs also now include a session ID after the
generation. Unit tests cannot detect either stale selector.

## Selected Approach

- Keep media and timer startup coverage.
- Keep the assertion that navigation does not steal or focus projection.
- Replace the removed blackout/resume/status-bar sequence with the supported Header
  `Stop projection` action and verify the projection window closes.
- Update the browser URL assertion to require both a positive generation and a UUID session.

Do not re-add data test IDs or hidden compatibility UI for deleted controls. Blackout remains
covered by coordinator/component tests; the public Header currently exposes start/stop only.

## Verification

- Search proves no E2E selector references `now-projecting-*`.
- Browser Playwright projection suite passes.
- Packaged spec remains type-valid and uses the same accessible Header action.

