# LAN Remote Runtime Safety Implementation Plan

**Goal:** Make LAN remote binding, state, and command acknowledgements reflect real runtime behavior.

**Architecture:** Keep the current HTTP, pairing, IPC, and renderer gateway flow. Tighten the
existing boundaries instead of adding a new service or protocol.

**Tech Stack:** TypeScript, Electron IPC, Node HTTP, React, Zustand, Vitest

## Task 1: Bind Only the Selected Private Interface

- [x] Add server tests that use an assigned private IPv4 address, prove the selected host is used,
      reject pairing while disabled, and leave status disabled after bind failure.
- [x] Change server startup to `listen(port, host)` and publish enabled state only after success.
- [x] Run focused server tests and commit.

## Task 2: Wait for Renderer ACK

- [x] Add main IPC tests for exact renderer ACK, timeout, duplicate request ID, and invalid sender.
- [x] Add a pending-command map in `registerLanRemoteIpc`; resolve it from `publish-ack`.
- [x] Delete the unused ACK echo and server `publishAck()` API.
- [x] Run focused IPC/server tests and commit.

## Task 3: Make Enabled State Runtime-only

- [x] Add settings tests proving persisted/legacy `enabled: true` rehydrates as false.
- [x] Persist selected host with `enabled: false`; force `enabled: false` during merge.
- [x] Make `LanRemoteBridge` inactive while LAN remote is disabled and publish immediately on enable.
- [x] Add/adjust bridge tests, run focused tests, and commit.

## Task 4: Reject Semantic No-ops

- [x] Add gateway tests for inactive presentation, boundaries, invalid jump, non-video media, and
      redundant play/pause.
- [x] Add the minimal guards before existing store mutations.
- [x] Run focused gateway tests and commit.

## Task 5: Remove Unimplemented Trusted Devices

- [x] Remove trusted-device settings fields and Preferences controls.
- [x] Delete the unused trusted-device module/test and translations.
- [x] Update affected settings and Preferences fixtures/tests.
- [x] Run focused tests and commit.

## Task 6: Batch Verification

- [x] Run all LAN/settings/Preferences focused tests.
- [x] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [x] Run `npx vitest run` and `npm run build`.
- [x] Mark this plan complete and inspect repository state.
