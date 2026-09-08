# RBAC contract migration

Account owns sorted effective permission codes (direct and role grants), returned by both `/session.user.permissions` and `/me.permissions`. New clients require a valid array; empty means no grants and missing/malformed means unavailable. No new access endpoint or per-application response field is introduced.

The public website and Admin use account-client 0.7.0's shared capability policy. Generic checks recognize exact codes and `*`; historical CMS/campaign, manage/read, and DSR aliases remain explicit Admin policy. A read-only production role lookup confirmed that the admin role carries `*`; Admin now checks effective grants without a role-name bypass. Session entry never uses the old Boolean as a fallback.

Presenter reads permissions in Electron and browser mode and checks `presenter:cloud:use`. Browser tokens are published only after successful permission refresh. Owner-bound offline state and outbox preservation remain intact. Logout-failure recovery restores the current permission result as well as the current account.

Account token issuance rechecks the current OAuth client's active state and allowed scopes, intersects requested scopes with user grants, and persists the resulting scope during rotation, including an empty result. Retirement of the legacy Presenter cloud renewal exception was explicitly approved. Old sessions missing the cloud scope must sign in again; Presenter 2.5.2 already requests the scope at login.

## Verification

- Account: full Go race suite with disposable PostgreSQL/Redis; session/profile parity, DSR-only legacy entry, client scope removal, inactive/unavailable clients, denied refresh scope persistence; vet/build and OpenAPI/policy checks.
- SDK: 35 account-client tests; all package tests/lint/build, package contracts, packing and packed consumer builds.
- Admin: 471 tests, lint/build. Two local workers avoid unrelated UI timeout contention; CI remains unchanged.
- Website: 324 tests, lint and build passed after the async-state lint correction.
- Presenter: 3,216 unit tests, lint, typecheck, desktop/web builds; browser offline conflict and lost-response replay E2E. Full browser coverage: 48 tests passed and one existing platform skip; the remaining legacy session fixture was updated with explicit empty permissions and its full browser-projection suite then passed.
- Native Electron IPC smoke: synthetic account verifies permission mapping, revocation, and malformed profile rejection. No production credentials or remote writes were used.
- Gateway verifier suite and Asset personal-space/ACL unit checks passed on clean exports of current main; no source changes needed.
- account-fe was upgraded from SDK 0.6.7 to 0.7.0 before server retirement; its mock session now returns the profile permissions.

## Contract retirement and user acceptance

The user approved immediate removal of `admin_access`, `presenter_cloud_access` and the Presenter implicit scope exception. SDK 0.7.0 and all website consumers were deployed before Account removal. Windows real-account acceptance belongs to the user and does not block closure. No production role assignments were changed.

Account production has no ACCESS_TOKEN_EXPIRY override, so its configured default lifetime is 15 minutes. Gateway production explicitly allows 60 seconds of clock skew. Existing locally verified JWTs may therefore remain accepted for up to 16 minutes after issuance; permission/session refresh alone does not invalidate them. Gateway verifies JWTs locally; a permission snapshot refresh is not proof of immediate rejection of every already-issued JWT. Report the deployed expiry configuration and existing invalidation behavior separately before claiming a production revocation SLA.

The additive rollout preceded retirement. Retirement shipped SDK and website consumers first, then Account removal. A rollback to consumers requiring old fields must first restore a compatible Account producer. Keep the existing scheduled automation paused.

## Retirement release evidence

SDK #44 / v0.7.0, account-fe #52, Admin #86, website #80 and Account #69 passed CI,
merged and released. Account run 34182748567 completed successfully with ready revision
`account-api--0000072`; website ready revision is `hhc-web--0000082`. Live session and
profile returned 200 with permissions and no legacy access fields. All three website
entry flows remained usable after removal. The profile check uses the Account/Admin
host policy; the public website host intentionally does not expose `/me`.

Retirement checks: full Go race suite with PostgreSQL/Redis, SDK package/consumer
checks, account-fe 275 tests, Admin 471 tests, website 324 tests plus static-budget
checks, affected builds and CI passed. Presenter v2.5.2 already requests cloud scope
at login, so this retirement requires no new installer. All agent-owned delivery is
complete; Windows real-account acceptance is the user's follow-up.
