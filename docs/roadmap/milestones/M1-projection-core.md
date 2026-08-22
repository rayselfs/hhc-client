# M1 Projection Core Plan

## Goal

Make projection a single reliable session lifecycle: start projection opens the output window and shows content; stop projection closes the output window.

## Key Changes

- Remove startup projection-window pre-open.
- Isolate projection renderer entry so it does not run control app initialization, sync runtime, route prefetch, or control layout.
- Add a unified projection session API used by Timer, Bible, and Media.
- Route the Header projection button through one projection action path instead of page-local branching.
- Route all start-projection commands through the thin projection command layer.
- Make `F5` the route-aware start-projection shortcut; keep `Shift+F5` for Files start-from-current.
- Send Timer's initial projection payload when starting the Timer projection session.
- Remove user-facing blank/open split from Header; blank remains only as an internal fallback screen.
- Remove LAN remote blank control.
- Stop projection closes the projection window and stops VLC if active.
- Add projection cold-start diagnostics for packaged-app verification.
- Make PDF projection show the first page as soon as it is rendered instead of waiting for all pages.

## Acceptance Criteria

- App startup does not create a projection BrowserWindow.
- Timer, Bible, image, PDF, MP4, and MKV can start projection from a closed projection window.
- Header starts Timer projection from `/timer`, replays the last Bible payload from `/bible`, and starts the current folder presentation from `/files`.
- Header and `F5` share the same route availability rules: Bible requires a last payload; Files requires at least one presentable item; open projection makes `F5` a no-op.
- Closing and reopening Timer projection immediately shows Timer content without requiring a timer mode change.
- Header only stops an open projection; it does not switch content just because the operator navigates to Bible or Media.
- Stop projection closes the projection window.
- Projection route does not import the control router/layout.
- Projection failures do not leave hidden VLC/native surfaces blocking the output.

## Verification

```bash
npx vitest run src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
npx vitest run src/renderer/src/pages/__tests__/ProjectionPage.test.tsx
npx vitest run src/renderer/src/components/Control/Header/__tests__/Header.test.tsx
npx vitest run src/renderer/src/lib/__tests__/media-projection-sync.test.ts
npm run typecheck
npm run lint
```
