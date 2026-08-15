# Media Sync Slice 5: Pilot and Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release authentication and LINE media sync safely to a bounded pilot, verify the complete real workflow, then prepare a signed/notarized LibrePresenter release and a reversible general rollout.

**Architecture:** Merge/deploy in dependency order while the feature is inert, then grant `media_sync_user` and collection ACL only to pilot accounts and bind one registered pilot group. Every externally visible merge, deployment, role assignment, ACL change, binding, tag, and release is an explicit operator checkpoint. Existing repository CI/CD remains the delivery mechanism.

**Tech Stack:** GitHub Actions, Azure Container Apps/Dapr, Azure Static Web Apps, PostgreSQL migrations, Account/Admin Console, LINE webhook, signed Electron packages, macOS notarization, operational logs/metrics.

## Global Constraints

- Repositories:
  - `/Users/rayselfs/Projects/hhc/website/account-api`
  - `/Users/rayselfs/Projects/hhc/website/account-fe`
  - `/Users/rayselfs/Projects/hhc/website/asset-api`
  - `/Users/rayselfs/Projects/hhc/website/api-gateway`
  - `/Users/rayselfs/Projects/hhc/hhc-line-function-bot`
  - `/Users/rayselfs/Projects/hhc/website/admin-fe`
  - `/Users/rayselfs/Projects/hhc/hhc-client-v2`
- Do not merge, deploy, assign roles/ACLs, create a real binding, tag, or publish without explicit user approval at the named checkpoint.
- Do not deploy unmerged local commits.
- Production `main` pushes currently trigger backend production release workflows; merging is a production action.
- Schema deployment creates no active binding and assigns no production user role.
- Managers need not be readers; pilot reader ACLs are explicit.
- Use one registered helper pilot group and synthetic/non-sensitive media first.
- Never print credentials, tokens, binding codes, ticket URLs, LINE IDs, or user UUIDs in the handoff.
- Rollback removes reachability/authorization first; do not drop additive production tables.

---

## Deliverable Map

| Deliverable | File/Record |
| --- | --- |
| Dependency manifest | `docs/release/media-sync-pilot-manifest.md` in hhc-client-v2 |
| Production runbook | `docs/release/media-sync-runbook.md` in hhc-client-v2 |
| Signed desktop contract | `electron-builder.yml` and `.github/workflows/build-release.yml` |
| Package verification | `scripts/check-signed-package.mjs` |
| Pilot evidence | CI URLs, deployed revision names, smoke timestamps, opaque request/work IDs |
| Rollback anchors | Previous successful workflow run and Azure revision per service |

### Task 1: Freeze the cross-repository release candidate

**Repository:** each affected repository

- [ ] **Step 1: Rebase each feature branch onto current production branch**

Fetch and compare; do not force-push shared branches. Resolve only feature conflicts and rerun that repository's full CI command locally.

- [ ] **Step 2: Build the dependency manifest**

Create `docs/release/media-sync-pilot-manifest.md` with:

- repository and commit SHA;
- PR URL;
- CI run URL/result;
- migration numbers;
- required environment variable names only;
- API route contract version;
- deployment order;
- previous production SHA/revision rollback anchor.

- [ ] **Step 3: Run cross-contract checks**

Assert exact agreement on:

- OAuth client IDs, redirects, and `openid profile` scopes;
- `X-HHC-User-ID` and `X-HHC-Roles` headers;
- role/permission names;
- collection route paths and response fields;
- `line.group.media-sync` namespace and 200 MiB policy;
- helper/account/asset/gateway Dapr app IDs;
- browser origins and CSP/CORS;
- `librepresenter://auth/account` callback.

- [ ] **Step 4: Open/update review PRs**

Each PR states its dependency and inertness boundary. Required order:

1. Account API and Account frontend;
2. Asset API;
3. API Gateway reader/management routes;
4. helper;
5. Admin Console;
6. LibrePresenter web/desktop.

Do not merge yet.

- [ ] **Step 5: Approval checkpoint — production-triggering merges**

Present the manifest, green CI, migration previews, exact route/environment diffs, and rollback anchors. Wait for explicit approval before merging any repository whose `main` push deploys production.

### Task 2: Deploy server capability in an inert state

**Repositories:** server/frontend repositories

- [ ] **Step 1: Merge/deploy in approved dependency order**

Use each repository's existing `release.yml` workflow. Follow one service at a time; wait for deploy completion and health before proceeding.

- [ ] **Step 2: Verify each live boundary read-only**

After every service:

- record deployed image SHA and active Azure revision;
- check health/readiness;
- confirm migrations completed;
- verify previous revision remains available for traffic rollback;
- verify internal routes reject external callers;
- verify logs contain request IDs and no secret/ticket/code values.

- [ ] **Step 3: Verify inertness**

Before any role/ACL/binding assignment:

- no production user has newly received `media_sync_user` from the migration;
- helper has zero active media-sync bindings;
- existing LINE attachment/save-resource corpus is unchanged;
- signed-out and non-role LibrePresenter users see no HHC LINE import action;
- Asset API collection routes return 401/403 as designed.

- [ ] **Step 4: Stop on first failed boundary**

Do not advance to the next service. Route traffic back to the recorded prior revision or revert the exact Gateway route first, then collect logs by opaque request ID.

### Task 3: Configure and prove desktop signing/notarization

**Repository:** `hhc-client-v2`

**Files:**
- Modify: `electron-builder.yml`
- Modify: `build/entitlements.mac.plist`
- Modify: `.github/workflows/build-release.yml`
- Create: `scripts/check-signed-package.mjs`
- Modify: `package.json`
- Create: `scripts/__tests__/check-signed-package.test.mjs`

- [ ] **Step 1: Add failing packaging-contract tests**

Assert release configuration no longer sets `identity: null`, `hardenedRuntime: false`, `notarize: false`, or `CSC_IDENTITY_AUTO_DISCOVERY: false`. Assert the workflow requires certificate/notarization secrets by name without echoing their values.

- [ ] **Step 2: Configure native signing**

Use electron-builder's existing signing integration:

- macOS Developer ID Application certificate from `MAC_CSC_LINK` /
  `MAC_CSC_KEY_PASSWORD`, mapped to electron-builder's `CSC_LINK` / `CSC_KEY_PASSWORD` only on the
  macOS job;
- Apple notarization API credentials through `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`;
- Windows code-signing certificate from `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`, mapped to
  `CSC_LINK` / `CSC_KEY_PASSWORD` only on the Windows job.

Set hardened runtime and notarization for macOS. Retain only entitlements proven necessary by Electron plus bundled VLC/FFmpeg packaged smoke; remove broad entitlements only after the signed package passes.

- [ ] **Step 3: Verify artifacts after packaging**

The workflow runs:

~~~bash
npm run check:packaged-runtime
npm run test:e2e:packaged
npm run check:signed-package
~~~

The check verifies:

- `codesign --verify --deep --strict`;
- `spctl --assess`;
- notarization ticket via `xcrun stapler validate`;
- Windows Authenticode status `Valid`;
- custom protocol registration;
- packaged VLC projection smoke.

- [ ] **Step 4: Keep an explicit unsigned manual dry run**

Keep `workflow_dispatch` able to package/smoke without production signing credentials by passing
explicit electron-builder unsigned overrides on that non-tag path. A `v*` tag path must fail closed
when signing/notarization credentials or validation are absent; it never silently falls back to
unsigned artifacts.

- [ ] **Step 5: Validate and commit**

~~~bash
npm run lint
npm run typecheck
npx vitest run
npm run build
node --test scripts/__tests__/check-signed-package.test.mjs
git add electron-builder.yml build/entitlements.mac.plist .github/workflows/build-release.yml scripts package.json
git commit -m "build: sign and notarize desktop releases"
~~~

- [ ] **Step 6: Approval checkpoint — signing secret configuration**

Show required secret names and workflow permissions. Wait for explicit approval before adding/updating repository environment secrets or triggering a signed workflow.

### Task 4: Create the pilot authorization and binding

**Systems:** Account Admin, Admin Console, helper group

- [ ] **Step 1: Select bounded pilot identities**

Prepare opaque references for:

- one manager with `media-sync:manage`;
- user A with `media_sync_user` and read ACL;
- user B with `media_sync_user` but initially no ACL;
- one already-registered helper group;
- optionally a second registered group/collection for multi-binding validation.

- [ ] **Step 2: Dry-run the exact mutations**

Present:

- role assignment target/count;
- collection name/namespace;
- user/role ACL subjects;
- binding-code TTL;
- target helper profile/group confirmation;
- unbind/revoke rollback operations.

Do not show plaintext IDs/codes in general logs or the release manifest.

- [ ] **Step 3: Approval checkpoint — pilot role, ACL, and real group binding**

Wait for explicit approval. Then:

1. assign `media_sync_user` only to A and B;
2. create the collection;
3. grant A read ACL only;
4. issue one binding code;
5. paste `/media-sync <code>` into the already-registered pilot group;
6. confirm Admin Console shows the bound group;
7. confirm the code is consumed and cannot be reused.

- [ ] **Step 4: Confirm negative authorization before media**

Manager-only user can manage but cannot read. A can list the collection. B cannot list, fetch metadata, issue a ticket, or fetch content.

### Task 5: Run the real pilot acceptance matrix

**Clients:** browser preview/production client and signed desktop release candidate

- [ ] **Step 1: Send synthetic media after binding**

Send one supported image, native video, VLC video format, PDF, and PPTX. Also send one unsupported format and one over-policy test artifact generated without sensitive content.

- [ ] **Step 2: Verify server intake**

For each supported item, correlate by opaque work/request IDs and prove:

- webhook acknowledged promptly;
- one canonical ingest and Asset API asset;
- upload complete;
- existing ClamAV scan clean;
- collection membership only after clean;
- no group success message;
- unsupported/oversize never receives membership.

- [ ] **Step 3: Verify client behavior**

For A:

- same existing picker lists the collection;
- repeated open imports multiple collections one at a time;
- browser online-only uses tickets/Range without a persisted source Blob;
- Electron on-demand creates native files when VLC requires them;
- image/video/PDF/PPTX projection and popup work;
- blackout/unblank restores authoritative video position.

- [ ] **Step 4: Verify ACL transitions**

Grant B ACL and confirm it appears after refresh. Revoke B ACL and confirm 403 cancels/purges B's online root. A remains unaffected. Document the explicit limitation that `always-offline` files cannot be remotely erased while the device is offline.

- [ ] **Step 5: Verify shared publication and unsend**

Run a bound-group manual `save_resource` request for one item. Prove one source asset, existing curated publication behavior, then unsend and confirm collection tombstone, publication cleanup, owner asset deletion, and client delta cleanup.

- [ ] **Step 6: Observe stability**

Hold the pilot for an agreed observation window and review:

- webhook latency/error categories;
- worker depth/retries/terminal failures;
- scan queue age/signature freshness;
- collection/ticket 401/403/5xx;
- Range bandwidth and storage growth;
- client sync/ticket/VLC failures;
- absence of token/code/ticket leakage.

No unchanged telemetry is treated as proof; run a known synthetic event and trace it end-to-end.

### Task 6: Publish the signed desktop and decide general rollout

**Repository:** `hhc-client-v2`

- [ ] **Step 1: Prepare a versioned release candidate**

Update version/changelog through the repository's normal release process. Confirm tag version equals `package.json` and static web production configuration points to approved Account/Asset endpoints.

- [ ] **Step 2: Approval checkpoint — tag and GitHub Release**

Present pilot results, open risks, signing/notarization evidence, artifact hashes, rollback anchors, and intended tag. Wait for explicit approval before pushing `vX.Y.Z`.

- [ ] **Step 3: Follow `build-release.yml` to completion**

Require quality gates, signed macOS/Windows package jobs, packaged projection smoke, signature verification, notarization validation, and GitHub Release publication. Download and independently verify published hashes/signatures.

- [ ] **Step 4: General rollout remains role-driven**

Do not bulk-assign `media_sync_user`. Add users/ACLs/groups through reviewed Admin flows. One group/collection at a time keeps rollback bounded.

## Production Acceptance Gate

- [ ] Every deployed SHA matches the approved manifest and green CI run.
- [ ] No unmerged/local commit is deployed.
- [ ] Manager/read/global-role decisions match the full authorization matrix.
- [ ] Existing LINE `main` and helper `save_resource` behavior remain green.
- [ ] Browser and signed desktop pass the real media matrix.
- [ ] macOS artifact is signed, hardened, notarized, stapled, and Gatekeeper accepted.
- [ ] Windows artifact has valid Authenticode.
- [ ] Pilot telemetry stays within the agreed thresholds and contains no secrets.
- [ ] Rollback has been rehearsed without deleting production tables/data.

## Rollback Order

1. Unbind the pilot group to stop future intake.
2. Revoke pilot collection ACLs and `media_sync_user` assignments.
3. Hide/disable HHC LINE import in client delivery.
4. Remove/revert exact Gateway media routes.
5. Route helper, Asset API, Account API, and Gateway back to recorded previous Azure revisions as needed.
6. Leave additive database tables in place; reconcile in-flight work and retained assets explicitly.
7. Deprecate the desktop release in GitHub without deleting already-downloaded artifacts; publish a signed corrective release if client rollback is required.
