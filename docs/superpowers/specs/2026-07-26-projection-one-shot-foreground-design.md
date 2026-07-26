# Projection One-shot Foreground Design

## Summary

Explicit projection actions should bring the Electron projection window to the top of the desktop
z-order once. The projection window must not remain always on top, must not take keyboard focus
from the control window, and must not return to the foreground because of background state
updates such as the timer's one-second tick.

This behavior is Electron-only. Browser mode keeps its existing popup behavior and does not try
to work around browser focus restrictions.

## Goals

- Bring an existing projection window to the foreground when the operator explicitly outputs
  Timer, Bible, or Media content.
- Restore a minimized projection window before bringing it forward.
- Keep the control window focused so keyboard operation continues without interruption.
- Allow PowerPoint, a browser, or any other application to cover projection immediately after the
  one-shot foreground action.
- Keep continuous timer ticks, video playback state, loading progress, and other background
  synchronization from changing desktop window order.
- Make mouse and keyboard paths for the same projection command behave consistently.

## Non-goals

- Setting `alwaysOnTop` or maintaining projection above other applications.
- Focusing or activating the projection window.
- Repeatedly polling or enforcing desktop z-order.
- Bringing projection forward when the operator only navigates to Timer, Bible, or Media.
- Adding browser-mode focus or popup workarounds.
- Changing projection ownership, blanking, display selection, or content rendering behavior.

## User-visible behavior

### Actions that bring projection forward once

- Starting or resuming Timer with the on-screen controls.
- Starting or resuming Timer with its Space shortcut.
- Explicitly projecting a Bible verse or Bible payload.
- Starting a Media presentation.
- Explicitly moving to another Media item or presentation slide through buttons, keyboard
  shortcuts, the grid, service cues, or LAN remote commands.
- Re-running an explicit route-aware projection command such as the Header projection action.

If projection is minimized, it is restored first. If it is already visible but covered, it moves
to the top of the z-order. These actions do not give projection keyboard focus.

### Events that do not bring projection forward

- The Timer's one-second `timer:tick`.
- Stopwatch elapsed-time updates.
- Video time, play-state, buffering, or ended-state synchronization.
- Media pan and zoom synchronization.
- Projection readiness, ping/pong, or ownership synchronization.
- Save, thumbnail, cloud-sync, or presentation loading progress.
- Merely navigating between application pages.
- Re-rendering or remounting a control component for an already-running projection session.

Consequently, if another application covers projection while Timer is running, the next second
and every later timer tick leave that application in front. Projection moves forward again only
after another explicit projection action.

## Considered approaches

### Recommended: explicit foreground command through ProjectionContext and Electron IPC

Expose a renderer-side foreground request through the existing ProjectionContext. In Electron it
invokes a main-process IPC handler; in browser mode it is a no-op. Projection start and explicit
content-change paths opt into the command, while background synchronization paths do not.

This keeps intent visible at the command boundary and preserves dual-mode behavior.

### Rejected: foreground every projection payload

Calling the foreground command from the transport adapter would be shorter, but timer ticks and
playback synchronization also use that transport. It would repeatedly cover other applications
and violate the one-shot requirement.

### Rejected: toggle always-on-top briefly

Temporarily enabling and disabling `alwaysOnTop` introduces timing races and can interfere with
other applications. Electron already provides z-order movement without persistent topmost state,
so the topmost flag is unnecessary.

## Architecture

### Main process

Add a focused method to `WindowManager`:

```ts
bringProjectionToFront(): boolean
```

Its behavior is:

1. Return `false` if the projection window does not exist or is destroyed.
2. Call `restore()` when the window is minimized.
3. Ensure a hidden window is shown without activation.
4. Call `moveTop()` to move it to the top of the z-order.
5. Never call `focus()`, `show()`, or `setAlwaysOnTop()`.
6. Return `true` when a live projection window accepted the request.

When a newly created projection window reaches `ready-to-show`, it uses the same non-activating
foreground behavior. This avoids showing an unrendered projection surface.

Add a main-window-only invoke channel:

```ts
'projection:bring-to-front': {
  args: []
  result: { broughtToFront: boolean }
}
```

The IPC handler must reject calls originating from the projection or an unknown window by
returning `{ broughtToFront: false }`.

### Preload

Expose the typed API as:

```ts
window.api.projection.bringToFront(): Promise<{ broughtToFront: boolean }>
```

No Electron object crosses the context bridge.

### Renderer

ProjectionContext owns the environment boundary:

```ts
bringProjectionToFront(): Promise<void>
```

In Electron it invokes the preload method and treats a missing/closed projection as a harmless
no-op. In browser mode it resolves without calling `window.focus()`.

`startProjection()` requests one foreground move for explicit starts. The Media synchronization
path requests it for explicit item or presentation-slide changes, but not for pan, zoom, video
state, or component remount synchronization. `claimProjection()` and plain transport sends never
bring the window forward.

Timer's Space shortcut must use the same `startTimerProjection()` action as the Start and Resume
buttons. This fixes the current behavior gap and ensures the foreground rule is applied once on
keyboard start/resume, not on later timer ticks.

## Ordering and failure behavior

- Content state is queued before requesting foreground so projection can render the intended
  owner and payload as soon as it is visible.
- A closed projection is created normally and moves forward only after `ready-to-show`.
- An IPC or platform failure to move the window must not cancel projection or timer operation.
- Unsupported platforms may return `false`; the projection content flow continues.
- No retry loop is added. A future explicit projection action may request foreground again.

## Testing strategy

### WindowManager tests

- A covered live projection calls `moveTop()` exactly once.
- A minimized projection calls `restore()` before `moveTop()`.
- A hidden projection is shown without activation.
- The method never calls `focus()`, `show()`, or `setAlwaysOnTop()`.
- A missing or destroyed projection returns `false`.
- Initial creation waits for `ready-to-show` before moving forward.

### IPC and preload tests

- The main control window can invoke `projection:bring-to-front`.
- Projection and unknown windows cannot invoke it.
- The typed preload API maps to the expected IPC channel.

### Renderer tests

- Timer button Start and Resume request one foreground move.
- Timer Space Start and Resume use the same projection action and request one foreground move.
- Timer ticks do not request foreground, including ticks one second after another application
  covers projection.
- Bible projection requests one foreground move per explicit projected payload.
- Starting Media requests one foreground move.
- Explicit Media next, previous, jump, and presentation-slide changes request one foreground move.
- Media pan, zoom, video playback updates, and component remount do not request foreground.
- Page navigation and `claimProjection()` do not request foreground.
- Browser mode never calls a window-focus API.

### Regression verification

- `npm run lint`
- `npm run typecheck`
- Targeted WindowManager, projection IPC, ProjectionContext, Timer, Bible, and Media tests.
- `npx vitest run`
- `npm run build`
- Manual Electron verification with projection on a second display:
  1. Start Timer and confirm projection moves forward without stealing control focus.
  2. Cover projection with another application and wait several timer ticks; it remains covered.
  3. Project a Bible verse; projection moves forward once.
  4. Cover it again, then explicitly change Media content; projection moves forward once.
  5. Cover it again and allow passive playback/state updates; it remains covered.
