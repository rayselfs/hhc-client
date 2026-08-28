# Account native-auth completion implementation plan

> Execute in the isolated `account-api` and `account-fe` worktrees. Keep changes additive and
> compatible with the currently deployed LibrePresenter callback.

**Goal:** Finish native login in an informative browser page and retain a safe path back to
LibrePresenter for new social and email accounts.

**Repositories:** `HallelujahHomeChurch/account-api`, `HallelujahHomeChurch/account-fe`

## Task 1: Lock redirect and continuation contracts with failing tests

**Account API files:**

- Modify: `internal/handlers/oauth_handler_test.go`
- Modify: `docs/openapi.yaml`

Add tests for wrapping only the registered LibrePresenter callback in the Account FE completion URL,
leaving HTTP callbacks unchanged, and rejecting malformed callbacks. Preserve the email-registration
continuation in Account FE without changing the API contract. Run the focused Go tests and confirm
they fail for the missing behavior.

## Task 2: Implement the minimal Account API redirect wrapper

**Account API files:**

- Modify: `internal/handlers/oauth_handler.go`
- Modify: `internal/handlers/auth_handler.go`

Build the completion URL from the configured Account FE origin and put the validated custom callback
in the URL fragment. Reuse it for provider callbacks; Account FE handles password-login OAuth
completion. Never carry an expired authorization code or arbitrary URL.

Update `docs/openapi.yaml` and contract tests in the same commit for any request/response field.
Run `gofmt`, focused tests, `go test ./...`, release-policy tests, and `go build ./...`.

## Task 3: Add the Account FE completion page test-first

**Account FE files:**

- Create: `src/pages/NativeAuthCompletePage.tsx`
- Create: `src/pages/NativeAuthCompletePage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/auth/auth-routes.ts`
- Modify: `src/auth/auth-context.tsx`
- Modify: `src/lib/redirects.ts`
- Modify: `src/lib/redirects.test.ts`
- Modify: `src/i18n/messages.ts`

Test fragment parsing, immediate fragment removal, only the exact LibrePresenter callback, automatic
open, manual retry, and restart intent. Route all native password-login completions through the page.
Do not introduce a new dependency.

## Task 4: Preserve email registration continuation

**Account FE files:**

- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/RegisterPage.test.tsx`
- Modify: `src/pages/VerifyEmailPage.tsx`
- Modify: `src/pages/VerifyEmailPage.test.tsx`
- Modify only if the API contract requires it: `src/lib/api.ts`
- Modify only if the API contract requires it: `src/lib/api.test.ts`

Keep the existing `auth_request_id` behavior for social providers. For email, retain the native marker
through verification and route success to the completion/restart page. Treat the opaque request ID as
expired after the server rejects it; never relax PKCE/state validation.

Run `pnpm lint`, `pnpm test:run`, and `pnpm build`.

## Task 5: PR and release gate

Push both branches and open linked PRs. Wait for required CI and resolve review findings. Do not merge
either account PR while the no-release constraint is active, because both repositories deploy
production from `main`.
