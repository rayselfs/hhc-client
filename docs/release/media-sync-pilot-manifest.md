# HHC LINE Media Sync pilot manifest

Status: **release candidate reconciliation only — no approval to merge, deploy, assign roles or ACLs, create a binding, tag, or publish.**

Collected: `2026-08-17T01:40:45Z` (Git remotes, GitHub Actions, Azure control plane, public negative-route probes, and aggregate Log Analytics query).

This record contains only commit, workflow, revision, image-digest, route, and environment-variable _names_. It deliberately excludes account identifiers, LINE identifiers, credentials, binding codes, tickets, tokens, request payloads, and log messages.

## Candidate inventory

| Order | Repository                                   | Approved `origin/main` candidate                                      | PR and CI                                                                                                                                                                                                                                                   | Production release evidence                                                                                                                               | Migration / deployment state                                                                                                                   | Rollback anchor                                                                                                                    |
| ----- | -------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `HallelujahHomeChurch/account-api`           | `e0931cec7819a091443a886834bcf15bb0a89cfe`                            | [PR #45](https://github.com/HallelujahHomeChurch/account-api/pull/45), [CI 31947975314](https://github.com/HallelujahHomeChurch/account-api/actions/runs/31947975314) — success                                                                             | [release 31948255873](https://github.com/HallelujahHomeChurch/account-api/actions/runs/31948255873) — success, completed `2026-08-16T13:02:12Z`           | `000015_hhc_media_sync_auth`; Azure ready `account-api--0000047`, Running; immutable image digest recorded below                               | Previous ready revision was not returned by the current read-only revision query; recapture immediately before any next deployment |
| 1     | `HallelujahHomeChurch/account-fe`            | `997b07683f721bfa028596bc712bfab09a402cb4`                            | [PR #40](https://github.com/HallelujahHomeChurch/account-fe/pull/40), [CI 31922583384](https://github.com/HallelujahHomeChurch/account-fe/actions/runs/31922583384) — success                                                                               | [release 31922665591](https://github.com/HallelujahHomeChurch/account-fe/actions/runs/31922665591) — success, completed `2026-08-16T02:50:02Z`            | Static deployment; no media-sync-specific schema                                                                                               | Previous published static index was not available from read-only inspection; capture before publish                                |
| 2     | `HallelujahHomeChurch/asset-api`             | `50fddb5d8e6b235bfc0e9640232e3f540459b06a`                            | [PR #20](https://github.com/HallelujahHomeChurch/asset-api/pull/20), [CI 31938642150](https://github.com/HallelujahHomeChurch/asset-api/actions/runs/31938642150) — success                                                                                 | [release 31938730851](https://github.com/HallelujahHomeChurch/asset-api/actions/runs/31938730851) — success, completed `2026-08-16T09:29:27Z`             | `012_asset_collections`; Azure ready `asset-api--0000020`, Running, 100% traffic                                                               | Previous ready revision was not returned by the current read-only revision query; recapture immediately before any next deployment |
| 3     | `HallelujahHomeChurch/api-gateway`           | `65dd5450e056115a89a1f6499d88258c87e4c5ad`                            | [reader PR #39](https://github.com/HallelujahHomeChurch/api-gateway/pull/39), [management PR #40](https://github.com/HallelujahHomeChurch/api-gateway/pull/40); both CI success                                                                             | [release 31964210553](https://github.com/HallelujahHomeChurch/api-gateway/actions/runs/31964210553) — success, completed `2026-08-16T18:23:26Z`           | Container Apps read query returned `InternalServerError` / `Precondition Failed`; revision/image/rollback anchor **unavailable**, not inferred | Must obtain ready + previous revision and image digest before a dependent deployment                                               |
| 4     | `HallelujahHomeChurch/hhc-line-function-bot` | `629fcbe80573e521af51eedf0c4aa40768b0de60`                            | [PR #48](https://github.com/HallelujahHomeChurch/hhc-line-function-bot/pull/48), [CI 31963375214](https://github.com/HallelujahHomeChurch/hhc-line-function-bot/actions/runs/31963375214) — success                                                         | [release 31963589570](https://github.com/HallelujahHomeChurch/hhc-line-function-bot/actions/runs/31963589570) — success, completed `2026-08-16T18:17:56Z` | In-code idempotent media-sync migrations; Azure ready `hhc-line-function-bot--0000166`, Running, 100% traffic                                  | Previous ready revision was not returned by the current read-only revision query; recapture immediately before any next deployment |
| 5     | `HallelujahHomeChurch/admin-fe`              | `c8bd9c47e464948f89ecca2465d75f0f3be4168e`                            | [PR #45](https://github.com/HallelujahHomeChurch/admin-fe/pull/45), [CI 31948783260](https://github.com/HallelujahHomeChurch/admin-fe/actions/runs/31948783260) — success                                                                                   | [release 31964477270](https://github.com/HallelujahHomeChurch/admin-fe/actions/runs/31964477270) — success, completed `2026-08-16T18:28:36Z`              | Static deployment; no media-sync-specific schema                                                                                               | Previous published static index was not available from read-only inspection; capture before publish                                |
| 6     | `rayselfs/hhc-client`                        | `ee35c680754e74ed0692f80cd071dccf48037942` on `feat/media-projection` | [PR #6](https://github.com/rayselfs/hhc-client/pull/6) is **open**; [quality 31982549597](https://github.com/rayselfs/hhc-client/actions/runs/31982549597) and [SWA 31982549594](https://github.com/rayselfs/hhc-client/actions/runs/31982549594) — success | Not merged or deployed; `origin/main` remains `fa020d85c4ae51c3b7a46b194be7b73c7cf33850`                                                                  | Slice 4 Tasks 4–7 and Task 3 signing/notarization remain release blockers                                                                      | Current production web/desktop remains the prior main release; no pilot client release anchor is approved                          |

### Read-only Azure evidence

| Service     | Ready revision                   | Image digest                                                                                                           | Observed state                                                                                     |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Account API | `account-api--0000047`           | `alive.azurecr.io/alive/account-api@sha256:dd73818cb384f11b6aa6f46bceab042b621e6a13c8b18e584ee0f918a6458926`           | Running; current revision-list response exposed no previous candidate                              |
| Asset API   | `asset-api--0000020`             | `alive.azurecr.io/alive/asset-api@sha256:7a31a9fb783d909b9bdf7581658e03b1f3ecf73ecd159f1ff1cf3177f002ee7e`             | Running, 100% traffic; current revision-list response exposed no previous candidate                |
| API Gateway | unavailable                      | unavailable                                                                                                            | Azure control-plane `InternalServerError` / `Precondition Failed`; do not advance on this evidence |
| LINE helper | `hhc-line-function-bot--0000166` | `alive.azurecr.io/alive/hhc-line-function-bot@sha256:081d29c6f85a29d4f1e71b1aca8047f1845cea876b976781ceb9d529b82d7443` | Running, 100% traffic; current revision-list response exposed no previous candidate                |

## Cross-contract reconciliation

No standalone API version value is exposed by the participating services. This manifest therefore binds the contract to the immutable candidate SHAs above; no invented version number is used.

- OAuth: `client-web` redirects only to `https://client.alive.org.tw/oauth/callback`; `hhc-desktop` redirects only to `librepresenter://auth/account`; both use `openid profile`.
- Authorization: `media_sync_user` grants only `media-sync:read`; `media-sync:manage` remains independent. Reader collection ACLs are explicit, so a manager is not implicitly a reader.
- Gateway verifier headers: protected calls set only normalized `X-HHC-User-ID` and `X-HHC-Roles`; public proxy defaults clear them. The exact browser media CORS map is bound to the production `www.alive.org.tw` and approved client origins, without credentials for ticket content.
- Reader routes are exact: collection list, changes, item metadata, ticket issue, authenticated content, and ticket content under `/api/assets`; all collection reader routes require `media_sync_user`. The ticket route is separate and strips forwarded client trust headers.
- Management routes are exact and admin-host-only: collection list/create/rename/delete, ACL add/revoke, binding-code issue, binding deletion, and bounded `acl-subjects` search. They require `media-sync:manage`; www/account/client hosts return 404 and browser preflight is not enabled.
- Asset policy uses namespace `line.group.media-sync`; the helper and scan-worker cap is `209715200` bytes (200 MiB). Existing `line.group.file` policy remains independent.
- Dapr app identities are `account-api`, `asset-api`, `api-gateway`, and `hhc-line-function-bot`. Account private media-sync verification accepts only the configured helper caller. Asset exposes `ASSET_READER_CALLER_APP_ID=api-gateway` and permits the helper as a managed caller. ACA injects Dapr application authentication; no Gateway-set `dapr-api-token` is part of this contract.
- Client browser/desktop contract is memory-only ticket handling, browser online-only Range playback, Electron `hhc-media` opaque leases, exact Asset origin, and `librepresenter://auth/account`. Client parity, CSP/referrer/cache proof, and signed-package work are not complete release evidence yet.

## Required environment/configuration names

Only names are recorded here. Presence and values must be checked by the existing release workflows, never printed in the manifest.

| Boundary              | Required names / fixed identifiers                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Azure deployment OIDC | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`                                                                                                                               |
| Account API           | `LINE_BOT_CALLER_APP_ID=hhc-line-function-bot`, Account/Asset public and Dapr endpoint configuration                                                                                        |
| Asset API             | `ASSET_WORKLOAD_CLIENT_ID`, `ASSET_WORKLOAD_AUDIENCE`, `LINE_ATTACHMENT_CLIENT_ID`, `LINE_ATTACHMENT_OBJECT_ID`, `ASSET_READER_CALLER_APP_ID=api-gateway`, queue/scan/storage configuration |
| LINE helper           | `ASSET_API_APP_ID=asset-api`, `MEDIA_SYNC_GATEWAY_CALLER_APP_ID=api-gateway`, `MEDIA_SYNC_MAX_BYTES=209715200`, production database/Redis/LINE/scan configuration                           |
| Client web/desktop    | `VITE_HHC_ACCOUNT_ORIGIN`, `VITE_HHC_ASSET_ORIGIN` plus the existing browser/runtime variables; exact production endpoints only                                                             |
| Future signing gate   | `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`                                                     |

## Inert-state evidence and unresolved checks

Public, unauthenticated probes collected at the manifest timestamp returned the intended negative boundaries:

| Probe                                              | Result |
| -------------------------------------------------- | ------ |
| Public Account private permission route            | `404`  |
| Asset collection reader without bearer             | `401`  |
| Asset ticket content with an invalid opaque ticket | `401`  |
| Admin management collection route without session  | `401`  |
| www management collection route                    | `404`  |

The 24-hour aggregate Log Analytics query found `95083` console events, `21969` request-ID markers, and `0` matches for the deliberately narrow credential/ticket/binding-code value markers. Log bodies and identities were not retrieved or recorded.

The following cannot be safely proved with the available anonymous/public or aggregate-only access and remains an explicit pre-pilot checkpoint:

- zero new production `media_sync_user` assignments;
- zero active media-sync bindings;
- unchanged existing LINE attachment and `save_resource` corpus;
- role/ACL/binding target count and exact rollback actions;
- API Gateway ready/previous revision and image digest after the Azure control-plane error;
- client signed/notarized release and production CSP/referrer/cache/Electron parity proof.

## Approval boundary and next safe action

This manifest is **not** approval for a production mutation. Before Task 2 can be marked complete, obtain current read-only evidence for every unresolved item above and capture the prior revision/index immediately before each approved deployment. Do not select, record, or assign real pilot identities in this file. The later pilot checkpoint must use opaque references for one manager, reader A, reader B, and one already-registered helper group.

Rollback remains authorization-first: unbind, revoke ACL/global role, hide the client entry point, remove/revert the exact Gateway routes, then restore the recorded service revisions. Additive tables and retained assets are not dropped during rollback.
