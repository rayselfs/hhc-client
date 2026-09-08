# RBAC contract migration

Account owns sorted effective permission codes (direct and role grants), returned by both `/session.user.permissions` and `/me.permissions`. New clients require a valid array; empty means no grants and missing/malformed means unavailable. No new access endpoint or per-application response field is introduced.

The public website and Admin use account-client 0.6.24's shared capability policy. Generic checks recognize exact codes and `*`; historical CMS/campaign, manage/read, and DSR aliases remain explicit Admin policy. The existing profile-only Admin role compatibility is retained pending supported-data verification. Session entry never uses the old Boolean as a fallback.

Presenter reads permissions in Electron and browser mode and checks `presenter:cloud:use`. Browser tokens are published only after successful permission refresh. Owner-bound offline state and outbox preservation remain intact. Logout-failure recovery restores the current permission result as well as the current account.

Account token issuance rechecks the current OAuth client's active state and allowed scopes, intersects requested scopes with user grants, and persists the resulting scope during rotation, including an empty result. Old Presenter sessions retain their narrowly scoped cloud renewal exception until supported-client reauthorization is verified. This is a compatibility hold, not the pattern for new clients.

## Verification

- Account: full Go race suite with disposable PostgreSQL/Redis; session/profile parity, DSR-only legacy entry, client scope removal, inactive/unavailable clients, denied refresh scope persistence; vet/build and OpenAPI/policy checks.
- SDK: 35 account-client tests; all package tests/lint/build, package contracts, packing and packed consumer builds.
- Admin: 466 tests, lint/build. Two local workers avoid unrelated UI timeout contention; CI remains unchanged.
- Website: 324 tests, lint and build passed after the async-state lint correction.
- Presenter: 3,216 unit tests, lint, typecheck, desktop/web builds; browser offline conflict and lost-response replay E2E. Full browser suite tracked separately in delivery evidence.
- Native Electron IPC smoke: synthetic account verifies permission mapping, revocation, and malformed profile rejection. No production credentials or remote writes were used.
- Gateway verifier suite and Asset personal-space/ACL unit checks passed on clean exports of current main; no source changes needed.
- account-fe has no direct dependency on either deprecated access field in its source; no migration is required while its installed SDK remains supported by additive responses.

## Compatibility and remaining gates

Keep `admin_access` and `presenter_cloud_access` in Account responses while supported old SDKs/desktops need them. Do not retire the Presenter legacy scope exception or profile-role compatibility solely because new clients are released. Removal requires an explicit supported-client decision and permission-data verification; no production role assignments were changed here.

Account's configured default access-token lifetime is 15 minutes. Gateway verifies JWTs locally; a permission snapshot refresh is not proof of immediate rejection of every already-issued JWT. Report the deployed expiry configuration and existing invalidation behavior separately before claiming a production revocation SLA.

Deliver in dependency order: Account producer, published SDK, website/Admin and Presenter consumers. Preserve the compatible Account producer when rolling a consumer back. Keep the existing scheduled automation paused.
