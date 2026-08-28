# Media import, status, and native auth correction design

## Scope

Correct the v2.3.9 regressions without changing the projection model or merging unrelated state
stores:

- package the PDF.js worker as executable JavaScript;
- remove the sidebar-wide recovery count;
- render one status view for sync roots and ordinary media processing while keeping their data
  sources separate;
- preserve provider/status metadata in Favorites and both file layouts;
- render the authenticated avatar URL;
- give native authentication an HTTP completion page and preserve/restart native continuation
  through first-time registration;
- verify current VLC failure synchronization with valid and damaged MKV fixtures and improve only
  the user-facing damaged-media classification if the current typed failure is too generic.

## Architecture

### Shared status view, separate state

`sync-db`, `sync-folder-health`, durable media jobs, and transient uploads retain their existing
ownership. They adapt into a small renderer-only view model:

```ts
type FileItemStatusView = {
  tone: 'progress' | 'warning' | 'error'
  label: string
  progress?: number
  tooltip?: string
}
```

Grid and list layouts render the same component. A root sync folder derives the view from
`SyncFolderHealth`; an ordinary file derives it from its media job/upload state. No global count is
shown beside the user menu. Recovery actions remain available where the affected item is visible.

Favorites must use the same item projection as Files so provider type and status are not discarded.
This fixes Local, OneDrive, and LINE folders together.

### PDF worker

Import the existing polyfill worker through Vite's worker URL pipeline instead of constructing a
URL from a TypeScript source path. Extend the packaged-runtime check so an app build fails if the
worker is emitted as raw TypeScript or with a non-JavaScript MIME type.

### Native authentication

Account API wraps validated `librepresenter://auth/account` redirects in a same-origin Account FE
completion URL. The authorization code stays PKCE-bound; Account FE reads the fragment, removes it
from browser history, attempts the custom-protocol redirect, and leaves a clear success/retry page.

First-time social onboarding retains the existing `auth_request_id`. Email registration retains a
native-continuation marker through verification. If the original OAuth request is expired, Account
FE invokes a restart intent and LibrePresenter creates a fresh PKCE transaction instead of accepting
an expired code.

All new redirect inputs are allowlisted and parsed with `URL`; no arbitrary custom scheme or open
redirect is accepted. Account API OpenAPI and contract tests change in the same PR as any API
contract field.

### MKV

Do not decode an entire file during import. The known failing fixture is truncated, while the other
fixture decodes normally. Current v2.3.9 lifecycle synchronization is the baseline. Tests must prove
that a premature VLC end yields one typed failure and a consistent stopped/error state. Only add a
specific damaged-media failure code/message if that assertion shows the generic failure is the
remaining UX gap.

## Delivery boundaries

- LibrePresenter merge does not trigger a release; do not create a version commit, tag, GitHub
  release, or invoke `build-release.yml`.
- `account-api` and `account-fe` each deploy production on merge to `main`. Their PRs may be made CI
  green, but merging them is a production release and therefore remains a separate gate under the
  user's no-release instruction.

