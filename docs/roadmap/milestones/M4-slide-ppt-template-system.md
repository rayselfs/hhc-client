# M4 Slide / PPT / Template System Plan

## Goal

Build LibrePresenter's native slide system first, then add PPTX import on top of that model.

## Key Changes

- Define a native slide document model.
- Add slide projection renderer.
- Add slide editor for text, image, background, and basic layout.
- Add themes/templates for typography, spacing, and background defaults.
- Add lyrics-friendly slide groups.
- Add PPTX import after the native slide model is stable.
- Treat PPTX export as future work unless a real workflow requires it.

## Acceptance Criteria

- Users can create, edit, save, and project native LibrePresenter slides.
- Slides can be inserted into service playlists.
- Templates can be reused across slide groups.
- PPTX import maps into the native slide model instead of becoming a separate projection path.

## Verification

```bash
npx vitest run src/renderer/src/lib/__tests__/slide-document.test.ts
npx vitest run src/renderer/src/components/Projection/__tests__/SlideProjection.test.tsx
npx vitest run src/renderer/src/components/Control/Slides/__tests__
npm run typecheck
npm run lint
```
