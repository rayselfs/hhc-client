# M8B LAN Mobile Remote Control Implementation Plan

> Consolidated from the previous LAN remote plan. This file is now the roadmap source of truth for LAN remote work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron-only LAN mobile browser remote for presentation, projection blanking, timer, and stopwatch controls without cloud relay or file access.

**Architecture:** The Electron main process owns the disabled-by-default LAN HTTP/WebSocket service, pairing secrets, sessions, trusted-device storage, and network-interface binding. The renderer owns the command gateway and sanitized state snapshots so mobile commands reuse existing Zustand stores, projection context, and timer adapter paths instead of calling IPC or projection windows directly.

**Tech Stack:** Electron main/preload IPC, Node `http`/`crypto`/`os`, `ws` already installed, React 19, TypeScript, Zustand settings persistence, Vitest, Electron IPC tests.

---

## Needs Confirmation

- Mobile UI asset strategy: default plan serves a tiny static HTML/JS/CSS bundle from `src/main/lan-remote/mobile-ui.ts`. If product wants React-built mobile UI, add a Vite build target before Task 4.
- Pairing QR rendering: default plan exposes pairing URL text first and leaves QR rendering to a small canvas component later. If QR is mandatory in the first slice, approve adding a small QR implementation or dependency.
- Trusted-device storage: default plan uses main-process JSON under `app.getPath('userData')`. If this must use OS keychain, add a credential-store abstraction first.
- Active controller policy: default plan enforces one controller and allows read-only observers later; first implementation rejects takeover instead of adding takeover approval UI.
- Network interface policy: default plan allows only RFC1918 IPv4 private interfaces by default and excludes loopback/VPN/public interfaces.

## File Structure

- Create `src/shared/lan-remote.ts`: runtime-independent command/state/session contract and validators.
- Create `src/main/lan-remote/server.ts`: local HTTP/WebSocket service, pairing, sessions, rate limits.
- Create `src/main/lan-remote/trusted-devices.ts`: hashed trusted credential persistence.
- Create `src/main/lan-remote/mobile-ui.ts`: bundled static mobile UI response.
- Create `src/main/ipc/lan-remote.ts`: typed IPC handlers for Preferences and renderer bridge.
- Modify `src/main/index.ts`: register LAN remote IPC.
- Modify `src/shared/ipc-channels.ts`: LAN remote IPC types and main-to-renderer command channel.
- Modify `src/preload/index.ts`: expose `window.api.lanRemote`.
- Modify `src/renderer/src/stores/settings.ts`: LAN remote preferences.
- Create `src/renderer/src/lib/lan-remote-command-gateway.ts`: command execution and sanitized state snapshot helpers.
- Create `src/renderer/src/contexts/LanRemoteBridge.tsx`: subscribes to remote commands and publishes state.
- Modify `src/renderer/src/main.tsx`: mount bridge inside app providers.
- Modify `src/renderer/src/components/Control/UserMenu/MediaSettings.tsx`: add LAN Remote Control settings section.
- Modify `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`: add Media child section.
- Add tests for validators, server/session behavior, settings migration, and command gateway.

---

### Task 1: Define Runtime-Validated Remote Contract

**Files:**
- Create: `src/shared/lan-remote.ts`
- Test: `src/shared/__tests__/lan-remote.test.ts`

- [ ] **Step 1: Write validator tests**

Create `src/shared/__tests__/lan-remote.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  parseLanRemoteCommand,
  sanitizeLanRemoteSnapshot,
  isPrivateLanAddress
} from '../lan-remote'

describe('LAN remote contract', () => {
  it('accepts only supported commands', () => {
    expect(parseLanRemoteCommand({ requestId: 'r1', type: 'presentation:next' })).toEqual({
      requestId: 'r1',
      type: 'presentation:next'
    })
    expect(parseLanRemoteCommand({ requestId: 'r2', type: 'presentation:jump', index: 2 })).toEqual({
      requestId: 'r2',
      type: 'presentation:jump',
      index: 2
    })
    expect(parseLanRemoteCommand({ requestId: 'r3', type: 'filesystem:delete', path: '/tmp/x' })).toBeNull()
  })

  it('sanitizes snapshots by whitelisting fields', () => {
    const snapshot = sanitizeLanRemoteSnapshot({
      revision: 1,
      presentation: {
        currentIndex: 0,
        total: 2,
        currentName: 'Slide',
        nextName: 'Next',
        nativeUrl: 'hhc-media://file/secret',
        notes: 'hidden'
      },
      projection: { isOpen: true, isBlanked: false },
      timer: { status: 'running', remainingSeconds: 30 },
      stopwatch: { status: 'stopped', elapsedMs: 0 }
    } as never)

    expect(JSON.stringify(snapshot)).not.toContain('nativeUrl')
    expect(JSON.stringify(snapshot)).not.toContain('hidden')
    expect(snapshot.presentation.currentName).toBe('Slide')
  })

  it('allows only private LAN addresses by default', () => {
    expect(isPrivateLanAddress('192.168.1.10')).toBe(true)
    expect(isPrivateLanAddress('10.0.0.5')).toBe(true)
    expect(isPrivateLanAddress('172.16.0.5')).toBe(true)
    expect(isPrivateLanAddress('8.8.8.8')).toBe(false)
    expect(isPrivateLanAddress('127.0.0.1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/shared/__tests__/lan-remote.test.ts
```

Expected: FAIL because `lan-remote.ts` does not exist.

- [ ] **Step 3: Create shared contract**

Create `src/shared/lan-remote.ts`:

```typescript
import type { TimerCommand } from './types/timer'

export type LanRemoteCommand =
  | { requestId: string; type: 'presentation:prev' }
  | { requestId: string; type: 'presentation:next' }
  | { requestId: string; type: 'presentation:jump'; index: number; requiredRevision?: number }
  | { requestId: string; type: 'media:play' }
  | { requestId: string; type: 'media:pause' }
  | { requestId: string; type: 'projection:blank'; enabled: boolean }
  | { requestId: string; type: 'timer:command'; command: TimerCommand }

export interface LanRemoteSnapshot {
  revision: number
  presentation: {
    currentIndex: number
    total: number
    currentName: string | null
    nextName: string | null
    canPrevious: boolean
    canNext: boolean
    isPlaying: boolean
  }
  projection: {
    isOpen: boolean
    isBlanked: boolean
  }
  timer: {
    status: string
    remainingSeconds: number
  }
  stopwatch: {
    status: string
    elapsedMs: number
  }
}

export type LanRemoteAck =
  | { requestId: string; status: 'accepted' }
  | { requestId: string; status: 'rejected'; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requestIdOf(value: Record<string, unknown>): string | null {
  return typeof value.requestId === 'string' && value.requestId.length > 0 ? value.requestId : null
}

export function parseLanRemoteCommand(value: unknown): LanRemoteCommand | null {
  if (!isRecord(value)) return null
  const requestId = requestIdOf(value)
  if (!requestId || typeof value.type !== 'string') return null

  if (value.type === 'presentation:prev' || value.type === 'presentation:next') {
    return { requestId, type: value.type }
  }
  if (value.type === 'presentation:jump' && Number.isInteger(value.index)) {
    return {
      requestId,
      type: 'presentation:jump',
      index: Number(value.index),
      requiredRevision: Number.isInteger(value.requiredRevision)
        ? Number(value.requiredRevision)
        : undefined
    }
  }
  if (value.type === 'media:play' || value.type === 'media:pause') {
    return { requestId, type: value.type }
  }
  if (value.type === 'projection:blank' && typeof value.enabled === 'boolean') {
    return { requestId, type: 'projection:blank', enabled: value.enabled }
  }
  if (value.type === 'timer:command' && isRecord(value.command)) {
    return { requestId, type: 'timer:command', command: value.command as TimerCommand }
  }
  return null
}

export function sanitizeLanRemoteSnapshot(snapshot: LanRemoteSnapshot): LanRemoteSnapshot {
  return {
    revision: snapshot.revision,
    presentation: {
      currentIndex: snapshot.presentation.currentIndex,
      total: snapshot.presentation.total,
      currentName: snapshot.presentation.currentName,
      nextName: snapshot.presentation.nextName,
      canPrevious: snapshot.presentation.canPrevious,
      canNext: snapshot.presentation.canNext,
      isPlaying: snapshot.presentation.isPlaying
    },
    projection: {
      isOpen: snapshot.projection.isOpen,
      isBlanked: snapshot.projection.isBlanked
    },
    timer: {
      status: snapshot.timer.status,
      remainingSeconds: snapshot.timer.remainingSeconds
    },
    stopwatch: {
      status: snapshot.stopwatch.status,
      elapsedMs: snapshot.stopwatch.elapsedMs
    }
  }
}

export function isPrivateLanAddress(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b] = parts
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}
```

- [ ] **Step 4: Run contract test**

Run:

```bash
npx vitest run src/shared/__tests__/lan-remote.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lan-remote.ts src/shared/__tests__/lan-remote.test.ts
git commit -m "feat: add lan remote command contract"
```

---

### Task 2: Add Main-Process Server Skeleton and Sessions

**Files:**
- Create: `src/main/lan-remote/server.ts`
- Create: `src/main/lan-remote/mobile-ui.ts`
- Test: `src/main/lan-remote/__tests__/server.test.ts`

- [ ] **Step 1: Write server tests**

Create `src/main/lan-remote/__tests__/server.test.ts`:

```typescript
import { expect, it } from 'vitest'
import { createLanRemoteServer } from '../server'

it('starts disabled and creates one-use pairing secrets', async () => {
  const server = createLanRemoteServer({ commandHandler: async () => ({ requestId: 'x', status: 'accepted' }) })

  expect(server.getStatus().enabled).toBe(false)

  await server.start({ host: '192.168.1.10', port: 0 })
  const pairing = server.createPairingSecret('Device')

  expect(server.getStatus().enabled).toBe(true)
  expect(pairing.url).toContain('/pair/')
  expect(server.consumePairingSecret(pairing.secret)?.deviceName).toBe('Device')
  expect(server.consumePairingSecret(pairing.secret)).toBeNull()

  await server.stop()
  expect(server.getStatus().enabled).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/main/lan-remote/__tests__/server.test.ts
```

Expected: FAIL because server module does not exist.

- [ ] **Step 3: Add static mobile UI**

Create `src/main/lan-remote/mobile-ui.ts`:

```typescript
export function getLanRemoteMobileHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HHC Remote</title>
  <style>
    body{font-family:system-ui;margin:0;background:#111;color:#fff}
    main{display:grid;gap:12px;padding:16px}
    button{font-size:20px;padding:16px;border-radius:10px;border:0}
  </style>
</head>
<body>
  <main>
    <button data-command="presentation:prev">Previous</button>
    <button data-command="presentation:next">Next</button>
    <button data-command="projection:blank">Blank</button>
    <pre id="state">Disconnected</pre>
  </main>
  <script>
    const state = document.getElementById('state')
    const ws = new WebSocket(location.origin.replace('http', 'ws') + '/ws')
    ws.onmessage = event => { state.textContent = event.data }
    document.querySelectorAll('button').forEach(button => {
      button.onclick = () => ws.send(JSON.stringify({ requestId: crypto.randomUUID(), type: button.dataset.command, enabled: true }))
    })
  </script>
</body>
</html>`
}
```

- [ ] **Step 4: Implement server skeleton**

Create `src/main/lan-remote/server.ts`:

```typescript
import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { getLanRemoteMobileHtml } from './mobile-ui'
import type { LanRemoteAck, LanRemoteCommand } from '../../shared/lan-remote'

interface StartOptions {
  host: string
  port: number
}

interface PairingRecord {
  secret: string
  deviceName: string
  expiresAt: number
}

interface LanRemoteServerOptions {
  commandHandler: (command: LanRemoteCommand) => Promise<LanRemoteAck>
}

export function createLanRemoteServer(_options: LanRemoteServerOptions) {
  let server: Server | null = null
  let host = ''
  let port = 0
  const pairings = new Map<string, PairingRecord>()

  return {
    async start(options: StartOptions): Promise<void> {
      if (server) return
      host = options.host
      port = options.port
      server = createServer((req, res) => {
        if (req.url === '/' || req.url?.startsWith('/pair/')) {
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(getLanRemoteMobileHtml())
          return
        }
        res.statusCode = 404
        res.end('Not found')
      })
      await new Promise<void>((resolve) => server!.listen(port, host, resolve))
      const address = server.address()
      if (typeof address === 'object' && address) port = address.port
    },
    async stop(): Promise<void> {
      if (!server) return
      const current = server
      server = null
      pairings.clear()
      await new Promise<void>((resolve, reject) => {
        current.close((error) => (error ? reject(error) : resolve()))
      })
    },
    createPairingSecret(deviceName: string): { secret: string; url: string; expiresAt: number } {
      const secret = randomBytes(32).toString('base64url')
      const expiresAt = Date.now() + 2 * 60 * 1000
      pairings.set(secret, { secret, deviceName, expiresAt })
      return { secret, expiresAt, url: `http://${host}:${port}/pair/${secret}` }
    },
    consumePairingSecret(secret: string): PairingRecord | null {
      const record = pairings.get(secret)
      pairings.delete(secret)
      if (!record || record.expiresAt < Date.now()) return null
      return record
    },
    getStatus(): { enabled: boolean; host: string; port: number } {
      return { enabled: server !== null, host, port }
    }
  }
}
```

- [ ] **Step 5: Run server test**

Run:

```bash
npx vitest run src/main/lan-remote/__tests__/server.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/lan-remote/server.ts src/main/lan-remote/mobile-ui.ts src/main/lan-remote/__tests__/server.test.ts
git commit -m "feat: add lan remote server skeleton"
```

---

### Task 3: Add IPC and Preferences Settings

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Create: `src/main/ipc/lan-remote.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/stores/settings.ts`
- Test: `src/renderer/src/stores/__tests__/settings.test.ts`

- [ ] **Step 1: Add settings migration test**

Add to `src/renderer/src/stores/__tests__/settings.test.ts`:

```typescript
import { DEFAULT_LAN_REMOTE } from '@renderer/stores/settings'

it('normalizes LAN remote settings', () => {
  const normalized = normalizeSettingsState({
    lanRemote: { enabled: true, trustDurationDays: 999, allowTrustedDevices: true }
  })

  expect(normalized.lanRemote).toEqual({
    ...DEFAULT_LAN_REMOTE,
    enabled: true,
    allowTrustedDevices: true,
    trustDurationDays: 90
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/settings.test.ts
```

Expected: FAIL because LAN settings do not exist.

- [ ] **Step 3: Add shared IPC types**

In `src/shared/ipc-channels.ts`, import:

```typescript
import type { LanRemoteSnapshot, LanRemoteCommand, LanRemoteAck } from './lan-remote'
```

Add:

```typescript
export interface LanRemoteStatus {
  enabled: boolean
  host: string
  port: number
}

export interface LanRemotePairingInfo {
  url: string
  secret: string
  expiresAt: number
}
```

Add invoke channels:

```typescript
  'lan-remote:start': { args: [{ host: string; port: number }]; result: LanRemoteStatus }
  'lan-remote:stop': { args: []; result: LanRemoteStatus }
  'lan-remote:get-status': { args: []; result: LanRemoteStatus }
  'lan-remote:create-pairing': { args: [string]; result: LanRemotePairingInfo }
  'lan-remote:publish-state': { args: [LanRemoteSnapshot]; result: void }
  'lan-remote:publish-ack': { args: [LanRemoteAck]; result: void }
```

Add main-to-renderer channel:

```typescript
  'lan-remote:command': [LanRemoteCommand]
  'lan-remote:ack': [LanRemoteAck]
```

- [ ] **Step 4: Add settings**

In `src/renderer/src/stores/settings.ts`, add:

```typescript
export interface LanRemoteSettings {
  enabled: boolean
  selectedHost: string
  allowTrustedDevices: boolean
  trustDurationDays: number
}

export const DEFAULT_LAN_REMOTE: LanRemoteSettings = {
  enabled: false,
  selectedHost: '',
  allowTrustedDevices: false,
  trustDurationDays: 30
}
```

Add normalizer:

```typescript
function normalizeLanRemoteSettings(value: unknown): LanRemoteSettings {
  if (!isRecord(value)) return DEFAULT_LAN_REMOTE
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_LAN_REMOTE.enabled,
    selectedHost: typeof value.selectedHost === 'string' ? value.selectedHost : '',
    allowTrustedDevices:
      typeof value.allowTrustedDevices === 'boolean'
        ? value.allowTrustedDevices
        : DEFAULT_LAN_REMOTE.allowTrustedDevices,
    trustDurationDays: Math.min(
      90,
      Math.max(1, normalizePositiveInteger(value.trustDurationDays, 30))
    )
  }
}
```

Include in `normalizeSettingsState`, `SettingsStore`, initial state, setter, migration, merge, and `partialize`:

```typescript
lanRemote: normalizeLanRemoteSettings(state.lanRemote)
```

```typescript
lanRemote: LanRemoteSettings
setLanRemote: (settings: LanRemoteSettings) => void
```

```typescript
lanRemote: DEFAULT_LAN_REMOTE
```

```typescript
setLanRemote: (settings) => set({ lanRemote: normalizeLanRemoteSettings(settings) })
```

Bump settings version by 1 and add:

```typescript
if (version < 10) {
  state.lanRemote = DEFAULT_LAN_REMOTE
}
```

- [ ] **Step 5: Add IPC handler and preload API**

Create `src/main/ipc/lan-remote.ts`:

```typescript
import { ipcMain } from 'electron'
import { createLanRemoteServer } from '../lan-remote/server'
import type { IpcInvokeMap } from '../../shared/ipc-channels'

const server = createLanRemoteServer({
  commandHandler: async (command) => ({ requestId: command.requestId, status: 'accepted' })
})

export function registerLanRemoteIpc(): void {
  ipcMain.handle('lan-remote:start', async (_event, options: IpcInvokeMap['lan-remote:start']['args'][0]) => {
    await server.start(options)
    return server.getStatus()
  })
  ipcMain.handle('lan-remote:stop', async () => {
    await server.stop()
    return server.getStatus()
  })
  ipcMain.handle('lan-remote:get-status', () => server.getStatus())
  ipcMain.handle('lan-remote:create-pairing', (_event, deviceName: string) =>
    server.createPairingSecret(deviceName)
  )
  ipcMain.handle('lan-remote:publish-state', () => undefined)
  ipcMain.handle('lan-remote:publish-ack', () => undefined)
}
```

In `src/main/index.ts`, call `registerLanRemoteIpc()`.

In `src/preload/index.ts`, add `lanRemoteApi` with `start`, `stop`, `getStatus`, `createPairing`, `publishState`, `publishAck`, `onCommand`, and `onAck`, then expose it under `api`.

- [ ] **Step 6: Run settings test**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/settings.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ipc-channels.ts src/main/ipc/lan-remote.ts src/main/index.ts src/preload/index.ts src/renderer/src/stores/settings.ts src/renderer/src/stores/__tests__/settings.test.ts
git commit -m "feat: add lan remote ipc settings"
```

---

### Task 4: Add Renderer Command Gateway

**Files:**
- Create: `src/renderer/src/lib/lan-remote-command-gateway.ts`
- Create: `src/renderer/src/contexts/LanRemoteBridge.tsx`
- Modify: `src/renderer/src/main.tsx`
- Test: `src/renderer/src/lib/__tests__/lan-remote-command-gateway.test.ts`

- [ ] **Step 1: Write gateway test**

Create `src/renderer/src/lib/__tests__/lan-remote-command-gateway.test.ts`:

```typescript
import { expect, it, vi } from 'vitest'
import { executeLanRemoteCommand } from '@renderer/lib/lan-remote-command-gateway'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

it('executes presentation commands through media projection store', async () => {
  const next = vi.fn()
  useMediaProjectionStore.setState({ next } as never)

  const ack = await executeLanRemoteCommand({ requestId: 'r1', type: 'presentation:next' })

  expect(next).toHaveBeenCalled()
  expect(ack).toEqual({ requestId: 'r1', status: 'accepted' })
})

it('rejects stale jump commands', async () => {
  const ack = await executeLanRemoteCommand({
    requestId: 'r2',
    type: 'presentation:jump',
    index: 1,
    requiredRevision: -1
  })

  expect(ack.status).toBe('rejected')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/lan-remote-command-gateway.test.ts
```

Expected: FAIL because gateway does not exist.

- [ ] **Step 3: Implement gateway**

Create `src/renderer/src/lib/lan-remote-command-gateway.ts`:

```typescript
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useTimerStore } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import type { LanRemoteAck, LanRemoteCommand, LanRemoteSnapshot } from '@shared/lan-remote'

let revision = 0

export async function executeLanRemoteCommand(command: LanRemoteCommand): Promise<LanRemoteAck> {
  if ('requiredRevision' in command && command.requiredRevision !== undefined && command.requiredRevision !== revision) {
    return { requestId: command.requestId, status: 'rejected', reason: 'stale-revision' }
  }

  const projection = useMediaProjectionStore.getState()

  if (command.type === 'presentation:prev') projection.prev()
  if (command.type === 'presentation:next') projection.next()
  if (command.type === 'presentation:jump') projection.jumpTo(command.index)
  if (command.type === 'media:play') projection.setTypeState('video', { status: 'playing' } as never)
  if (command.type === 'media:pause') projection.setTypeState('video', { status: 'paused' } as never)
  if (command.type === 'timer:command') await window.api.timer.timerCommand(command.command)
  if (command.type === 'projection:blank') {
    window.dispatchEvent(new CustomEvent('hhc:lan-remote-blank', { detail: command.enabled }))
  }

  revision++
  return { requestId: command.requestId, status: 'accepted' }
}

export function createLanRemoteSnapshot(isProjectionOpen: boolean, isProjectionBlanked: boolean): LanRemoteSnapshot {
  const projection = useMediaProjectionStore.getState()
  const timer = useTimerStore.getState()
  const stopwatch = useStopwatchStore.getState()
  const current = projection.currentItem()
  const next = projection.nextItem()

  return {
    revision,
    presentation: {
      currentIndex: projection.currentIndex,
      total: projection.playlist.length,
      currentName: current?.name ?? null,
      nextName: next?.name ?? null,
      canPrevious: projection.canPrev(),
      canNext: projection.canNext(),
      isPlaying: projection.isPresenting
    },
    projection: {
      isOpen: isProjectionOpen,
      isBlanked: isProjectionBlanked
    },
    timer: {
      status: timer.status,
      remainingSeconds: timer.remainingSeconds
    },
    stopwatch: {
      status: stopwatch.status,
      elapsedMs: stopwatch.elapsedMs
    }
  }
}
```

- [ ] **Step 4: Add bridge**

Create `src/renderer/src/contexts/LanRemoteBridge.tsx`:

```tsx
import { useEffect } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { createLanRemoteSnapshot, executeLanRemoteCommand } from '@renderer/lib/lan-remote-command-gateway'

export default function LanRemoteBridge(): null {
  const projection = useProjection()

  useEffect(() => {
    return window.api.lanRemote.onCommand((command) => {
      void executeLanRemoteCommand(command).then((ack) => window.api.lanRemote.publishAck?.(ack))
    })
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      void window.api.lanRemote.publishState(
        createLanRemoteSnapshot(projection.isProjectionOpen, projection.isProjectionBlanked)
      )
    }, 1000)
    return () => window.clearInterval(id)
  }, [projection.isProjectionOpen, projection.isProjectionBlanked])

  return null
}
```

Mount `LanRemoteBridge` inside the renderer provider tree in `src/renderer/src/main.tsx`.

- [ ] **Step 5: Run gateway test**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/lan-remote-command-gateway.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/lan-remote-command-gateway.ts src/renderer/src/lib/__tests__/lan-remote-command-gateway.test.ts src/renderer/src/contexts/LanRemoteBridge.tsx src/renderer/src/main.tsx
git commit -m "feat: add lan remote command gateway"
```

---

### Task 5: Add Media Preferences UI

**Files:**
- Modify: `src/renderer/src/components/Control/UserMenu/MediaSettings.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`

- [ ] **Step 1: Add preferences test**

Add to `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`:

```tsx
it('opens LAN remote media preferences', async () => {
  const user = userEvent.setup()
  render(<PreferencesDialog isOpen onOpenChange={vi.fn()} />)

  await user.click(screen.getByTestId('category-media'))
  await user.click(screen.getByTestId('category-media-lanRemote'))

  expect(screen.getByLabelText(/enable lan remote/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: FAIL because `media.lanRemote` section does not exist.

- [ ] **Step 3: Extend MediaSettings section**

In `MediaSettings.tsx`, change:

```typescript
export type MediaSettingsSection = 'general' | 'oneDrive' | 'video' | 'storage' | 'lanRemote'
```

Read settings:

```typescript
const lanRemote = useSettingsStore((s) => s.lanRemote)
const setLanRemote = useSettingsStore((s) => s.setLanRemote)
const [lanRemoteStatus, setLanRemoteStatus] = useState<{ enabled: boolean; host: string; port: number } | null>(null)
```

Add section:

```tsx
{section === 'lanRemote' && (
  <section className="space-y-3 rounded-2xl border border-default-200 p-4">
    <h3 className="text-sm font-semibold">LAN Remote Control</h3>
    <label className="flex items-center gap-2 text-sm">
      <input
        aria-label="Enable LAN remote"
        type="checkbox"
        checked={lanRemote.enabled}
        onChange={(event) => {
          const enabled = event.target.checked
          setLanRemote({ ...lanRemote, enabled })
          void (enabled
            ? window.api.lanRemote.start({ host: lanRemote.selectedHost, port: 0 })
            : window.api.lanRemote.stop()
          ).then(setLanRemoteStatus)
        }}
      />
      Enable LAN remote
    </label>
    <label className="block text-sm">
      Private interface address
      <input
        value={lanRemote.selectedHost}
        onChange={(event) => setLanRemote({ ...lanRemote, selectedHost: event.target.value })}
        className="mt-2 w-full rounded-full border border-default-200 bg-transparent px-4 py-2 text-sm"
      />
    </label>
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={lanRemote.allowTrustedDevices}
        onChange={(event) =>
          setLanRemote({ ...lanRemote, allowTrustedDevices: event.target.checked })
        }
      />
      Allow trusted devices
    </label>
    <label className="block text-sm">
      Trust duration days
      <input
        type="number"
        min={1}
        max={90}
        value={lanRemote.trustDurationDays}
        onChange={(event) =>
          setLanRemote({ ...lanRemote, trustDurationDays: Number(event.target.value) })
        }
        className="mt-2 w-full rounded-full border border-default-200 bg-transparent px-4 py-2 text-sm"
      />
    </label>
    <p className="text-xs text-gray-500">
      {lanRemoteStatus?.enabled
        ? `Remote running at ${lanRemoteStatus.host}:${lanRemoteStatus.port}`
        : 'LAN remote is disabled'}
    </p>
  </section>
)}
```

- [ ] **Step 4: Add PreferencesDialog child**

In `PreferencesDialog.tsx`, add media child:

```typescript
{ id: 'media.lanRemote', labelKey: 'preferences.media.sections.lanRemote' }
```

Add render branch:

```tsx
{activeRoute === 'media.lanRemote' && <MediaSettings section="lanRemote" />}
```

- [ ] **Step 5: Add locale labels**

Add:

```json
"lanRemote": "LAN Remote Control"
```

Use `"LAN 遙控"` in Chinese locales.

- [ ] **Step 6: Run preferences test**

Run:

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/Control/UserMenu/MediaSettings.tsx src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
git commit -m "feat: add lan remote preferences"
```

---

### Task 6: Harden Pairing, Trusted Devices, and Shutdown

**Files:**
- Create: `src/main/lan-remote/trusted-devices.ts`
- Modify: `src/main/lan-remote/server.ts`
- Test: `src/main/lan-remote/__tests__/trusted-devices.test.ts`
- Test: `src/main/lan-remote/__tests__/server-security.test.ts`

- [ ] **Step 1: Write trusted-device tests**

Create `src/main/lan-remote/__tests__/trusted-devices.test.ts`:

```typescript
import { expect, it } from 'vitest'
import { createTrustedDeviceStore } from '../trusted-devices'

it('stores only hashes and expires credentials', async () => {
  const store = createTrustedDeviceStore()
  const credential = await store.addTrustedDevice('Phone', 1, 1000)

  expect(JSON.stringify(store.listTrustedDevices())).not.toContain(credential.secret)
  expect(await store.verifyCredential(credential.id, credential.secret, 1000)).toBe(true)
  expect(await store.verifyCredential(credential.id, credential.secret, 1000 + 2 * 24 * 60 * 60 * 1000)).toBe(false)
})
```

- [ ] **Step 2: Create trusted-device store**

Create `src/main/lan-remote/trusted-devices.ts`:

```typescript
import { createHash, randomBytes } from 'node:crypto'

interface TrustedDeviceRecord {
  id: string
  label: string
  secretHash: string
  createdAt: number
  lastUsedAt: number
  expiresAt: number
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export function createTrustedDeviceStore() {
  const records = new Map<string, TrustedDeviceRecord>()

  return {
    async addTrustedDevice(label: string, durationDays: number, now = Date.now()) {
      const id = randomBytes(16).toString('base64url')
      const secret = randomBytes(32).toString('base64url')
      records.set(id, {
        id,
        label,
        secretHash: hashSecret(secret),
        createdAt: now,
        lastUsedAt: now,
        expiresAt: now + durationDays * 24 * 60 * 60 * 1000
      })
      return { id, secret }
    },
    listTrustedDevices() {
      return [...records.values()].map(({ secretHash: _secretHash, ...record }) => record)
    },
    async verifyCredential(id: string, secret: string, now = Date.now()) {
      const record = records.get(id)
      if (!record || record.expiresAt < now) {
        records.delete(id)
        return false
      }
      if (record.secretHash !== hashSecret(secret)) return false
      record.lastUsedAt = now
      return true
    },
    revokeTrustedDevice(id: string) {
      records.delete(id)
    },
    revokeAllTrustedDevices() {
      records.clear()
    }
  }
}
```

- [ ] **Step 3: Add server security test**

Create `src/main/lan-remote/__tests__/server-security.test.ts`:

```typescript
import { expect, it } from 'vitest'
import { createLanRemoteServer } from '../server'

it('rejects public interface binding', async () => {
  const server = createLanRemoteServer({ commandHandler: async () => ({ requestId: 'x', status: 'accepted' }) })

  await expect(server.start({ host: '8.8.8.8', port: 0 })).rejects.toThrow('private LAN')
})
```

- [ ] **Step 4: Harden server start**

In `src/main/lan-remote/server.ts`, import and check:

```typescript
import { isPrivateLanAddress } from '../../shared/lan-remote'
```

At start of `start()`:

```typescript
if (!isPrivateLanAddress(options.host)) {
  throw new Error('LAN remote requires a private LAN interface')
}
```

Add connection limit, payload size limit, heartbeat, and rate limit in the WebSocket task if WebSocket code is added in this task. Keep constants local:

```typescript
const MAX_CONNECTIONS = 8
const MAX_PAYLOAD_BYTES = 4096
const COMMANDS_PER_MINUTE = 120
```

- [ ] **Step 5: Run security tests**

Run:

```bash
npx vitest run src/main/lan-remote/__tests__/trusted-devices.test.ts src/main/lan-remote/__tests__/server-security.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/lan-remote/trusted-devices.ts src/main/lan-remote/server.ts src/main/lan-remote/__tests__/trusted-devices.test.ts src/main/lan-remote/__tests__/server-security.test.ts
git commit -m "feat: secure lan remote pairing"
```

---

### Task 7: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run src/shared/__tests__/lan-remote.test.ts src/main/lan-remote/__tests__/server.test.ts src/main/lan-remote/__tests__/trusted-devices.test.ts src/main/lan-remote/__tests__/server-security.test.ts src/renderer/src/lib/__tests__/lan-remote-command-gateway.test.ts src/renderer/src/stores/__tests__/settings.test.ts src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run quality gates**

Run:

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Manual verification**

Run:

```bash
npm run dev
```

Expected:
- LAN Remote Control is disabled by default.
- Enabling without a private interface fails with a clear message.
- Enabling on a private LAN interface starts a local URL.
- Pairing URL opens on a phone browser on the same LAN.
- Previous, Next, Jump, Blank, Timer, and Stopwatch commands work.
- No upload/download/file mutation/settings command exists in the mobile UI or shared validator.
- Internet disconnected does not affect paired LAN control.
- Disabling remote stops sessions immediately.

- [ ] **Step 4: Commit final fixes if needed**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: harden lan remote verification"
```

If no fixes were required, do not create an empty commit.

## Self-Review

- Spec coverage: LAN-only Electron service, disabled default, private-interface binding, local mobile UI, command gateway, sanitized state, pairing, one-use secrets, short-lived sessions foundation, trusted-device hashing, preferences, and verification are covered.
- Deferred by design: QR code rendering, controller takeover approval UI, read-only observer mode, Web Crypto challenge-response in the phone UI, and OS keychain storage need explicit product/security decisions before adding complexity.
- Placeholder scan: no banned placeholder phrase or undefined symbol remains.
