# Admin Media Follow-up Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct six verified Admin media-folder presentation details and the LINE duplicate-binding reply without changing API, database, or binding semantics.

**Architecture:** Keep the existing Asset DTO and LINE binding constraints authoritative. Make presentation-only changes in Admin, centralize the duplicated LINE reply beside its handler, and deliver the two repositories as independent TDD-reviewed changes. Release LINE before Admin only to keep production verification sequential; there is no runtime dependency between them.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, LINE bot TypeScript, PostgreSQL-backed binding semantics, GitHub Actions, Azure Container Apps and static Blob hosting.

**Spec:** No separate spec is retained; the approved 2026-08-20 follow-up decisions are restated verbatim in Global Constraints below.

**SDD Workspace:** `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections`

## Global Constraints

- Use fresh worktrees from each repository's current `origin/main`; never edit or commit directly on `main`.
- Use TDD for every behavior change: observe the focused test fail before production edits, then make the minimum change.
- Admin supports exactly `zh-Hant`, `zh-Hans`, and `en`; update all three locales.
- Folder delete action copy is `刪除資料夾` / `删除资料夹` / `Delete folder`; the destructive description remains unchanged.
- When a collection is already bound, remove the extra retention divider because the binding detail list already ends with a line. Keep the divider for pending and unbound collections.
- A selected ACL user chip shows only the resolved display name. Search results retain email descriptions for same-name disambiguation.
- List-view file type is the upper-cased filename extension, such as `PPTX`; fall back to the raw MIME type only when the filename has no extension. Do not add a MIME mapping table or change the API DTO.
- The last list column header is `保留` / `保留` / `Retention`. A normal item shows the collection policy as `{days} 天` / `{days} 天` / `{days} days`; an exempt item shows `永久` / `永久` / `Permanent`.
- The same-group duplicate `/media-sync` reply is exactly `已經綁定過，無法二次綁定。` in both the fast precheck and atomic result paths.
- Keep `這個媒體資料夾已綁定其他群組。` unchanged. Reusing a consumed code in a second group still returns `綁定碼無效、已過期或已使用。`.
- Do not modify Asset API, Admin/LINE API DTOs, PostgreSQL schema, binding cardinality, code consumption, deletion lifecycle, retention job configuration, or shared UI packages.
- Do not fabricate a LINE group command or mutate production media for acceptance. Use an existing authenticated Admin session only for read-only verification.

---

## File Map

| Repository | File | Responsibility |
| --- | --- | --- |
| `admin-fe` | `src/pages/MediaSyncPage.tsx` | Folder header, conditional retention divider, ACL chip content, and collection retention handoff. |
| `admin-fe` | `src/pages/media-sync/MediaLibrarySection.tsx` | Optional `retentionDays` with a 14-day fallback, extension display, and retention column values. |
| `admin-fe` | `src/preferences/locale-context.tsx` | Three-locale folder-delete and retention presentation copy. |
| `admin-fe` | `src/preferences/locale-context.test.tsx` | Exact three-locale copy regressions. |
| `admin-fe` | `src/index.css` | Bound-only removal of the duplicate divider and dead ACL email styling. |
| `admin-fe` | `src/pages/MediaSyncPage.test.tsx` | Folder-card, delete-copy, ACL-chip, conditional-divider, and retention-prop regressions. |
| `admin-fe` | `src/pages/media-sync/MediaLibrarySection.test.tsx` | PPTX type and normal/permanent retention table regressions. |
| `hhc-line-function-bot` | `src/transport/line/public-access-commands.ts` | Single source for the same-group duplicate-binding reply. |
| `hhc-line-function-bot` | `src/__tests__/entrance.test.ts` | Fast-precheck and atomic-result exact reply regressions. |

---

### Task 1: Correct the Admin folder and media-list presentation

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui/src/pages/MediaSyncPage.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui/src/pages/media-sync/MediaLibrarySection.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui/src/preferences/locale-context.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui/src/index.css`
- Test: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui/src/pages/MediaSyncPage.test.tsx`
- Test: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui/src/pages/media-sync/MediaLibrarySection.test.tsx`
- Test: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui/src/preferences/locale-context.test.tsx`

**Interfaces:**
- Consumes: `MediaSyncManagedCollection.collection.retentionDays: number`, `ManagedMediaItem.displayName`, `ManagedMediaItem.mimeType`, and `ManagedMediaItem.retentionExempt`.
- Produces: the detail page passes the authoritative collection `retentionDays`; the component keeps its existing optional test/default boundary and defaults missing values to `14`. No API or shared-package interface changes.

- [ ] **Step 1: Create an isolated Admin worktree**

```bash
mkdir -p /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup
git -C /Users/rayselfs/Projects/hhc/website/admin-fe fetch origin
git -C /Users/rayselfs/Projects/hhc/website/admin-fe worktree add \
  /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui \
  -b codex/media-folder-ui-copy origin/main
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui
```

Verify the new worktree is clean and `origin/main` is the merge base.

- [ ] **Step 2: Write failing folder-card and ACL tests**

Extend `MediaSyncPage.test.tsx` so the bound fixture asserts:

```tsx
const retentionSection = within(bindingCard)
  .getByRole('spinbutton', { name: 'retentionDays' })
  .closest('.media-sync-retention-section')
expect(retentionSection).toHaveClass('media-sync-retention-section--bound')

expect(within(userChip).getByText('A very long reader name that must not widen the access card'))
  .toBeInTheDocument()
expect(within(userChip).queryByText('reader@example.com')).not.toBeInTheDocument()
```

Add parameterized detail fixtures for `binding: null`, pending binding, and active binding. Assert only the active binding gets `media-sync-retention-section--bound`. Keep the existing searchable-select assertion proving `grace@example.com` remains visible inside the option.

Update the locale mock in this file so only the new formatted value is real while all other keys retain existing behavior:

```ts
vi.mock('../preferences/locale-context', () => ({
  useLocale: () => ({
    locale: 'zh-Hant',
    messages: new Proxy({ retentionPeriod: '{days} 天', permanentRetention: '永久' }, {
      get: (target, key) => target[key as keyof typeof target] ?? String(key),
    }),
  }),
}))
```

Extend the 30-day detail test with one normal media item, open list view through the existing `viewMode` menu, and assert `30 天`. This proves the page passes the collection value rather than relying on the component's fallback:

```ts
vi.spyOn(MediaSyncApi.prototype, 'listCollectionItems').mockResolvedValue({
  items: [{
    id: 'item-1', displayName: 'slides.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    sizeBytes: 1234, createdAt: '2026-08-18T12:34:56.000Z', retentionExempt: false,
  }],
  hasMore: false,
})
renderPage('/media-sync/collection-1')
await userEvent.click(screen.getByRole('button', { name: 'viewMode' }))
await userEvent.click(screen.getByRole('menuitemradio', { name: 'listView' }))
expect(await screen.findByText('30 天')).toBeInTheDocument()
```

The page test mocks locale values as message keys, so keep its existing `deleteMediaCollection` button assertion. In `locale-context.test.tsx`, add this probe:

```tsx
function MediaFolderPresentationMessages() {
  const { messages } = useLocale()
  return <>
    <p>{messages.deleteMediaCollection}</p>
    <p>{messages.retentionState}</p>
    <p>{messages.retentionPeriod}</p>
    <p>{messages.permanentRetention}</p>
  </>
}
```

Use this exact locale table:

```ts
it.each([
  ['zh-Hant', '刪除資料夾', '保留', '{days} 天', '永久'],
  ['zh-Hans', '删除资料夹', '保留', '{days} 天', '永久'],
  ['en', 'Delete folder', 'Retention', '{days} days', 'Permanent'],
] as const)('keeps media folder presentation copy in %s',
  (locale, deleteFolder, retention, retentionPeriod, permanent) => {
    document.cookie = `hhc_admin_locale=${locale}; Path=/`
    render(<LocaleProvider><MediaFolderPresentationMessages /></LocaleProvider>)
    expect(screen.getByText(deleteFolder)).toBeInTheDocument()
    expect(screen.getByText(retention)).toBeInTheDocument()
    expect(screen.getByText(retentionPeriod)).toBeInTheDocument()
    expect(screen.getByText(permanent)).toBeInTheDocument()
  })
```

- [ ] **Step 3: Write failing media table tests**

In `MediaLibrarySection.test.tsx`, make the list-view fixture include both:

```ts
{
  ...item('slides'),
  displayName: 'service-slides.pptx',
  mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  retentionExempt: false,
},
{
  ...item('archive'),
  displayName: 'archive.pdf',
  mimeType: 'application/pdf',
  retentionExempt: true,
},
{
  ...item('readme'),
  displayName: 'README',
  mimeType: 'text/plain',
  retentionExempt: false,
},
```

Render with `retentionDays={30}` and assert:

```tsx
expect(within(table).getByRole('columnheader', { name: '保留' })).toBeInTheDocument()
expect(within(slidesRow).getByText('PPTX')).toBeInTheDocument()
expect(within(slidesRow).queryByText(slides.mimeType)).not.toBeInTheDocument()
expect(within(slidesRow).getByText('30 天')).toBeInTheDocument()
expect(within(archiveRow).getByText('永久')).toBeInTheDocument()
expect(within(readmeRow).getByText('text/plain')).toBeInTheDocument()
```

Also add a filename-without-extension case and assert that its cell falls back to the raw MIME type.

- [ ] **Step 4: Run the focused tests and verify RED**

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui
pnpm vitest run src/pages/MediaSyncPage.test.tsx \
  src/pages/media-sync/MediaLibrarySection.test.tsx \
  src/preferences/locale-context.test.tsx
```

Expected failures must include the old delete copy, unconditional divider, chip email, raw PPTX MIME, `保留狀態`, and `依保留政策`. If a new assertion already passes, confirm it still targets the intended production behavior before continuing.

- [ ] **Step 5: Implement the minimum Admin changes**

In `MediaSyncPage.tsx`:

```tsx
<div className={`media-sync-retention-section${item.binding
  ? ' media-sync-retention-section--bound'
  : ''}`}>
```

Remove only the `<small>{subjectUsers[acl.subjectId].email}</small>` branch from the selected chip. Do not change `SearchableSelect` items. Pass the collection policy into the media manager:

```tsx
<MediaLibrarySection
  api={mediaApi}
  collectionId={item.collection.id}
  query={query}
  retentionDays={item.collection.retentionDays}
/>
```

In `index.css`, keep the base divider and remove it only for the bound modifier:

```css
.media-sync-retention-section--bound {
  border-top: 0;
  padding-top: 0;
}
```

Remove the now-dead `.media-sync-acl-chip-label small` selector while retaining the name truncation styles.

In `MediaLibrarySection.tsx`, keep `retentionDays` optional and consume it with the existing 14-day fallback:

```ts
type MediaLibrarySectionProps = {
  api: MediaSyncApi
  collectionId: string
  query?: string
  retentionDays?: number
}

function MediaLibraryCollection({
  api,
  collectionId,
  query = '',
  retentionDays = 14,
}: MediaLibrarySectionProps) {
```

Reuse `splitName()` rather than adding a MIME table:

```ts
function formatFileType(item: ManagedMediaItem) {
  const extension = splitName(item.displayName)[1].slice(1)
  return extension ? extension.toUpperCase() : item.mimeType
}
```

Render the two revised cells:

```tsx
<th>{messages.retentionState}</th>
// ...
<td>{formatFileType(item)}</td>
// ...
<td>{item.retentionExempt
  ? messages.permanentRetention
  : formatMessage(messages.retentionPeriod, { days: String(retentionDays) })}</td>
```

In `locale-context.tsx`, use these exact values:

| Key | `zh-Hant` | `zh-Hans` | `en` |
| --- | --- | --- | --- |
| `deleteMediaCollection` | `刪除資料夾` | `删除资料夹` | `Delete folder` |
| `retentionState` | `保留` | `保留` | `Retention` |
| `retentionPeriod` | `{days} 天` | `{days} 天` | `{days} days` |
| `permanentRetention` | `永久` | `永久` | `Permanent` |

Remove `standardRetention` from all three locale objects after its final consumer is gone. In the `MediaLibrarySection.test.tsx` locale mock, replace its old retention values with:

```ts
retentionState: '保留',
retentionPeriod: '{days} 天',
permanentRetention: '永久',
```

Keep action copy such as `永久保留` and `取消永久保留` unchanged.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui
pnpm vitest run src/pages/MediaSyncPage.test.tsx \
  src/pages/media-sync/MediaLibrarySection.test.tsx \
  src/preferences/locale-context.test.tsx
```

Expected: all three files pass with no warnings or unhandled rejections.

- [ ] **Step 7: Run the complete Admin gates**

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui
pnpm test:run
pnpm lint
pnpm build
git diff --check
git status --short
```

Expected: all tests, lint, TypeScript/Vite build, and diff check pass; only the seven task-owned source/test files are modified.

- [ ] **Step 8: Self-review and commit**

Review `git diff --stat` and `git diff`. Confirm no API, DTO, dependency, lockfile, or unrelated layout change. Commit:

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/admin-media-ui
git add src/pages/MediaSyncPage.tsx \
  src/pages/media-sync/MediaLibrarySection.tsx \
  src/preferences/locale-context.tsx \
  src/index.css \
  src/pages/MediaSyncPage.test.tsx \
  src/pages/media-sync/MediaLibrarySection.test.tsx \
  src/preferences/locale-context.test.tsx
git commit -m "fix: refine media folder presentation"
```

---

### Task 2: Clarify the LINE same-group duplicate-binding reply

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy/src/transport/line/public-access-commands.ts`
- Test: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy/src/__tests__/entrance.test.ts`

**Interfaces:**
- Consumes: `findActiveBinding()` and `bindWithCode()` statuses `group_already_bound`, `collection_already_bound`, and `invalid_code`.
- Produces: one module-local `GROUP_ALREADY_BOUND_REPLY` used by the fast precheck and atomic result mapping; store statuses and database behavior remain unchanged.

- [ ] **Step 1: Create an isolated LINE worktree**

```bash
mkdir -p /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup
git -C /Users/rayselfs/Projects/hhc/hhc-line-function-bot fetch origin
git -C /Users/rayselfs/Projects/hhc/hhc-line-function-bot worktree add \
  /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy \
  -b codex/media-sync-binding-copy origin/main
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy
```

Verify the new worktree is clean and contains the released binding-deletion and Asset-response hotfix commits.

- [ ] **Step 2: Update exact reply tests first**

In the active-binding test, change only the reply argument:

```ts
expect(replyText).toHaveBeenLastCalledWith(
  "reply-media-existing",
  "已經綁定過，無法二次綁定。",
  undefined
);
```

In the parameterized conflict table, replace only the `group_already_bound` tuple with this exact line; leave the existing test body and the `invalid_code`/`collection_already_bound` tuples unchanged:

```ts
["group_already_bound", "已經綁定過，無法二次綁定。"],
```

- [ ] **Step 3: Run the focused tests and verify RED**

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy
pnpm vitest run src/__tests__/entrance.test.ts \
  -t "active group is already bound|binding conflicts safe"
```

Expected: only the two same-group reply assertions fail with the old `這個群組已經綁定媒體資料夾。` value.

- [ ] **Step 4: Centralize and apply the exact reply**

Near the public command handler constants in `public-access-commands.ts`, add:

```ts
const GROUP_ALREADY_BOUND_REPLY = "已經綁定過，無法二次綁定。";
```

Use it in both paths:

```ts
if (await input.mediaSyncStore.findActiveBinding({ profileName: input.profile.name, groupId })) {
  return { ok: true, replyText: GROUP_ALREADY_BOUND_REPLY };
}

if (result.status === "group_already_bound") {
  return { ok: true, replyText: GROUP_ALREADY_BOUND_REPLY };
}
```

Do not change `bindWithCode`, migrations, uniqueness constraints, collection-conflict copy, or invalid-code copy.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy
pnpm vitest run src/__tests__/entrance.test.ts \
  -t "active group is already bound|binding conflicts safe"
```

Expected: all selected tests pass.

- [ ] **Step 6: Run the complete LINE gates**

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy
pnpm format:check
pnpm typecheck
pnpm lint
pnpm architecture:check
pnpm config:validate
pnpm test
pnpm build
git diff --check
git status --short
```

Expected: all standard gates pass. Only the transport file and its entrance test are modified; database-backed binding semantics are unchanged.

- [ ] **Step 7: Self-review and commit**

```bash
cd /Users/rayselfs/Projects/hhc/.worktrees/plan-b-followup/line-binding-copy
git add src/transport/line/public-access-commands.ts src/__tests__/entrance.test.ts
git commit -m "fix: clarify duplicate media binding reply"
```

---

### Task 3: Review, publish, release, and verify sequentially

**Files:**
- Create: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections/progress.md`
- Create: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections/task-1-admin-report.md`
- Create: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections/task-1-admin-review.md`
- Create: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections/task-2-line-report.md`
- Create: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections/task-2-line-review.md`
- Create: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections/task-3-release-report.md`
- Create: `/Users/rayselfs/Projects/hhc/.worktrees/plan-b/hhc-client-v2/.superpowers/sdd/2026-08-20-admin-media-follow-up-corrections/final-review.md`
- Do not modify product code unless a reviewer returns a concrete P1/P2 finding.

**Interfaces:**
- Consumes: the exact Task 1 and Task 2 commit SHAs and their fresh gate evidence.
- Produces: two merged PRs, terminal successful releases, and a read-only production acceptance report.

- [ ] **Step 1: Run independent task reviews**

Dispatch a fresh reviewer for each repository. Each reviewer must compare the diff to this plan, rerun the focused tests, and report P1/P2/Minor findings. Required checks:

- Admin: conditional divider has exactly the three requested states; email remains in search options but not chips; the production page passes collection `retentionDays`; extension fallback is correct; all three locales have exact copy.
- LINE: both same-group paths use the exact constant; collection conflict and consumed-code messages are unchanged; no store/schema change exists.

Resolve all P1/P2 findings through TDD and scoped re-review before publication.

- [ ] **Step 2: Publish draft PRs after explicit authorization**

For each clean reviewed branch:

1. Push without force.
2. Create a draft PR to `main` with the exact commit and test evidence.
3. Verify local SHA = remote branch SHA = PR head SHA.
4. Wait for required CI to reach terminal success; do not rerun or override a failure without diagnosing it.

- [ ] **Step 3: Release LINE first**

After CI success and explicit merge/release authorization:

1. Mark the LINE PR ready and use the repository-required merge strategy.
2. Verify the merged tree equals the reviewed tree.
3. Follow Production Release to terminal success.
4. Verify ACA latest/latest-ready revision, immutable ACR/live digest, 100% traffic, health, readiness, signed empty webhook probes, and rollback status.
5. Do not send a synthetic `/media-sync` command. Record the exact reply as user-dependent live acceptance if no real already-bound group test is available.

- [ ] **Step 4: Release Admin second**

After CI success and explicit merge/release authorization:

1. Mark the Admin PR ready and use the repository-required merge strategy.
2. Verify the merged tree equals the reviewed tree.
3. Follow Production Release to terminal success. Verify the workflow source SHA equals the merge SHA, the live `index.html` points to the released hashed bundle, Blob serves that same bundle with immutable cache metadata, and the bundle/Sentry release contains the merge SHA.
4. With an existing authenticated session, perform read-only checks on the current media folder:
   - action reads `刪除資料夾`;
   - bound state shows a single visual divider before retention, while an unbound fixture remains covered by automated tests;
   - selected user chips show name only and the picker still shows email;
   - the uploaded PowerPoint row shows `PPTX`, not the raw MIME;
   - the final header is `保留` and row values are `{days} 天` or `永久`.
5. Do not change ACLs, retention, bindings, filenames, or media during the smoke test.

- [ ] **Step 5: Final closure audit**

Confirm:

- both PRs are merged and no task CI is active or failed;
- both production revisions are healthy and serving the expected immutable artifact;
- all task worktrees are clean;
- no database/API/shared-package changes were introduced;
- every requested correction has automated evidence, and any user-dependent LINE reply verification is labeled honestly rather than fabricated.

Write the final SDD ledger entry and hand off the report paths.
