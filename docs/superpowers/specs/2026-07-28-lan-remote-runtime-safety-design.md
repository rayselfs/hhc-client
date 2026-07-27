# LAN Remote Runtime Safety Design

## Goal

Make the existing Electron LAN remote truthful and usable: listen only on the selected private
interface, report command results only after renderer execution, avoid persisted fake-running
state, reject semantic no-ops, and remove the disconnected trusted-device prototype.

## Decisions

### Bind to the selected host

`createLanRemoteServer.start()` will call `listen(port, host)` instead of listening on every
interface. The controller will become enabled only after the listen callback succeeds. A host
that is private but not assigned to this computer will fail through the operating system instead
of silently exposing every interface.

### ACK after execution

The main IPC layer will keep one pending resolver per command `requestId`. It sends the command to
the main renderer, waits for `lan-remote:publish-ack`, and returns that exact ACK to the HTTP
request. A missing renderer response becomes `rejected: renderer-timeout`; duplicate in-flight IDs
become `rejected: duplicate-request`.

The unused main-to-renderer ACK echo and server-side `publishAck()` path will be deleted.

### Runtime enabled state

`lanRemote.enabled` remains renderer runtime state for the switch, but persistence always writes
and rehydrates it as `false`. The selected host remains persisted. `LanRemoteBridge` subscribes to
the runtime flag and only registers command/state publishing while the server is enabled.

### Reject no-op commands

The renderer gateway will reject navigation without an active presentation, previous/next at a
boundary, an out-of-range jump, and video commands when the current item is not a video or the
requested playback state is already active.

### Remove trusted-device prototype

Trusted-device controls, settings fields, translations, store, and isolated tests will be removed.
Pairing remains one-use and creates an in-memory session that is invalidated when the server stops.
Persistent trust can be designed later only with durable encrypted credentials and complete revoke
UI.

## Security and Failure Behavior

- Public and loopback host input remains rejected by the existing private-address validator.
- Pairing creation fails while the server is disabled.
- Failed bind leaves status disabled.
- HTTP command requests receive the renderer's accepted/rejected ACK, not queue acceptance.
- Stopping the server clears pairings and sessions.

## Non-goals

- TLS, internet relay, persistent device trust, discovery, and browser-mode LAN hosting.
- Automatic network-interface enumeration.
- Changing the mobile remote visual design.

## Verification

- HTTP integration tests bind to a real private interface and prove loopback cannot reach it.
- Main IPC tests cover renderer ACK, duplicate IDs, timeout, and sender validation.
- Renderer gateway tests cover inactive, boundary, range, and media-state rejection.
- Settings tests prove `enabled` is not restored as running.
- Focused tests, typecheck, lint, full Vitest suite, and build must pass.
