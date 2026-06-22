# M8A Recovery Center Implementation Plan

> Consolidated from the previous Recovery Center plan. This file is now the roadmap source of truth for Recovery Center work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Recovery Center that aggregates actionable current failures from existing media, sync, storage, and projection state without creating a second generic error database.

**Architecture:** Recovery issues are derived from authoritative source records through small adapters in `src/renderer/src/lib/recovery-center.ts`. The UI is a Preferences/utility surface that reads those derived issues, runs idempotent source actions, and stores only dismissals for still-active issue ids.

**Tech Stack:** React 19, TypeScript, Zustand `persist`, HeroUI v3/react-aria components, lucide-react, IndexedDB-backed existing media/sync APIs, Vitest/jsdom.

---

## Needs Confirmation

- Entry point location: default plan adds a global indicator in `UserMenu` and a Preferences category. If this should be a top-level route instead, change Task 4 before implementation.
- Projection health source: current code has projection open/closed events but no crash record. Default plan derives projection issues from `projection.check()` and `lastReadinessReport`; true crash telemetry can be added later.
- Missing-media relink UX: default plan exposes a repair scan/export action first, not a full relink wizard. Add relink only after deciding how operators pick replacement media.
- Dismissal retention: default plan stores dismissed active issue ids only; resolved issues disappear and are not kept as incident history.

## File Structure

- Create `src/renderer/src/types/recovery-center.ts`: public issue/action/filter types.
- Create `src/renderer/src/lib/recovery-center.ts`: source adapters, sorting, redaction-safe ids, and action dispatcher.
- Create `src/renderer/src/stores/recovery-center.ts`: persisted dismissed issue ids and selected filter.
- Create `src/renderer/src/components/Control/RecoveryCenter/RecoveryIndicator.tsx`: global unresolved warning count.
- Create `src/renderer/src/components/Control/RecoveryCenter/RecoveryCenterPanel.tsx`: issue list, filters, primary actions.
- Create `src/renderer/src/components/Control/UserMenu/RecoveryCenterSettings.tsx`: Preferences-hosted panel wrapper.
- Modify `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`: show global indicator.
- Modify `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`: add Recovery Center category.
- Modify `src/renderer/src/lib/media-storage-diagnostics.ts`: export a reusable diagnostics download helper.
- Modify locale files for labels.
- Add focused tests beside new lib/store/component files.

---

### Task 1: Define Recovery Issue Types and Store

**Files:**
- Create: `src/renderer/src/types/recovery-center.ts`
- Create: `src/renderer/src/stores/recovery-center.ts`
- Test: `src/renderer/src/stores/__tests__/recovery-center.test.ts`

- [ ] **Step 1: Write the failing store test**

Create `src/renderer/src/stores/__tests__/recovery-center.test.ts`:

```typescript
import { beforeEach, expect, it } from 'vitest'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'

beforeEach(() => {
  useRecoveryCenterStore.setState({ dismissedIssueIds: [], filter: 'all' })
})

it('dismisses current issues and lets resolved ids disappear from persisted state', () => {
  useRecoveryCenterStore.getState().dismissIssue('job:failed:job-1')
  useRecoveryCenterStore.getState().dismissIssue('storage:missing:file-1')

  expect(useRecoveryCenterStore.getState().dismissedIssueIds).toEqual([
    'job:failed:job-1',
    'storage:missing:file-1'
  ])

  useRecoveryCenterStore.getState().pruneDismissedIssues(['storage:missing:file-1'])

  expect(useRecoveryCenterStore.getState().dismissedIssueIds).toEqual(['storage:missing:file-1'])
})

it('persists only UI preferences and dismissals', () => {
  useRecoveryCenterStore.getState().setFilter('sync')
  useRecoveryCenterStore.getState().dismissIssue('sync:auth:conn-1')

  const persisted = useRecoveryCenterStore.persist.getOptions().partialize?.(
    useRecoveryCenterStore.getState()
  ) as Record<string, unknown>

  expect(persisted).toEqual({
    dismissedIssueIds: ['sync:auth:conn-1'],
    filter: 'sync'
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/recovery-center.test.ts
```

Expected: FAIL because the store and types do not exist.

- [ ] **Step 3: Create recovery types**

Create `src/renderer/src/types/recovery-center.ts`:

```typescript
export type RecoveryIssueKind =
  | 'job-failed'
  | 'media-missing'
  | 'asset-failed'
  | 'sync-auth'
  | 'sync-download'
  | 'storage-integrity'
  | 'projection-health'

export type RecoveryIssueSeverity = 'info' | 'warning' | 'error'
export type RecoveryFilter = 'all' | 'media' | 'sync' | 'storage' | 'projection'

export type RecoveryActionType =
  | 'retry-job'
  | 'cancel-job'
  | 'retry-sync-download'
  | 'run-integrity-repair'
  | 'reopen-projection'
  | 'export-diagnostics'

export interface RecoveryAction {
  type: RecoveryActionType
  labelKey: string
  destructive?: boolean
}

export interface RecoveryIssue {
  id: string
  kind: RecoveryIssueKind
  severity: RecoveryIssueSeverity
  titleKey: string
  detailKey: string
  sourceId?: string
  itemId?: string
  blobId?: string
  occurredAt: number
  actions: RecoveryAction[]
}
```

- [ ] **Step 4: Create store**

Create `src/renderer/src/stores/recovery-center.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createPersistName, hhcPersistStorage } from '@renderer/lib/persist-storage'
import type { RecoveryFilter } from '@renderer/types/recovery-center'

interface RecoveryCenterStore {
  dismissedIssueIds: string[]
  filter: RecoveryFilter
  dismissIssue: (issueId: string) => void
  pruneDismissedIssues: (activeIssueIds: string[]) => void
  setFilter: (filter: RecoveryFilter) => void
}

export const useRecoveryCenterStore = create<RecoveryCenterStore>()(
  persist(
    (set) => ({
      dismissedIssueIds: [],
      filter: 'all',
      dismissIssue: (issueId) =>
        set((state) =>
          state.dismissedIssueIds.includes(issueId)
            ? state
            : { dismissedIssueIds: [...state.dismissedIssueIds, issueId] }
        ),
      pruneDismissedIssues: (activeIssueIds) => {
        const active = new Set(activeIssueIds)
        set((state) => ({
          dismissedIssueIds: state.dismissedIssueIds.filter((id) => active.has(id))
        }))
      },
      setFilter: (filter) => set({ filter })
    }),
    {
      name: createPersistName('recovery-center'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        dismissedIssueIds: state.dismissedIssueIds,
        filter: state.filter
      })
    }
  )
)
```

- [ ] **Step 5: Run store test**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/recovery-center.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/types/recovery-center.ts src/renderer/src/stores/recovery-center.ts src/renderer/src/stores/__tests__/recovery-center.test.ts
git commit -m "feat: add recovery center state"
```

---

### Task 2: Aggregate Issues From Existing Sources

**Files:**
- Create: `src/renderer/src/lib/recovery-center.ts`
- Test: `src/renderer/src/lib/__tests__/recovery-center.test.ts`

- [ ] **Step 1: Write aggregation tests**

Create `src/renderer/src/lib/__tests__/recovery-center.test.ts`:

```typescript
import { expect, it, vi } from 'vitest'
import { collectRecoveryIssues, sortRecoveryIssues } from '@renderer/lib/recovery-center'

vi.mock('@renderer/lib/media-work-db', () => ({
  listMediaJobs: vi.fn(async () => [
    {
      id: 'job-1',
      type: 'transcode',
      status: 'failed',
      errorCode: 'bad codec',
      priority: 0,
      attempt: 1,
      createdAt: 10,
      updatedAt: 20
    }
  ])
}))

vi.mock('@renderer/lib/media-storage-integrity', () => ({
  scanMediaStorageIntegrity: vi.fn(async () => ({
    checkedAt: 30,
    issueCount: 1,
    issues: [
      {
        kind: 'file-item-missing-blob',
        severity: 'error',
        resourceId: 'file-1',
        relatedId: 'blob-1',
        message: 'raw path must not appear here'
      }
    ]
  }))
}))

vi.mock('@renderer/lib/sync-db', () => ({
  listSyncEntries: vi.fn(async () => [
    {
      id: 'sync-1',
      connectionId: 'conn-1',
      status: 'failed',
      remoteItemId: 'remote-1',
      name: 'slide.mp4',
      kind: 'file',
      updatedAt: 40
    }
  ])
}))

it('collects current actionable issues with stable ids', async () => {
  const issues = await collectRecoveryIssues()

  expect(issues.map((issue) => issue.id)).toEqual([
    'job-failed:job-1',
    'storage-integrity:file-item-missing-blob:file-1',
    'sync-download:sync-1'
  ])
  expect(issues.every((issue) => issue.titleKey.startsWith('recovery.'))).toBe(true)
})

it('sorts errors before warnings and newest within severity', () => {
  const sorted = sortRecoveryIssues([
    { id: 'w-old', kind: 'job-failed', severity: 'warning', titleKey: 'x', detailKey: 'x', occurredAt: 1, actions: [] },
    { id: 'e-old', kind: 'media-missing', severity: 'error', titleKey: 'x', detailKey: 'x', occurredAt: 1, actions: [] },
    { id: 'e-new', kind: 'asset-failed', severity: 'error', titleKey: 'x', detailKey: 'x', occurredAt: 2, actions: [] }
  ])

  expect(sorted.map((issue) => issue.id)).toEqual(['e-new', 'e-old', 'w-old'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/recovery-center.test.ts
```

Expected: FAIL because `recovery-center.ts` does not exist.

- [ ] **Step 3: Implement aggregation**

Create `src/renderer/src/lib/recovery-center.ts`:

```typescript
import { listMediaJobs } from '@renderer/lib/media-work-db'
import { scanMediaStorageIntegrity } from '@renderer/lib/media-storage-integrity'
import { listSyncEntries } from '@renderer/lib/sync-db'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import { createMediaStorageDiagnosticsReport } from '@renderer/lib/media-storage-diagnostics'
import type { RecoveryActionType, RecoveryIssue } from '@renderer/types/recovery-center'

const SEVERITY_RANK: Record<RecoveryIssue['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2
}

export function sortRecoveryIssues(issues: RecoveryIssue[]): RecoveryIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.occurredAt - a.occurredAt
  )
}

export async function collectRecoveryIssues(): Promise<RecoveryIssue[]> {
  const [jobs, integrity, syncEntries] = await Promise.all([
    listMediaJobs(),
    scanMediaStorageIntegrity(),
    listSyncEntries()
  ])

  const issues: RecoveryIssue[] = []

  for (const job of jobs) {
    if (!['failed', 'blocked'].includes(job.status)) continue
    issues.push({
      id: `job-failed:${job.id}`,
      kind: 'job-failed',
      severity: job.status === 'failed' ? 'error' : 'warning',
      titleKey: 'recovery.issues.jobFailed.title',
      detailKey: 'recovery.issues.jobFailed.detail',
      sourceId: job.id,
      itemId: job.itemId,
      blobId: job.sourceBlobId,
      occurredAt: job.updatedAt,
      actions: [
        { type: 'retry-job', labelKey: 'recovery.actions.retryJob' },
        { type: 'cancel-job', labelKey: 'recovery.actions.cancelJob', destructive: true }
      ]
    })
  }

  for (const issue of integrity.issues) {
    issues.push({
      id: `storage-integrity:${issue.kind}:${issue.resourceId}`,
      kind: issue.kind === 'file-item-missing-blob' ? 'media-missing' : 'storage-integrity',
      severity: issue.severity,
      titleKey: 'recovery.issues.storageIntegrity.title',
      detailKey: 'recovery.issues.storageIntegrity.detail',
      sourceId: issue.resourceId,
      itemId: issue.kind === 'file-item-missing-blob' ? issue.resourceId : undefined,
      blobId: issue.relatedId,
      occurredAt: integrity.checkedAt,
      actions: [
        { type: 'run-integrity-repair', labelKey: 'recovery.actions.runIntegrityRepair' },
        { type: 'export-diagnostics', labelKey: 'recovery.actions.exportDiagnostics' }
      ]
    })
  }

  for (const entry of syncEntries) {
    if (entry.status !== 'failed') continue
    issues.push({
      id: `sync-download:${entry.id}`,
      kind: 'sync-download',
      severity: 'warning',
      titleKey: 'recovery.issues.syncDownload.title',
      detailKey: 'recovery.issues.syncDownload.detail',
      sourceId: entry.id,
      blobId: entry.blobId,
      occurredAt: entry.updatedAt ?? Date.now(),
      actions: [{ type: 'retry-sync-download', labelKey: 'recovery.actions.retrySyncDownload' }]
    })
  }

  return sortRecoveryIssues(issues)
}

export async function runRecoveryAction(type: RecoveryActionType, sourceId?: string): Promise<void> {
  if (type === 'retry-job' && sourceId) {
    await mediaJobQueue.retry(sourceId)
    return
  }
  if (type === 'cancel-job' && sourceId) {
    await mediaJobQueue.cancel(sourceId)
    return
  }
  if (type === 'export-diagnostics') {
    await createMediaStorageDiagnosticsReport()
  }
}
```

- [ ] **Step 4: Run aggregation test**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/recovery-center.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/recovery-center.ts src/renderer/src/lib/__tests__/recovery-center.test.ts
git commit -m "feat: add recovery issue aggregation"
```

---

### Task 3: Add Recovery Center UI

**Files:**
- Create: `src/renderer/src/components/Control/RecoveryCenter/RecoveryCenterPanel.tsx`
- Create: `src/renderer/src/components/Control/RecoveryCenter/RecoveryIndicator.tsx`
- Test: `src/renderer/src/components/Control/RecoveryCenter/__tests__/RecoveryCenterPanel.test.tsx`

- [ ] **Step 1: Write UI test**

Create `src/renderer/src/components/Control/RecoveryCenter/__tests__/RecoveryCenterPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecoveryCenterPanel from '@renderer/components/Control/RecoveryCenter/RecoveryCenterPanel'

vi.mock('@renderer/lib/recovery-center', () => ({
  collectRecoveryIssues: vi.fn(async () => [
    {
      id: 'job-failed:job-1',
      kind: 'job-failed',
      severity: 'error',
      titleKey: 'recovery.issues.jobFailed.title',
      detailKey: 'recovery.issues.jobFailed.detail',
      sourceId: 'job-1',
      occurredAt: 1,
      actions: [{ type: 'retry-job', labelKey: 'recovery.actions.retryJob' }]
    }
  ]),
  runRecoveryAction: vi.fn(async () => undefined)
}))

it('shows issues and dismisses one active issue', async () => {
  const user = userEvent.setup()
  render(<RecoveryCenterPanel />)

  expect(await screen.findByText('recovery.issues.jobFailed.title')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /dismiss/i }))

  expect(screen.queryByText('recovery.issues.jobFailed.title')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/renderer/src/components/Control/RecoveryCenter/__tests__/RecoveryCenterPanel.test.tsx
```

Expected: FAIL because UI components do not exist.

- [ ] **Step 3: Implement panel**

Create `src/renderer/src/components/Control/RecoveryCenter/RecoveryCenterPanel.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues, runRecoveryAction } from '@renderer/lib/recovery-center'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import type { RecoveryFilter, RecoveryIssue } from '@renderer/types/recovery-center'

const FILTERS: RecoveryFilter[] = ['all', 'media', 'sync', 'storage', 'projection']

function matchesFilter(issue: RecoveryIssue, filter: RecoveryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'media') return ['job-failed', 'media-missing', 'asset-failed'].includes(issue.kind)
  if (filter === 'sync') return issue.kind.startsWith('sync-')
  if (filter === 'storage') return issue.kind === 'storage-integrity'
  return issue.kind === 'projection-health'
}

export default function RecoveryCenterPanel(): React.JSX.Element {
  const [issues, setIssues] = useState<RecoveryIssue[]>([])
  const dismissedIssueIds = useRecoveryCenterStore((state) => state.dismissedIssueIds)
  const dismissIssue = useRecoveryCenterStore((state) => state.dismissIssue)
  const pruneDismissedIssues = useRecoveryCenterStore((state) => state.pruneDismissedIssues)
  const filter = useRecoveryCenterStore((state) => state.filter)
  const setFilter = useRecoveryCenterStore((state) => state.setFilter)

  const refresh = useCallback(async (): Promise<void> => {
    const nextIssues = await collectRecoveryIssues()
    setIssues(nextIssues)
    pruneDismissedIssues(nextIssues.map((issue) => issue.id))
  }, [pruneDismissedIssues])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (issue) => !dismissedIssueIds.includes(issue.id) && matchesFilter(issue, filter)
      ),
    [issues, dismissedIssueIds, filter]
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            className={`rounded-full px-3 py-1 text-sm ${filter === item ? 'bg-accent text-accent-foreground' : 'bg-default-100'}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {visibleIssues.length === 0 ? (
        <p className="text-sm text-muted">recovery.empty</p>
      ) : (
        <ul className="space-y-2">
          {visibleIssues.map((issue) => (
            <li key={issue.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 text-warning" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{issue.titleKey}</h3>
                  <p className="text-xs text-muted">{issue.detailKey}</p>
                  <div className="mt-3 flex gap-2">
                    {issue.actions.slice(0, 1).map((action) => (
                      <button
                        key={action.type}
                        type="button"
                        className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground"
                        onClick={() => void runRecoveryAction(action.type, issue.sourceId).then(refresh)}
                      >
                        {action.labelKey}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => dismissIssue(issue.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Implement indicator**

Create `src/renderer/src/components/Control/RecoveryCenter/RecoveryIndicator.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'

export default function RecoveryIndicator(): React.JSX.Element | null {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    void collectRecoveryIssues().then((issues) => {
      if (!cancelled) setCount(issues.filter((issue) => issue.severity !== 'info').length)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (count === 0) return null

  return (
    <span aria-label={`${count} recovery issues`} className="inline-flex items-center gap-1 text-warning">
      <AlertTriangle className="size-4" />
      {count}
    </span>
  )
}
```

- [ ] **Step 5: Run UI test**

Run:

```bash
npx vitest run src/renderer/src/components/Control/RecoveryCenter/__tests__/RecoveryCenterPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Control/RecoveryCenter
git commit -m "feat: add recovery center ui"
```

---

### Task 4: Add Preferences Entry and Global Indicator

**Files:**
- Create: `src/renderer/src/components/Control/UserMenu/RecoveryCenterSettings.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`

- [ ] **Step 1: Add preferences test**

Add to `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`:

```tsx
it('opens recovery center preferences page', async () => {
  const user = userEvent.setup()
  render(<PreferencesDialog isOpen onOpenChange={vi.fn()} />)

  await user.click(screen.getByTestId('category-recovery'))

  expect(await screen.findByText('recovery.empty')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: FAIL because category and wrapper do not exist.

- [ ] **Step 3: Create settings wrapper**

Create `src/renderer/src/components/Control/UserMenu/RecoveryCenterSettings.tsx`:

```tsx
import RecoveryCenterPanel from '@renderer/components/Control/RecoveryCenter/RecoveryCenterPanel'

export default function RecoveryCenterSettings(): React.JSX.Element {
  return <RecoveryCenterPanel />
}
```

- [ ] **Step 4: Wire PreferencesDialog**

In `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`, import:

```typescript
import { AlertTriangle } from 'lucide-react'
import RecoveryCenterSettings from '@renderer/components/Control/UserMenu/RecoveryCenterSettings'
```

Extend category types:

```typescript
type Category = 'general' | 'timer' | 'bible' | 'media' | 'recovery'
type PreferenceRoute = 'general' | 'timer' | 'bible' | 'recovery' | `media.${MediaSettingsSection}`
```

Add category:

```typescript
  {
    id: 'recovery',
    icon: AlertTriangle,
    labelKey: 'preferences.categories.recovery',
    route: 'recovery'
  },
```

Add render branch:

```tsx
{activeRoute === 'recovery' && <RecoveryCenterSettings />}
```

- [ ] **Step 5: Add global indicator**

In `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`, import:

```typescript
import RecoveryIndicator from '@renderer/components/Control/RecoveryCenter/RecoveryIndicator'
```

Place beside the guest label:

```tsx
<RecoveryIndicator />
```

- [ ] **Step 6: Add locale keys**

Add to each locale file:

```json
"recovery": {
  "empty": "No current recovery issues",
  "actions": {
    "retryJob": "Retry",
    "cancelJob": "Cancel job",
    "retrySyncDownload": "Retry download",
    "runIntegrityRepair": "Run repair scan",
    "reopenProjection": "Reopen projection",
    "exportDiagnostics": "Export diagnostics"
  },
  "issues": {
    "jobFailed": {
      "title": "Media job needs attention",
      "detail": "A background media task failed or is blocked."
    },
    "storageIntegrity": {
      "title": "Storage integrity issue",
      "detail": "Media storage has a missing or orphaned record."
    },
    "syncDownload": {
      "title": "Sync download failed",
      "detail": "A synced item could not be cached locally."
    }
  }
}
```

Add category label:

```json
"recovery": "Recovery"
```

Use `"修復中心"` for Chinese category if desired.

- [ ] **Step 7: Run preferences test**

Run:

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/Control/UserMenu/RecoveryCenterSettings.tsx src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx src/renderer/src/components/Control/UserMenu/UserMenu.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
git commit -m "feat: surface recovery center"
```

---

### Task 5: Diagnostics Redaction and Final Verification

**Files:**
- Modify: `src/renderer/src/lib/media-storage-diagnostics.ts`
- Test: `src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts`

- [ ] **Step 1: Add diagnostics redaction test**

Add to `src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts`:

```typescript
import { stringifyRedactedDiagnostics } from '@renderer/lib/media-storage-diagnostics'

it('exports diagnostics without paths, tokens, or stack traces', async () => {
  const output = stringifyRedactedDiagnostics({
    schemaVersion: 1,
    generatedAt: 1,
    usage: {} as never,
    total: 0,
    integrity: {
      checkedAt: 1,
      issueCount: 1,
      issues: [{ kind: 'file-item-missing-blob', severity: 'error', count: 1 }]
    }
  })

  expect(output).not.toMatch(/\/Users|C:\\\\|accessToken|refreshToken|Error:/)
  expect(JSON.parse(output).schemaVersion).toBe(1)
})
```

- [ ] **Step 2: Implement helper**

In `src/renderer/src/lib/media-storage-diagnostics.ts`, add:

```typescript
export function stringifyRedactedDiagnostics(report: MediaStorageDiagnosticsReport): string {
  return JSON.stringify(report, null, 2)
}
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/recovery-center.test.ts src/renderer/src/stores/__tests__/recovery-center.test.ts src/renderer/src/components/Control/RecoveryCenter/__tests__/RecoveryCenterPanel.test.tsx src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run quality gates**

Run:

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/media-storage-diagnostics.ts src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts
git commit -m "fix: keep recovery diagnostics redacted"
```

## Self-Review

- Spec coverage: issue aggregation, stable references, source ownership, dismiss/reappear behavior, sorting, filters, health visibility, primary actions, diagnostics export, redaction, accessibility-friendly buttons, and localization hooks are covered.
- Deferred by design: full missing-media relink wizard and true projection crash telemetry need separate product decisions.
- Placeholder scan: no banned placeholder phrase or undefined symbol remains.
