# RBAC Contract Unification

Execute inline using the existing repository workflows. No delegated agent work.

## Approved contract

Account exposes effective `permissions: string[]` through `/session.user` and `/me`.
Empty arrays mean no grants; missing or malformed arrays are invalid. Generic checks
use exact permission codes or `*`. Admin owns one shared module policy; API scopes,
cloud ownership and LINE folder ACLs remain independent enforcement boundaries.

## Completed implementation

- [x] Account uses one sorted, deduplicated effective-permission calculation.
- [x] SDK shares generic checks and the Admin module policy.
- [x] Website/Admin consume permissions, with entry and page checks kept distinct.
- [x] Presenter maps permissions in Electron and browser modes, fences stale account
      results, and preserves owner-bound offline edits.
- [x] Token issuance checks current client activity, allowed scopes and user grants,
      including persistence of an empty filtered scope during refresh rotation.
- [x] Gateway and Asset enforcement parity verified without source changes.
- [x] First rollout released: Account #68, SDK #43 / 0.6.24, Admin #85,
      website #79, Presenter #53 / 2.5.2; tests, web and packaged smoke passed.

## Retirement approved on 2026-09-08

The user explicitly requested immediate retirement of the old contract. This
supersedes the earlier supported-old-client gate. Windows real-account acceptance
is owned by the user and does not block delivery.

- [x] Publish SDK 0.7.0: require permissions, delete the legacy Boolean type and parser fallback.
- [x] Upgrade account-fe, admin-fe and hhc-web before removing server fields.
- [x] Remove `admin_access`, `presenter_cloud_access`, `HasAdminAccess` and
      `HasPresenterCloudAccess`; update OpenAPI and negative contract tests.
- [x] Remove the `hhc-desktop` / `client-web` implicit cloud-scope addition.
- [x] Verify CI, merge, release and live session/profile and website behavior.

Presenter 2.5.2 already requests `openid profile presenter:cloud:use` on new OAuth
login. Old sessions lacking the delegated cloud scope must sign in again; refresh
must not silently widen authorization. Keep local pending edits intact. Older
clients that require removed response fields are no longer supported by this
contract; update them instead of restoring application-specific response flags.

## Delivery and boundaries

Publish SDK, deploy website consumers, then retire Account fields. No new endpoint,
role assignment, data migration or automation activation. Keep the scheduled task
paused. For rollback after removal, restore the compatible Account producer before
rolling back to consumers that require its old fields.

Account's deployed token lifetime is 15 minutes; Gateway allows 60 seconds of clock
skew. Existing locally verified JWTs may remain usable for up to 16 minutes after
issuance. This is not an immediate-revocation guarantee.

## Retirement delivery evidence

- SDK #44 / v0.7.0 published; package and packed-consumer checks passed.
- account-fe #52, Admin #86 and website #80 deployed successfully before Account #69.
- Account #69 production run 34182748567 succeeded, revision `account-api--0000072`.
- Website production revision `hhc-web--0000082`; static account/Admin release jobs succeeded.
- Live authenticated session and profile returned HTTP 200 with permissions and neither
  legacy field. Account profile, Admin overview and public Admin menu worked after retirement.
- Full Go race checks, 275 account portal tests, 471 Admin tests and 324 website tests
  passed, along with builds and affected repository CI.
- Windows real-account acceptance is assigned to the user and is not an open delivery gate.
- Presenter remains v2.5.2: no desktop source change or new installer is required.

All implementation and agent-owned delivery items are complete. The scheduler stays paused.
