# RBAC Contract Unification Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Execute inline; this plan does not request subagent delegation.

**Goal:** Replace application-specific account access flags with a reusable permission contract without breaking existing clients, resource isolation, or offline edits.

**Architecture:** Account owns effective permission data. Applications own module-entry policies, while API enforcement retains token scopes and resource authorization. Expand the contract first, migrate consumers second, and remove compatibility fields only after supported consumers no longer require them.

**Tech Stack:** Go, existing Account RBAC/OAuth services, TypeScript, frontend-platform account-client, React, Electron, Vitest, existing Gateway and Asset authorization.

**Spec:** The decisions and acceptance matrix below capture the approved discussion through 2026-09-08. Implementation was authorized after plan review on 2026-09-08.

## Decisions and constraints

- Keep RBAC and existing ACLs. Do not introduce ABAC, an authorization service, an expression engine, or a new access-check endpoint.
- Return `permissions: string[]` in both `/me` and `/session.user`, calculated by the same Account implementation. An empty array means confirmed no permissions; missing/malformed data must not grant access.
- Permissions combine direct assignments and role assignments, deduplicated and sorted. Preserve inactive-user rejection and existing authentication checks.
- Exact permission matching and the existing `*` grant are the generic semantics. No prefix wildcard and no implicit universal write-to-read hierarchy.
- Account permissions describe user grants, not the scopes delegated to a particular OAuth client. Never automatically issue every effective permission as a token scope.
- Admin entry means at least one accessible administrative module, not a separately assigned `admin:access` permission.
- Keep Admin entry, page guards, and navigation on one module policy. Runtime feature availability remains a separate condition; disabled DSR must not be treated as an authorization failure.
- Keep historical permission aliases explicit and application-specific until their corresponding API behavior is verified. Do not silently expand grants or remove legacy access.
- LINE readers remain governed by existing folder ACLs. Cloud operations retain `presenter:cloud:use` scope and owner checks.
- Preserve unsent cloud edits on revocation, network errors, upgrades, and account changes. Never sync one account's queue using another account's credentials.
- New implementation branches start from latest `origin/main` in isolated worktrees. Preserve dirty primary checkouts and unrelated worktrees.
- No production role assignments, destructive data migration, or automatic upgrade enforcement is part of this plan.
- Legacy fields may remain deprecated while supported old desktop clients depend on them. A calendar deadline alone is insufficient evidence to remove them.

## Repository and file map

Paths below are relative to `/Users/rayselfs/Projects/hhc/website`, except Presenter paths, which are relative to `/Users/rayselfs/Projects/hhc/hhc-client-v2`.

| Repository              | Existing implementation points                                                                                                                                                               | Responsibility                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| account-api             | `internal/handlers/auth_handler.go`, `internal/services/user_service.go`, `internal/services/rbac_service.go`, `internal/services/token_service.go`                                          | Session/profile contract, effective permissions, authoritative checks, scope issuance |
| frontend-platform       | `packages/account-client/src/index.ts`, `packages/account-client/src/index.test.ts`                                                                                                          | Shared response validation and permission helpers                                     |
| frontend-platform       | Create `packages/account-client/src/admin-access.ts` and `admin-access.test.ts`                                                                                                              | Shared Admin module permission policy, without routes, labels, or UI dependencies     |
| admin-fe                | `src/lib/access-control.ts`, `src/auth/auth-context.tsx`, `src/App.tsx`                                                                                                                      | Consume shared policy for entry, pages, and sidebar                                   |
| hhc-web                 | `src/components/layout/AccountControl.tsx`                                                                                                                                                   | Use the same Admin-entry predicate for menu visibility                                |
| Presenter               | `src/shared/hhc-auth.ts`, `src/main/ipc/hhc-auth.ts`, `src/renderer/src/lib/hhc-auth-browser.ts`, `src/renderer/src/contexts/HhcAuthContext.tsx`, `src/renderer/src/stores/personal-sync.ts` | Permission snapshot, dual-mode auth, cloud eligibility and offline lifecycle          |
| api-gateway / asset-api | Existing personal-space route guards and ownership/ACL tests                                                                                                                                 | Verify enforcement parity; modify only demonstrated inconsistencies                   |

Account primary checkout may be older than released code. Rebaseline against latest remote before execution; the analyzed Account revision was `d35b3d53`, and Presenter was 2.5.1.

## Batch 1: Authorization baseline and Account additive contract

- [ ] Read each affected repository's instructions and CI workflow. Record baseline commits and inventory all `admin_access`, `presenter_cloud_access`, effective-permission, role-admin, alias, and scope consumers, including account-fe and shared package validators.
- [ ] Add failing Account tests proving that session and profile return the same sorted permissions for direct grants, role grants, duplicates, empty grants, and `*`.
- [ ] Reuse one effective-permission implementation across handler/service callers rather than retaining duplicate collectors. Preserve live RBAC checks and inactive-account behavior; do not replace fresh checks with a cached UI snapshot.
- [ ] Add `permissions` to session responses; retain old fields unchanged except for the demonstrated DSR entry discrepancy, which receives an explicit regression test and compatibility correction.
- [ ] Verify existing Admin role assignments use `*` before removing any role-name bypass. Record anomalies and retain compatibility until corrected through an explicitly reviewed data migration; do not silently grant `*`.
- [ ] Update the canonical API specification and contract tests in the locations identified by the repository's existing documentation workflow.
- [ ] Run focused Go tests, then repository CI-equivalent tests and build. Commit as `feat: expose effective permissions in account sessions`.

**Output:** Additive Account contract; old clients continue to parse responses. No new endpoint and no consumer migration required for deployment.

## Batch 2: Shared consumer contract and Admin policy

The target shared contract is:

```ts
export function hasPermission(permissions: readonly string[], required: string): boolean {
  return required.length > 0 && (permissions.includes('*') || permissions.includes(required))
}
```

Use `some` or `every` at actual composition sites; reject empty requirement lists at authorization boundaries. Do not add unused helper variants.

- [ ] Add failing account-client tests for valid permission arrays, malformed elements, empty arrays, and supported legacy responses. Represent a legacy response as missing permissions, never as an authoritative empty array.
- [ ] Add optional permissions during the compatibility release and stop requiring `admin_access` when a valid generic contract is present. Reject malformed supplied permissions rather than falling back to a more permissive old flag.
- [ ] Move Admin module permission requirements and explicit legacy aliases from admin-fe into `admin-access.ts`. Export `hasAdminCapability` and `canAccessAdmin`; derive entry from the module requirements instead of a second permission list.
- [ ] Keep generic `hasPermission` free of Admin role-name shortcuts and CMS/campaign aliases. The SDK may parse legacy responses for old consumers, but migrated consumers require valid permissions and report missing data as unavailable; they never fall back to an access Boolean.
- [ ] Add table tests showing DSR-only users pass entry, cloud-only users do not, and each accessible module produces consistent entry/page results. Verify aliases against existing server requirements before changing their meaning.
- [ ] Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:packages`, and the repository's package/packed-consumer checks. Publish the package before updating consumers.

**Output:** A versioned compatible SDK contract and one Admin policy shared by the public website and Admin frontend.

## Batch 3: Website and Admin migration

- [ ] Update account-client dependency versions and lockfiles in admin-fe and hhc-web; migrate any additional production consumers discovered in Batch 1.
- [ ] Replace the Admin session Boolean rejection with shared permission-policy evaluation. Reuse the same policy for profile-based guards and route capabilities; retain distinct authentication, authorization, and availability states.
- [ ] Replace the website menu's Boolean check with `canAccessAdmin`. Keep menu visibility and direct navigation behavior consistent for identical snapshots.
- [ ] Test DSR-only, cloud-only, no-permission, wildcard, legacy-compatible, and malformed-session cases. Test direct URLs, not only sidebar visibility.
- [ ] Preserve DSR runtime enablement checks independently of permissions. Do not expose disabled operational functions because entry is authorized.
- [ ] Run `pnpm lint`, `pnpm test:run`, and `pnpm build` in both repositories; browser-smoke menu, sign-in, direct navigation, and authorization failure.

**Output:** Both website consumers use the same generic contract and Admin policy. Account no longer needs a new access flag when an Admin module is introduced.

## Batch 4: Presenter permissions and scope lifecycle

- [ ] Add permission arrays to shared session data and map `/me.permissions` in Electron and `/session.user.permissions` in browser mode. Keep permission evaluation pure and shared across these adapters; do not add a package dependency solely for the trivial predicate.
- [ ] Replace `presenterCloudAccess` as the new client's authority with the explicit permission check. New clients require valid permissions; keep old response fields on the server for old clients instead of falling back in new clients.
- [ ] Test login, token refresh, revocation, network failure, malformed data, logout, and account switching. Fence late async results so another account cannot inherit a stale authorization snapshot.
- [ ] Preserve the last confirmed owner-bound offline permission snapshot for offline edits. On reconnection, confirm authorization before upload; denied authorization pauses sync and keeps queued changes intact.
- [ ] On an authorization response, refresh state at most once for the operation. Do not globally revoke cloud permission because one resource returns 403/404; distinguish expired authentication, missing scope, and owner/ACL denial using the actual API error contract.
- [ ] Trace initial OAuth issuance, session-token issuance, and refresh end-to-end. Enforce permission scopes against requested/authorized scopes, current client allowed scopes, and effective user grants; identity scopes retain their existing semantics.
- [ ] Remove normal token issuance dependence on hard-coded Presenter client IDs only after verifying a usable reauthorization path and supported-client compatibility. Until then retain the narrowly scoped legacy branch and mark removal pending. New clients request the required scope through existing OAuth. Legacy sessions missing it use the existing authorization flow when access is needed; do not widen every refresh token's delegated scope automatically.
- [ ] Test that denied scopes cannot be minted, removed client scopes cannot reappear, fully revoked scopes leave no stale persisted scope, and scope reauthorization preserves unsent edits. Verify whether the current client can reauthorize with its existing login session; do not promise a prompt-free migration without evidence.
- [ ] Run Presenter lint, typecheck, tests, desktop build, web build, browser E2E, and Electron auth/cloud smoke. Run Account token tests and required CI checks for scope changes.

**Output:** New Presenter clients use permissions consistently in both modes; scope handling no longer grows an application-specific branch per client.

## Batch 5: Enforcement parity and staged retirement

- [ ] Exercise the matrix below against relevant handlers and Gateway paths. Preserve cloud scope and ownership checks and LINE folder ACL behavior; fix only demonstrated discrepancies.
- [ ] Measure the actual revocation bound from configured token lifetime, refresh behavior, and existing auth-version enforcement. Document the verified bound; do not claim immediate revocation from UI refresh alone. If policy requires a shorter bound, scope that change explicitly rather than introducing token introspection incidentally.
- [ ] Deploy additive Account changes, shared packages, website consumers, and Presenter in dependency order. Scope-special-case removal must follow a usable new-client reauthorization path and a compatibility decision for supported old clients.
- [ ] Keep rollback additive: roll consumers back while permissions and deprecated fields coexist. Do not remove permission definitions or user assignments as rollback cleanup.
- [ ] Before deleting flags, prove all supported clients and SDK validators tolerate their absence. If old desktop support remains, retain the deprecated fields and record retirement as pending; do not call it removed.
- [ ] Remove `HasAdminAccess`, `HasPresenterCloudAccess`, and old response fields only at the contract-removal gate. Release the breaking shared contract with appropriate versioning and update API documentation.
- [ ] Record PR, CI, package publication, deployment revision, web smoke, and installed desktop evidence separately. Keep scheduled automation paused.

## Acceptance matrix

| Case                               | Expected result                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Direct or role grant               | Same effective permission and access result                                             |
| Duplicate grants                   | Stable deduplicated response                                                            |
| No permissions                     | Authenticated; protected entry denied                                                   |
| Only cloud permission              | Cloud allowed, Admin denied                                                             |
| Only DSR read/manage               | Admin authorization allowed; DSR availability remains separately enforced               |
| Wildcard                           | Permission check allowed; client scope and resource restrictions still apply            |
| Permission without delegated scope | UI grant does not bypass API scope enforcement                                          |
| Valid scope, wrong owner           | Cloud operation denied                                                                  |
| LINE no folder ACL                 | Empty authorized list; sync entry disabled                                              |
| Malformed permissions              | No access granted; reported as invalid/unavailable, not anonymous success               |
| Network outage                     | No false confirmed revocation; no unverified remote writes                              |
| Revoked permission                 | New authorization checks deny; old-token bound documented; local pending edits retained |
| Account switch during refresh      | Stale result ignored; queues and permission cache remain owner-bound                    |
| Old supported client               | Compatible response retained until retirement gate                                      |

## Completion and scope boundary

Implementation completion requires contract and policy tests, affected repository CI/build checks, browser and Electron behavior evidence, and a compatibility report. Removing legacy fields is a separate gated completion item when old supported clients remain. This plan does not authorize production permission grants, resume automation, or expand into a platform-wide role redesign.

## Review corrections (2026-09-08)

- New clients fail closed on missing or malformed permissions; only the SDK parser accepts legacy payloads for compatibility.
- Session expansion must be deployed before consumers require permissions.
- Do not remove legacy scope renewal until old-client compatibility is verified; prefer an explicit pending retirement over breaking existing offline queues.
- Do not remove role-name compatibility on the strength of a migration file alone; verify assigned permission data first.
