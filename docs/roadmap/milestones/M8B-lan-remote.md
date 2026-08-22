# M8B LAN Mobile Remote Control

## Status

Implemented as an Electron-only LAN HTTP remote.

## Goal

Provide LAN-only mobile browser control for presentation, projection blanking, timer, and stopwatch without cloud relay or file access.

## Implemented Scope

- Main-process LAN HTTP service, disabled by default.
- Private LAN host validation and request-size limits.
- Pairing URL flow with secret exchange and session token.
- Trusted-device storage with hashed credentials and configurable trust duration.
- Static mobile UI served by the app.
- Sanitized presentation/projection/timer/stopwatch state snapshots.
- Command gateway that reuses existing renderer stores and projection/timer adapters.
- Preferences controls for enabling the remote, choosing host, trusted devices, trust duration, and creating a pairing link.
- Runtime validators for commands and state payloads.

## Source Anchors

- `src/shared/lan-remote.ts`
- `src/main/lan-remote/server.ts`
- `src/main/lan-remote/mobile-ui.ts`
- `src/main/lan-remote/trusted-devices.ts`
- `src/main/ipc/lan-remote.ts`
- `src/renderer/src/lib/lan-remote-command-gateway.ts`
- `src/renderer/src/contexts/LanRemoteBridge.tsx`
- `src/renderer/src/components/Control/UserMenu/MediaSettings.tsx`

## Protocol Shape

The first implementation uses HTTP instead of WebSocket:

- `GET /pair/:secret` exchanges a short-lived pairing secret for a session token.
- `GET /state` returns the latest sanitized state when called with a valid session token.
- `POST /command` validates and dispatches a remote command when called with a valid session token.
- The mobile page polls state at a short interval and sends commands with `fetch()`.

This keeps the first version simple, debuggable, and LAN-contained.

## Acceptance Criteria

- LAN remote is Electron-only and disabled by default.
- The HTTP service binds only to a selected private LAN interface.
- Pairing is required before command execution.
- Remote commands cannot access files, arbitrary IPC, or filesystem paths.
- Previous, next, jump, blank, timer, and stopwatch commands work through the existing app paths.
- Projection/mobile state snapshots are sanitized.
- Trusted-device settings live in Preferences.

## Verification

```bash
npx vitest run src/shared/__tests__/lan-remote.test.ts
npx vitest run src/main/lan-remote/__tests__/server.test.ts
npx vitest run src/main/lan-remote/__tests__/server-security.test.ts
npx vitest run src/main/lan-remote/__tests__/trusted-devices.test.ts
npx vitest run src/renderer/src/lib/__tests__/lan-remote-command-gateway.test.ts
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
npm run typecheck
npm run lint
```

## Follow-Up Candidates

- QR code rendering for the pairing URL.
- Read-only observer sessions.
- Active-controller takeover approval UI.
- React-built mobile UI if the static HTML page becomes too limited.
