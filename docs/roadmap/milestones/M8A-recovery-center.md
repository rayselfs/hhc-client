# M8A Recovery Center

## Status

Implemented as a derived diagnostics surface.

## Goal

Aggregate actionable current failures from existing media, sync, storage, and projection state without creating a second generic error database.

## Implemented Scope

- Recovery issue types and persisted UI state.
- Derived issue aggregation from authoritative source records.
- Recovery Center panel in Preferences.
- Global recovery indicator in the user menu.
- Dismissal handling for active issues only.
- Redaction-safe diagnostics export helpers.
- Source actions for repair-oriented flows where available.

## Source Anchors

- `src/renderer/src/types/recovery-center.ts`
- `src/renderer/src/stores/recovery-center.ts`
- `src/renderer/src/lib/recovery-center.ts`
- `src/renderer/src/components/Control/RecoveryCenter/`
- `src/renderer/src/components/Control/UserMenu/RecoveryCenterSettings.tsx`
- `src/renderer/src/lib/media-storage-diagnostics.ts`

## Acceptance Criteria

- Recovery Center derives issues from existing app state.
- Resolved issues disappear without needing manual cleanup.
- Dismissed active issues stay dismissed until source state changes.
- Diagnostics exports are redaction-safe.
- Recovery UI is available from Preferences and surfaced by a global indicator.
- The feature does not create an independent incident database.

## Verification

```bash
npx vitest run src/renderer/src/stores/__tests__/recovery-center.test.ts
npx vitest run src/renderer/src/lib/__tests__/recovery-center.test.ts
npx vitest run src/renderer/src/components/Control/RecoveryCenter/__tests__/RecoveryCenterPanel.test.tsx
npx vitest run src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts
npm run typecheck
npm run lint
```

## Follow-Up Candidates

- Missing-media relink wizard.
- Projection crash telemetry if the main process can record durable crash events.
- Recovery history view if operators need incident audit trails.
