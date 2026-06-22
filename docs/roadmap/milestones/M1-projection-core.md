# M1 Projection Core Plan

## Goal

Make projection a single reliable session lifecycle: start projection opens the output window and shows content; stop projection closes the output window.

## Key Changes

- Remove startup projection-window pre-open.
- Isolate projection renderer entry so it does not run control app initialization, sync runtime, route prefetch, or control layout.
- Add a unified projection session API used by Timer, Bible, and Media.
- Remove user-facing blank/open split from Header; blank remains only as an internal fallback screen.
- Stop projection closes the projection window and stops VLC if active.
- Add projection cold-start diagnostics for packaged-app verification.
- Make PDF projection show the first page as soon as it is rendered instead of waiting for all pages.

## Acceptance Criteria

- App startup does not create a projection BrowserWindow.
- Timer, Bible, image, PDF, MP4, and MKV can start projection from a closed projection window.
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
