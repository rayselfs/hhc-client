# M6 Professional Media Playback Plan

## Goal

Make image, PDF, and video playback production-grade and reusable across File Explorer, Service playlists, Projection, and future tools.

## Key Changes

- Keep desktop video playback on VLC/libVLC.
- Keep web video playback browser-native.
- Make media metadata, poster, URL resolution, and cleanup page-agnostic services.
- Improve large media startup latency.
- Keep failed media from closing Presenter.
- Keep unsupported format handling clear and non-destructive.
- Ensure projection playback state stays synchronized with control UI.
- Keep PDF render scheduling responsive.

## Acceptance Criteria

- Image, PDF, browser-native video, and VLC-backed video all project reliably.
- Media failures show actionable state without exiting the presentation session.
- Copied media shares canonical blob identity.
- Web unsupported media is clearly marked and excluded from present lists.
- Media services are not tied to File Explorer or Presenter component state.

## Verification

```bash
npx vitest run src/renderer/src/lib/__tests__/media-metadata.test.ts
npx vitest run src/renderer/src/lib/__tests__/presentation-readiness.test.ts
npx vitest run src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
npm run typecheck
npm run lint
```
