# Media Sync Slice 1: HHC Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HHC Authorization Code + PKCE login to LibrePresenter in Electron and browser mode with the approved credential-storage boundaries.

**Architecture:** Reuse Account API's authorization server and Account frontend. A small renderer auth contract selects a browser adapter or a narrow Electron preload adapter; Electron main stores the rotating refresh token with `safeStorage`, while browser mode relies on the existing Secure HttpOnly cookie and keeps access tokens in memory.

**Tech Stack:** TypeScript, React 19, Electron `safeStorage`/IPC/custom protocols, Web Crypto, Fetch API, Go 1.25, Gin, PostgreSQL migrations, Vitest, Playwright.

## Global Constraints

- Repositories:
  - `/Users/rayselfs/Projects/hhc/hhc-client-v2`
  - `/Users/rayselfs/Projects/hhc/website/account-api`
  - `/Users/rayselfs/Projects/hhc/website/account-fe`
  - `/Users/rayselfs/Projects/hhc/website/api-gateway`
- Create one focused feature branch per repository from its current production branch.
- Use Authorization Code + PKCE S256; do not implement device flow.
- OAuth scopes are exactly `openid profile`.
- Desktop client ID is `hhc-desktop` and redirect URI is `librepresenter://auth/account`.
- Browser client ID is `client-web` and redirect URI is `https://client.alive.org.tw/oauth/callback`.
- Only one sign-in transaction may be active per app instance.
- No auth SDK or new dependency.
- No refresh credential may be exposed to renderer JavaScript, localStorage, sessionStorage, IndexedDB, logs, or diagnostics.
- Electron access tokens remain in renderer memory; Electron refresh tokens are encrypted by `safeStorage` in main.
- Browser access tokens remain in memory; browser refresh tokens remain in the existing Secure HttpOnly cookie.
- Account API remains the only credential issuer.

---

## File Map

| Repository | File | Responsibility |
| --- | --- | --- |
| account-api | `migrations/000011_hhc_media_sync_auth.up.sql` | OAuth redirect replacement and IAM role/permission records |
| account-api | `migrations/000011_hhc_media_sync_auth.down.sql` | Safe migration rollback for test environments |
| account-api | `internal/database/db.go` | Fresh-install seed parity |
| account-api | `internal/database/migration_integration_test.go` | Migration and OAuth client assertions |
| account-api | `infra/main.bicep` | Exact browser client CORS origin |
| account-api | `scripts/test-release-policy.sh` | Production CORS configuration assertion |
| account-fe | `src/lib/redirects.ts` | Allowlisted `librepresenter` return scheme |
| account-fe | `src/lib/redirects.test.ts` | Reject lookalike and unsafe native redirects |
| api-gateway | `conf.d/common/account-client-cors.conf` | Exact credentialed browser auth CORS |
| api-gateway | `conf.d/map.conf` | Exact client/local origin map |
| api-gateway | `conf.d/default.conf` | CORS on browser account routes |
| api-gateway | `scripts/test-account-client-cors.sh` | Static CORS/auth route assertions |
| hhc-client-v2 | `src/shared/hhc-auth.ts` | Environment-neutral auth/session types |
| hhc-client-v2 | `src/shared/ipc-channels.ts` | Narrow Electron auth IPC |
| hhc-client-v2 | `src/main/ipc/hhc-auth.ts` | PKCE exchange/refresh/logout and encrypted refresh storage |
| hhc-client-v2 | `src/main/protocol-router.ts` | Exact custom-protocol dispatch shared with OneDrive |
| hhc-client-v2 | `src/renderer/src/lib/hhc-auth.ts` | Adapter factory and shared OAuth helpers |
| hhc-client-v2 | `src/renderer/src/lib/hhc-auth-browser.ts` | Browser cookie-mode adapter |
| hhc-client-v2 | `src/renderer/src/lib/hhc-auth-electron.ts` | Electron preload-mode adapter |
| hhc-client-v2 | `src/renderer/src/contexts/HhcAuthContext.tsx` | Non-persisted session lifecycle |
| hhc-client-v2 | `src/renderer/src/pages/HhcOAuthCallbackPage.tsx` | Browser callback completion |
| hhc-client-v2 | `src/renderer/src/auth-callback-entry.tsx` | Callback-only renderer entry |
| hhc-client-v2 | `src/renderer/src/main.tsx` | Exact callback pathname dispatch before HashRouter |
| hhc-client-v2 | `electron.vite.config.ts` | Validated HHC Account origin build constant |
| hhc-client-v2 | `src/shared/app-config.ts` | Shared Account origin |
| hhc-client-v2 | `src/shared/build-constants.d.ts` | Typed Account build constant |
| hhc-client-v2 | `src/renderer/src/components/Control/UserMenu/UserMenu.tsx` | Sign-in/account/sign-out actions |

### Task 1: Migrate the HHC OAuth clients and IAM records

**Repository:** `account-api`

**Files:**
- Create: `migrations/000011_hhc_media_sync_auth.up.sql`
- Create: `migrations/000011_hhc_media_sync_auth.down.sql`
- Modify: `internal/database/db.go`
- Modify: `internal/database/migration_integration_test.go`
- Modify: `infra/main.bicep`
- Modify: `scripts/test-release-policy.sh`

**Interfaces:**
- Produces role `media_sync_user`.
- Produces permissions `media-sync:read` and `media-sync:manage`.
- `media_sync_user` contains only `media-sync:read` from this feature.
- Updates `hhc-desktop` to only `librepresenter://auth/account`.
- Keeps `hhc-desktop` token delivery as `native_body`.
- Keeps `client-web` on `https://client.alive.org.tw/oauth/callback`.
- Keeps `client-web` token delivery as `browser_cookie`.
- Both clients allow `openid` and `profile`; no implementation requests `email`.

- [ ] **Step 1: Add failing migration assertions**

Extend the migration integration test to query the migrated records:

~~~go
assert.Equal(t, []string{"librepresenter://auth/account"}, desktop.RedirectURIs)
assert.Equal(t, "native_body", desktop.TokenDelivery)
assert.Contains(t, desktop.AllowedScopes, "openid")
assert.Contains(t, desktop.AllowedScopes, "profile")
assert.Equal(t, []string{"https://client.alive.org.tw/oauth/callback"}, web.RedirectURIs)
assert.Equal(t, "browser_cookie", web.TokenDelivery)
assert.Equal(t, int64(1), rolePermissionCount(t, db, "media_sync_user", "media-sync:read"))
assert.Equal(t, int64(0), rolePermissionCount(t, db, "media_sync_user", "media-sync:manage"))
~~~

Add a release-policy assertion that the production `CORS_ALLOWED_ORIGINS` value contains exact
`https://client.alive.org.tw` and no wildcard.

- [ ] **Step 2: Run the migration test and confirm missing records**

Run:

~~~bash
go test ./internal/database -run TestMigrations -count=1
~~~

Expected: failure because migration 11 and the role/permissions do not exist.

- [ ] **Step 3: Add idempotent SQL and seed parity**

The up migration must:

1. insert both permissions with `ON CONFLICT (code) DO UPDATE` for descriptions;
2. insert `media_sync_user` with `ON CONFLICT (name) DO UPDATE`;
3. insert the read role-permission join without granting manage;
4. replace, not append, the obsolete desktop redirect;
5. retain the exact browser redirect.

The down migration removes only the feature's role-permission join and role, then removes permissions only when no role/user references them. It restores `hhc://callback` only for migration-test rollback.

Update `seedRolesAndPermissions` and `seedOAuthClients` to match the migrated state so fresh and upgraded databases converge.

Append `https://client.alive.org.tw` to the exact production CORS origin list in `infra/main.bicep`.
Keep credentials enabled through the existing middleware; never use `*`.

- [ ] **Step 4: Run Account API validation**

Run:

~~~bash
gofmt -w internal/database/db.go internal/database/migration_integration_test.go
go test ./internal/database ./internal/services ./internal/handlers
./scripts/test-release-policy.sh
go test ./...
go build ./cmd/...
~~~

Expected: all commands pass.

- [ ] **Step 5: Commit**

~~~bash
git add migrations/000011_hhc_media_sync_auth.* internal/database/db.go internal/database/migration_integration_test.go infra/main.bicep scripts/test-release-policy.sh
git commit -m "feat: register LibrePresenter OAuth clients and media role"
~~~

### Task 2: Allow only the LibrePresenter native callback in Account frontend

**Repository:** `account-fe`

**Files:**
- Modify: `src/lib/redirects.ts`
- Modify: `src/lib/redirects.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces exact allowed native scheme `librepresenter`.
- Rejects `librepresenter-http`, userinfo lookalikes, fragments that replace OAuth parameters, `file`, `javascript`, and the retired `hhc` scheme.

- [ ] **Step 1: Add redirect allowlist tests**

~~~ts
expect(isAllowedRedirect('librepresenter://auth/account', config)).toBe(true)
expect(isAllowedRedirect('hhc://callback', config)).toBe(false)
expect(isAllowedRedirect('librepresenter-http://auth/account', config)).toBe(false)
expect(isAllowedRedirect('javascript:alert(1)', config)).toBe(false)
~~~

Also assert `buildOAuthRedirectUrl` preserves the exact host/path and adds only `code` and `state`.

- [ ] **Step 2: Run the test and confirm the old scheme**

Run:

~~~bash
npm run test:run -- src/lib/redirects.test.ts
~~~

Expected: `hhc` is currently allowed and `librepresenter` is rejected.

- [ ] **Step 3: Replace the default scheme**

Change the default native scheme list from `['hhc']` to `['librepresenter']`. Add an exact native URL check requiring protocol `librepresenter:`, host `auth`, path `/account`, no username/password, and no pre-existing `code` or `state`.

Document the production environment override without including credentials.

- [ ] **Step 4: Run Account frontend validation**

Run:

~~~bash
npm run lint
npm run test:run
npm run build
~~~

Expected: all pass.

- [ ] **Step 5: Commit**

~~~bash
git add src/lib/redirects.ts src/lib/redirects.test.ts README.md
git commit -m "fix: allow only LibrePresenter OAuth callbacks"
~~~

### Task 3: Publish exact browser-account CORS through API Gateway

**Repository:** `api-gateway`

**Files:**
- Create: `conf.d/common/account-client-cors.conf`
- Modify: `conf.d/map.conf`
- Modify: `conf.d/default.conf`
- Create: `scripts/test-account-client-cors.sh`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add failing static route assertions**

Follow the existing auth-routing scripts. Assert:

- only `https://client.alive.org.tw`, `http://localhost:5173`, and
  `http://127.0.0.1:5173` map to the account-client CORS variable;
- no regex/wildcard origin is accepted with credentials;
- exact CSRF, session, OAuth token, session access-token, refresh, and logout locations include the
  new CORS file;
- allowed methods are only GET/POST/OPTIONS;
- allowed request headers are `Accept, Content-Type, X-CSRF-Token`;
- `Access-Control-Allow-Credentials` is `true`;
- upstream CORS remains hidden by `proxy.conf`.

- [ ] **Step 2: Run the script and confirm failure**

~~~bash
./scripts/test-account-client-cors.sh
~~~

Expected: failure because the map/include do not exist.

- [ ] **Step 3: Add the dedicated CORS include**

Add `$account_client_cors_origin` to `map.conf` with only the three exact origins. The include returns
204 for OPTIONS before method restrictions, emits the exact origin and `Vary: Origin`, and does not
allow Authorization or arbitrary headers.

Include it only on:

~~~text
GET  /api/account/v1/csrf-token
GET  /api/account/v1/session
POST /api/account/v1/oauth/token
POST /api/account/v1/session/access-token
POST /api/account/v1/refresh
POST /api/account/v1/session/logout
~~~

- [ ] **Step 4: Validate Gateway policy and image**

~~~bash
go test ./...
./scripts/test-auth-routing.sh
./scripts/test-account-client-cors.sh
docker build --build-arg "RELEASE=hhc-auth-local" -t api-gateway:hhc-auth .
~~~

Expected: pass.

- [ ] **Step 5: Commit**

~~~bash
git add conf.d/common/account-client-cors.conf conf.d/map.conf conf.d/default.conf scripts/test-account-client-cors.sh .github/workflows/ci.yml
git commit -m "feat: allow LibrePresenter browser account sessions"
~~~

### Task 4: Add the shared HHC auth contract and browser adapter

**Repository:** `hhc-client-v2`

**Files:**
- Create: `src/shared/hhc-auth.ts`
- Create: `src/renderer/src/lib/hhc-auth.ts`
- Create: `src/renderer/src/lib/hhc-auth-browser.ts`
- Create: `src/renderer/src/lib/__tests__/hhc-auth-browser.test.ts`
- Create: `src/renderer/src/pages/HhcOAuthCallbackPage.tsx`
- Create: `src/renderer/src/pages/__tests__/HhcOAuthCallbackPage.test.tsx`
- Create: `src/renderer/src/auth-callback-entry.tsx`
- Modify: `src/renderer/src/main.tsx`
- Modify: `src/renderer/index.html`
- Modify: `electron.vite.config.ts`
- Modify: `src/shared/app-config.ts`
- Modify: `src/shared/build-constants.d.ts`
- Modify: `staticwebapp.config.json`
- Modify: `src/renderer/public/staticwebapp.config.json`

**Interfaces:**
- Produces:

~~~ts
export interface HhcSession {
  userId: string
  displayName: string
  avatarUrl?: string
  roles: string[]
}

export interface HhcAuthAdapter {
  getSession(): Promise<HhcSession | null>
  signIn(): Promise<void>
  getAccessToken(): Promise<string | null>
  signOut(): Promise<void>
  subscribe(listener: (session: HhcSession | null) => void): () => void
}
~~~

- Browser OAuth transaction is memory-only in the opener and contains `state`, `codeVerifier`,
  popup window identity, expiry, and return route.
- Browser refresh calls existing cookie-mode session/access-token endpoints with `credentials: 'include'`.
- Browser refresh, session access-token, and logout first fetch the existing CSRF token and send
  `X-CSRF-Token`.

- [ ] **Step 1: Write browser adapter and callback tests**

Test PKCE challenge generation, exact authorize parameters, blocked popup, exact-origin/source-window
`postMessage`, missing opener, state mismatch, popup reuse, expiry, single use, code exchange form,
memory-only access token, cookie credential mode, one refresh retry, logout, and no calls to Web
Storage. Assert CSRF requests use `credentials: 'include'` and `cache: 'no-store'`, concurrent
protected mutations share one in-flight CSRF fetch, and each protected POST sends
`X-CSRF-Token`.

Test access-token claim parsing for `sub`/`roles`/`exp`, session-user mismatch, malformed claims,
and expiry. Assert parsed roles only control local UI and are never sent as an authorization header
or trusted identity.

- [ ] **Step 2: Run tests and confirm missing modules**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/hhc-auth-browser.test.ts src/renderer/src/pages/__tests__/HhcOAuthCallbackPage.test.tsx
~~~

Expected: import failures because the auth modules do not exist.

- [ ] **Step 3: Implement the minimal browser flow**

Use `crypto.getRandomValues` and `crypto.subtle.digest('SHA-256', ...)`. Build the authorization URL with:

~~~text
client_id=client-web
redirect_uri=https://client.alive.org.tw/oauth/callback
response_type=code
code_challenge_method=S256
scope=openid profile
~~~

Open a blank popup synchronously from the sign-in click, then navigate it to the authorization URL.
Do not add `/oauth/callback` to `HashRouter`. In `main.tsx`, match exact pathname
`/oauth/callback` before hash/projection dispatch and dynamically import
`auth-callback-entry.tsx`. That callback page requires a same-origin opener and sends only
`code`/`state` to the exact opener with `postMessage`. The opener verifies origin, source window,
state, five-minute expiry, and single use before exchanging the code with its in-memory verifier. It
then closes the popup. Never fall back to Web Storage when the opener is missing.

Update CSP `connect-src` only for the configured Account/API Gateway origins used by this flow. Keep
both checked-in Static Web Apps configs identical and add an exact callback route with
`Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

Add one `VITE_HHC_ACCOUNT_ORIGIN` build input with production default
`https://account.alive.org.tw`. Validate it as an HTTP(S) origin in `electron.vite.config.ts`, expose
only the origin through `APP_CONFIG`, and derive OAuth/API paths from it. Do not define separate
origins in individual auth modules.

Implement a memory-only CSRF token plus module-level in-flight request coalescing, following Account
frontend's existing `getCsrfToken` behavior without importing/copying its full API client. Clear the
token after a CSRF rejection or logout and retry the protected request once.

Build `HhcSession.roles` from the newly issued Account access token after requiring token `sub` to
match the `/session` user ID. Treat these claims as display/feature hints only; protected API calls
send the original bearer token and never synthesize role headers.

- [ ] **Step 4: Run browser auth tests and typecheck**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/hhc-auth-browser.test.ts src/renderer/src/pages/__tests__/HhcOAuthCallbackPage.test.tsx
npm run typecheck:web
~~~

Expected: all pass and tests prove no local/session storage write.

- [ ] **Step 5: Commit**

~~~bash
git add src/shared/hhc-auth.ts src/renderer/src/lib/hhc-auth.ts src/renderer/src/lib/hhc-auth-browser.ts src/renderer/src/lib/__tests__/hhc-auth-browser.test.ts src/renderer/src/pages/HhcOAuthCallbackPage.tsx src/renderer/src/pages/__tests__/HhcOAuthCallbackPage.test.tsx src/renderer/src/auth-callback-entry.tsx src/renderer/src/main.tsx src/renderer/index.html electron.vite.config.ts src/shared/app-config.ts src/shared/build-constants.d.ts staticwebapp.config.json src/renderer/public/staticwebapp.config.json
git commit -m "feat: add browser HHC account authentication"
~~~

### Task 5: Add exact protocol routing and encrypted Electron credentials

**Repository:** `hhc-client-v2`

**Files:**
- Create: `src/main/protocol-router.ts`
- Create: `src/main/ipc/hhc-auth.ts`
- Create: `src/main/__tests__/protocol-router.test.ts`
- Create: `src/main/__tests__/ipc/hhc-auth.test.ts`
- Create: `src/renderer/src/lib/hhc-auth-electron.ts`
- Create: `src/renderer/src/lib/__tests__/hhc-auth-electron.test.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc/onedrive-credentials.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

**Interfaces:**
- Produces protocol parser:

~~~ts
type LibrePresenterProtocolAction =
  | { kind: 'account-auth'; code: string; state: string }
  | { kind: 'onedrive-auth'; url: string }
  | { kind: 'ignore' }
~~~

- Produces IPC methods `begin`, `complete`, `getAccessToken`, `getSession`, and `signOut` plus one callback subscription.
- Main stores one encrypted refresh-token record under Electron `userData` using `safeStorage.encryptString`.
- Main composes one `HhcAuthService` instance; IPC is only an adapter over it, so later trusted
  main-process Asset calls can request the current token without round-tripping through renderer.

- [ ] **Step 1: Write protocol and credential-boundary tests**

Cover:

- exact `librepresenter://auth/account?code=...&state=...` dispatch;
- existing OneDrive callback dispatch;
- unknown host/path, duplicate code/state, userinfo, and malformed URL rejection;
- second-instance and macOS `open-url` equivalence;
- one active state only;
- `safeStorage.isEncryptionAvailable() === false` fails closed with no credential write;
- encrypted bytes written, never plaintext;
- main calls the existing Account `/me` endpoint with the access token to obtain Electron display
  identity, and the returned user ID must match token `sub`;
- renderer preload exposes no load/save refresh-token method.

- [ ] **Step 2: Run tests and confirm missing router/IPC**

Run:

~~~bash
npx vitest run src/main/__tests__/protocol-router.test.ts src/main/__tests__/ipc/hhc-auth.test.ts src/renderer/src/lib/__tests__/hhc-auth-electron.test.ts
~~~

Expected: missing module failures.

- [ ] **Step 3: Implement main-owned OAuth completion**

Route all custom-protocol entry points through `parseLibrePresenterProtocolUrl`. Keep OneDrive behavior unchanged.

`hhc-auth.ts` in main:

1. validates the initiating renderer with `isKnownWindow`;
2. generates state/verifier/challenge;
3. opens Account frontend in the system browser;
4. accepts only a matching callback once;
5. exchanges code with `client_id=hhc-desktop`;
6. encrypts and atomically replaces the refresh record;
7. returns access token/session only through typed invoke;
8. refreshes in main and rotates the encrypted value;
9. calls Account `/me` from main to build display identity and combines it with token role hints only
   after matching user IDs;
10. deletes the record on logout even if server logout fails.

Use Node filesystem primitives already available; add no credential package.
Export only the main-process service type/factory and a separate `registerHhcAuthIpc(service)`
function. Preload remains narrow and cannot obtain refresh credentials.

- [ ] **Step 4: Run Electron auth and existing OneDrive tests**

Run:

~~~bash
npx vitest run src/main/__tests__/protocol-router.test.ts src/main/__tests__/ipc/hhc-auth.test.ts src/renderer/src/lib/__tests__/hhc-auth-electron.test.ts src/renderer/src/lib/__tests__/onedrive-auth.test.ts src/main/__tests__/ipc/onedrive-credentials.test.ts
npm run typecheck:node
npm run typecheck:web
~~~

Expected: all pass and OneDrive protocol callbacks remain functional.

- [ ] **Step 5: Commit**

~~~bash
git add src/main/protocol-router.ts src/main/ipc/hhc-auth.ts src/main/__tests__ src/renderer/src/lib/hhc-auth-electron.ts src/renderer/src/lib/__tests__/hhc-auth-electron.test.ts src/main/index.ts src/main/ipc/onedrive-credentials.ts src/shared/ipc-channels.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add secure Electron HHC account authentication"
~~~

### Task 6: Integrate the session lifecycle and account UI

**Repository:** `hhc-client-v2`

**Files:**
- Create: `src/renderer/src/contexts/HhcAuthContext.tsx`
- Create: `src/renderer/src/contexts/__tests__/HhcAuthContext.test.tsx`
- Modify: `src/renderer/src/main.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Modify: `.github/workflows/azure-static-web-apps-zealous-river-03bbb7100.yml`
- Modify: `.github/workflows/build-release.yml`
- Modify: `e2e/browser-projection.spec.ts`

**Interfaces:**
- Produces `useHhcAuth()` with `status`, `session`, `signIn`, `signOut`, and `getAccessToken`.
- Session status is `loading | anonymous | authenticated | unavailable`.
- No Zustand persistence is added.

- [ ] **Step 1: Write context and menu tests**

Test bootstrap, duplicate refresh coalescing, anonymous sign-in action, authenticated account label, logout, adapter subscription cleanup under StrictMode, and failure state without deleting local non-HHC media.

- [ ] **Step 2: Run tests and confirm missing provider**

Run:

~~~bash
npx vitest run src/renderer/src/contexts/__tests__/HhcAuthContext.test.tsx src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx
~~~

Expected: missing provider/hook failures.

- [ ] **Step 3: Mount the context and lazy auth UI**

Create the adapter inside an effect-safe provider lifecycle. Add one account section to the existing User menu. Do not create a separate settings dialog.

Keep `hhc-auth.ts` as the small static contract/factory and dynamically import
`hhc-auth-browser.ts` or `hhc-auth-electron.ts` only for the detected environment. The projection
route must not pull either adapter into its entry chunk.

Add `VITE_HHC_ACCOUNT_ORIGIN` to the browser and desktop build workflows; its value comes from a
GitHub environment variable and is not a secret.

Extend browser E2E with a mocked Account API journey that reloads the page, restores through the cookie session endpoint, and keeps the access token out of storage.

- [ ] **Step 4: Run the Slice 1 client gate**

Run:

~~~bash
npm run lint
npm run typecheck
npx vitest run
npm run build
npm run test:e2e:browser
~~~

Expected: all pass and bundle budgets remain green.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer/src/contexts/HhcAuthContext.tsx src/renderer/src/contexts/__tests__/HhcAuthContext.test.tsx src/renderer/src/main.tsx src/renderer/src/components/Control/UserMenu/UserMenu.tsx src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx src/renderer/src/locales .github/workflows/azure-static-web-apps-zealous-river-03bbb7100.yml .github/workflows/build-release.yml e2e/browser-projection.spec.ts
git commit -m "feat: integrate HHC account session UI"
~~~

## Slice 1 Gate

Before Asset collection work begins:

- Account API migration and fresh seed converge to the same OAuth/IAM records.
- Desktop callback accepts only `librepresenter://auth/account`.
- Existing OneDrive custom-protocol login still passes.
- Browser and Electron both use PKCE S256 and `openid profile`.
- Browser refresh uses the HttpOnly cookie; Electron refresh uses encrypted main-process storage.
- No refresh credential is readable from renderer APIs or browser databases.
- Account API, Account frontend, client unit tests, browser E2E, typecheck, lint, and builds pass.

## Rollback

- Hide the LibrePresenter sign-in entry first so no new authorization transaction starts.
- Remove only the new browser/native redirect URIs and HHC role assignments; retain additive IAM
  records until issued sessions have expired and audit reconciliation is complete.
- Revert the exact Gateway/browser CORS locations with the client UI. Do not broaden CORS or leave a
  callback route reachable without its matching client implementation.
- Delete Electron refresh credentials through the auth service before downgrading to a build that
  cannot read the new encrypted record.
