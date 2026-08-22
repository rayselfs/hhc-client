# M5 Bible Professional Workflow Plan

## Goal

Upgrade the existing Bible page into a live scripture workflow integrated with service cues and projection templates.

## Key Changes

- Keep the existing Bible data/store foundation.
- Add Bible quick search optimized for live operation.
- Add verse queue and Bible cue creation.
- Add lower-third and full-screen scripture modes.
- Add scripture templates using the M4 template system.
- Add multi-version display, such as Chinese/English side-by-side.
- Add clearer operator preview/current/next state.

## Acceptance Criteria

- Bible passages can be added to a service playlist.
- Scripture projection can use templates.
- Operators can search and queue verses without leaving the live flow.
- Existing Bible projection behavior remains usable during migration.

## Verification

```bash
npx vitest run src/renderer/src/components/Control/Bible/__tests__
npx vitest run src/renderer/src/lib/__tests__/bible-utils.test.ts
npm run typecheck
npm run lint
```
