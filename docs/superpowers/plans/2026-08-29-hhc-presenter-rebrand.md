# HHC Presenter Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product, application identity, active code, repository, packaging, and release flow to HHC Presenter and publish a clean `v2.4.0` release.

**Architecture:** Replace the active LibrePresenter identity directly, without compatibility aliases or data migration. Reuse the existing i18next, Electron, electron-builder, GitHub Actions, and electron-updater flows. Windows detects and downloads updates in the background but installs only after confirmation; macOS detects updates and uses a user-triggered, SHA-256-verified DMG download because the app is unsigned.

**Tech Stack:** Electron 41, React 19, TypeScript 5.9, i18next, HeroUI 3, electron-builder 26, electron-updater 6, Node crypto, Vitest, Playwright, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-29-hhc-presenter-rebrand-design.md`

## Global Constraints

- Start implementation in an isolated worktree created from latest `origin/main`.
- Use `HHC Presenter`, `HHC 投影系統`, and `HHC 投影系统` exactly as specified.
- Use `tw.org.alive.presenter`, `hhc-presenter`, and `hhc-presenter://` for the new technical identity.
- Start with empty application data; add no migration, fallback alias, importer, or bridge release.
- Keep the default GitHub `latest` updater channel; old application behavior is out of scope.
- Check for updates after startup and every 60 minutes from the main process.
- On Windows, download detected updates automatically but install only after user confirmation.
- On macOS, require a user-triggered DMG download, exact `SHA256SUMS` verification, and then open the DMG.
- Never execute a Gatekeeper-bypass command; only display the documented fallback after verification.
- Preserve dated plans and release records when the former name is historical evidence.
- Do not add dependencies or introduce a shared branding abstraction solely for this rename.
- Keep browser and Electron modes working.
- Do not publish `v2.4.0` until Account and OneDrive accept the new redirect URIs.

---

### Task 1: Replace package and distribution identity

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `electron-builder.yml`
- Modify: `dev-app-update.yml`
- Modify: `.github/workflows/build-release.yml`
- Modify: `src/main/__tests__/check-packaged-runtime.test.ts`
- Modify: `e2e/electron-packaged.spec.ts`

**Interfaces:**
- Consumes: Existing electron-builder configuration and release workflow.
- Produces: Packages named `HHC Presenter` with app ID `tw.org.alive.presenter`, executable/artifact slug `hhc-presenter`, and GitHub updater repo `rayselfs/hhc-presenter`.

- [ ] **Step 1: Update package metadata and lockfile expectations**

Set these exact values:

```json
{
  "name": "hhc-presenter",
  "version": "2.4.0",
  "description": "A projection system designed for church services."
}
```

Run:

```bash
npm install --package-lock-only --ignore-scripts
```

Expected: `package.json` and the root package entry in `package-lock.json` both report
`hhc-presenter@2.4.0`; dependency versions do not change.

- [ ] **Step 2: Write failing package identity assertions**

Update packaged-runtime and Electron E2E expectations to require:

```text
dist/mac-arm64/HHC Presenter.app/Contents/MacOS/HHC Presenter
dist/win-unpacked/hhc-presenter.exe
dist/hhc-presenter-2.4.0-setup.exe
```

Also require the packaged window title to match `/HHC Presenter|HHC 投影系統|HHC 投影系统/`.

- [ ] **Step 3: Run the focused checks and confirm failure**

Run:

```bash
npx vitest run src/main/__tests__/check-packaged-runtime.test.ts
```

Expected: FAIL because the current builder configuration still produces LibrePresenter paths.

- [ ] **Step 4: Replace electron-builder and updater identity**

Set the effective configuration to:

```yaml
appId: tw.org.alive.presenter
productName: HHC Presenter
protocols:
  name: HHC Presenter
  schemes:
    - hhc-presenter
win:
  executableName: hhc-presenter
mac:
  artifactName: hhc-presenter-${version}-${arch}-mac.${ext}
nsis:
  artifactName: hhc-presenter-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
dmg:
  artifactName: hhc-presenter-${version}.${ext}
appImage:
  artifactName: hhc-presenter-${version}.${ext}
publish:
  provider: github
  owner: rayselfs
  repo: hhc-presenter
```

Set `dev-app-update.yml` to repo `hhc-presenter` and cache
`hhc-presenter-updater`. Update workflow executable paths and artifact names to match.

- [ ] **Step 5: Run static quality checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit the distribution identity**

```bash
git add package.json package-lock.json electron-builder.yml dev-app-update.yml \
  .github/workflows/build-release.yml src/main/__tests__/check-packaged-runtime.test.ts \
  e2e/electron-packaged.spec.ts
git commit -m "chore: rename distribution to HHC Presenter"
```

### Task 2: Replace runtime protocols and persisted identifiers

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/protocol-router.ts`
- Modify: `src/main/ipc/hhc-auth.ts`
- Modify: `src/main/ipc/onedrive-credentials.ts`
- Modify: `src/main/lan-remote/server.ts`
- Modify: `src/main/lan-remote/mobile-ui.ts`
- Modify: `src/renderer/src/lib/onedrive-connect.ts`
- Modify: `src/renderer/src/lib/onedrive-web-credentials.ts`
- Modify: `src/renderer/src/lib/site-data.ts`
- Modify: `src/renderer/src/lib/presentation-media.ts`
- Modify: `src/renderer/src/lib/media-capabilities.ts`
- Modify: `src/renderer/src/lib/recovery-center.ts`
- Test: Matching tests under `src/main/__tests__`, `src/main/lan-remote/__tests__`, `src/renderer/src/lib/__tests__`, `src/renderer/src/stores/__tests__`, and `e2e/`

**Interfaces:**
- Consumes: New distribution identity from Task 1.
- Produces: Runtime scheme `hhc-presenter://`, AUMID `tw.org.alive.presenter`, MIME type `application/vnd.hhc.presenter+json`, and fresh HHC Presenter storage identifiers.

- [ ] **Step 1: Change protocol tests first**

Replace protocol fixtures with:

```text
hhc-presenter://auth/account?code=authorization-code&state=expected-state
hhc-presenter://auth/onedrive?code=code&state=state
```

Rename exported test imports to:

```ts
HhcPresenterProtocolAction
parseHhcPresenterProtocolUrl
createHhcPresenterProtocolDispatcher
```

- [ ] **Step 2: Run protocol and OAuth tests to confirm failure**

Run:

```bash
npx vitest run src/main/__tests__/protocol-router.test.ts \
  src/main/__tests__/ipc/hhc-auth.test.ts \
  src/main/__tests__/ipc/onedrive-credentials.test.ts
```

Expected: FAIL on the old scheme and exported symbol names.

- [ ] **Step 3: Replace protocol and desktop identity**

Implement the exact scheme and identifiers:

```ts
const REDIRECT_URI = 'hhc-presenter://auth/account'
export const ONEDRIVE_AUTH_REDIRECT_URI = 'hhc-presenter://auth/onedrive'
electronApp.setAppUserModelId('tw.org.alive.presenter')
```

Rename the protocol type/parser/dispatcher symbols and register only `hhc-presenter` with Electron.
Change the OAuth device name to `HHC Presenter Electron (${process.platform})`.

- [ ] **Step 4: Replace fresh storage, LAN, MIME, and diagnostic identifiers**

Use these exact strings with no old-key fallback:

```text
x-hhc-presenter-session
hhc-presenter:onedrive-callback
hhc-presenter-onedrive-web-credentials
application/vnd.hhc.presenter+json
hhc-presenter-diagnostics.json
```

Update every matching fixture and assertion in the same change.

- [ ] **Step 5: Run the focused runtime suite**

Run:

```bash
npx vitest run src/main/__tests__/protocol-router.test.ts \
  src/main/__tests__/ipc/hhc-auth.test.ts \
  src/main/__tests__/ipc/onedrive-credentials.test.ts \
  src/main/lan-remote/__tests__/server.test.ts \
  src/renderer/src/lib/__tests__/onedrive-connect.test.ts \
  src/renderer/src/lib/__tests__/recovery-center.test.ts \
  src/renderer/src/stores/__tests__/media-projection.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit runtime identity changes**

```bash
git add src/main src/renderer/src e2e
git commit -m "refactor: replace LibrePresenter runtime identity"
```

### Task 3: Localize product naming and empty projection branding

**Files:**
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/__tests__/i18n.test.ts`
- Modify: `src/renderer/src/components/Projection/DefaultProjection.tsx`
- Create: `src/renderer/src/components/Projection/__tests__/DefaultProjection.test.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/AboutDialog.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/__tests__/AboutDialog.test.tsx`
- Modify: `src/renderer/src/components/Control/AppLoadingScreen.tsx`
- Modify: `src/renderer/index.html`
- Modify: `src/main/windowManager.ts`
- Modify: `src/renderer/public/onedrive-callback.html`

**Interfaces:**
- Consumes: Existing i18next initialization shared by control and projection renderer entries.
- Produces: `app.name` and `app.description` translations used by visible product branding.

- [ ] **Step 1: Add failing locale contract assertions**

Add these exact expectations to `i18n.test.ts`:

```ts
expect(i18n.t('app.name', { lng: 'en' })).toBe('HHC Presenter')
expect(i18n.t('app.name', { lng: 'zh-TW' })).toBe('HHC 投影系統')
expect(i18n.t('app.name', { lng: 'zh-CN' })).toBe('HHC 投影系统')
expect(i18n.t('app.description', { lng: 'en' })).toBe(
  'A projection system designed for church services.'
)
expect(i18n.t('app.description', { lng: 'zh-TW' })).toBe('專為教會聚會設計的投影系統。')
expect(i18n.t('app.description', { lng: 'zh-CN' })).toBe('专为教会聚会设计的投影系统。')
```

- [ ] **Step 2: Add a failing empty projection test**

Render `DefaultProjection`, switch i18n language for each case, and require the corresponding
localized `app.name` text. Restore language to `en` after each test.

- [ ] **Step 3: Run the focused renderer tests to confirm failure**

Run:

```bash
npx vitest run src/renderer/src/i18n/__tests__/i18n.test.ts \
  src/renderer/src/components/Projection/__tests__/DefaultProjection.test.tsx \
  src/renderer/src/components/Control/UserMenu/__tests__/AboutDialog.test.tsx
```

Expected: FAIL because the translation keys and localized projection name do not exist.

- [ ] **Step 4: Add locale values and replace visible product strings**

Add `app.name` and `app.description` to all three locale files. Use `useTranslation()` in
`DefaultProjection`, About, and Loading components instead of hardcoded branding. Replace remaining
active UI copy such as Welcome, licenses, OneDrive descriptions, callback page, document title, and
main window title with the correct localized or canonical HHC Presenter name.

- [ ] **Step 5: Run focused tests**

Run the command from Step 3.

Expected: PASS with all locale bundles retaining identical keys.

- [ ] **Step 6: Commit localized branding**

```bash
git add src/renderer src/main/windowManager.ts
git commit -m "feat: localize HHC Presenter branding"
```

### Task 4: Rename active documentation and project metadata

**Files:**
- Modify: `README.md`
- Modify: `LICENSE`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `docs/release/unsigned-desktop-releases.md`
- Modify: `docs/release/media-sync-runbook.md`
- Modify: `docs/soundboard-architecture.md`
- Rename: `docs/roadmap/librepresenter-roadmap.md` to `docs/roadmap/hhc-presenter-roadmap.md`
- Rename: `docs/roadmap/librepresenter-optimization-roadmap.md` to `docs/roadmap/hhc-presenter-optimization-roadmap.md`
- Modify: `docs/roadmap/milestones/M4-slide-ppt-template-system.md`
- Modify: `docs/roadmap/milestones/M9-release-license-distribution.md`
- Modify: `electron.vite.config.ts`

**Interfaces:**
- Consumes: Product names and description from the design spec.
- Produces: Active documentation and PWA metadata that describe HHC Presenter as a church projection system.

- [ ] **Step 1: Rename current roadmap files with Git history preserved**

```bash
git mv docs/roadmap/librepresenter-roadmap.md docs/roadmap/hhc-presenter-roadmap.md
git mv docs/roadmap/librepresenter-optimization-roadmap.md \
  docs/roadmap/hhc-presenter-optimization-roadmap.md
```

- [ ] **Step 2: Replace active documentation branding**

Use `HHC Presenter` and the exact English description. Update links to the renamed roadmap files and
the GitHub license URL under `rayselfs/hhc-presenter`. Do not rewrite dated implementation plans or
release evidence merely to remove historical names.

- [ ] **Step 3: Replace PWA manifest names**

Set both generated manifest values:

```ts
name: 'HHC Presenter'
short_name: 'HHC Presenter'
```

- [ ] **Step 4: Run active-brand audit**

Run:

```bash
git grep -n -I -e 'LibrePresenter' -e 'libre-presenter' -e 'librepresenter' -- \
  ':!package-lock.json' ':!docs/superpowers/plans/**' ':!docs/superpowers/specs/**' \
  ':!plans/**' ':!specs/**' \
  ':!docs/release/media-sync-pilot-manifest.md'
```

Expected: no matches in active code, configuration, tests, README, or current product documentation.

- [ ] **Step 5: Commit documentation and metadata**

```bash
git add README.md LICENSE THIRD_PARTY_NOTICES.md docs electron.vite.config.ts
git commit -m "docs: rename project to HHC Presenter"
```

### Task 5: Split Windows and macOS update workflows

**Files:**
- Modify: `src/main/updateService.ts`
- Create: `src/main/macUpdateDownloader.ts`
- Modify: `src/main/__tests__/updateService.test.ts`
- Create: `src/main/__tests__/macUpdateDownloader.test.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/hooks/useAutoUpdateCheck.ts`
- Modify: `src/renderer/src/hooks/__tests__/useAutoUpdateCheck.test.tsx`
- Modify: `src/renderer/src/stores/update.ts`
- Modify: `src/renderer/src/stores/selectors/update.ts`
- Modify: `src/renderer/src/stores/__tests__/update.test.ts`
- Modify: `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`
- Create: `src/renderer/src/components/Control/UserMenu/MacUpdateInstallDialog.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx`
- Create: `src/renderer/src/components/Control/UserMenu/__tests__/MacUpdateInstallDialog.test.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`

**Interfaces:**
- Consumes: GitHub `latest.yml` / `latest-mac.yml`, release DMG, and `SHA256SUMS`.
- Produces: Windows background download plus confirmed install, and macOS verified manual DMG download plus install guidance.

- [ ] **Step 1: Write failing shared-contract and state tests**

Replace the combined `update:download-and-install` contract with two explicit main-process actions:

```ts
'update:install-downloaded'
'update:download-mac-installer'
```

Extend `UpdateStatus` only with the states needed by the UI:

```ts
'idle' | 'checking' | 'available' | 'downloading' | 'verifying' |
  'downloaded' | 'installer-opened' | 'not-available' | 'error'
```

Update preload typing to expose `installDownloaded()` and `downloadMacInstaller()`. Write store,
selector, hook, and UserMenu tests first for these exact transitions:

- Windows `available` becomes `downloading` without a click; `downloaded` enables installation.
- The Windows install action asks for confirmation before invoking `installDownloaded()`.
- macOS `available` enables **Download update**; its click invokes `downloadMacInstaller()`.
- macOS `downloading` reports progress, `verifying` reports verification, and
  `installer-opened` opens the installation dialog.
- Browser mode exposes no updater action.

Run:

```bash
npx vitest run \
  src/renderer/src/stores/__tests__/update.test.ts \
  src/renderer/src/hooks/__tests__/useAutoUpdateCheck.test.tsx \
  src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx
```

Expected: FAIL because the current contract has one click-to-download-and-install action and no
platform-specific states.

- [ ] **Step 2: Write failing main-process updater tests**

Expand `updateService.test.ts` with fake timers and platform mocks. Require:

1. Packaged Windows sets `autoDownload = true` and `autoInstallOnAppQuit = false`.
2. Packaged macOS sets both flags to `false`.
3. The first check runs after the existing three-second startup delay, then every
   `60 * 60 * 1000` milliseconds.
4. A check already in progress or an active download is not started again.
5. Windows `update-downloaded` emits `downloaded`; `update:install-downloaded` calls only
   `quitAndInstall()` and never calls `downloadUpdate()`.
6. A later Windows check is allowed after download completion so `electron-updater` can invalidate
   a stale cached package and automatically download the newer metadata result.
7. `update:download-mac-installer` is rejected off macOS; `update:install-downloaded` is rejected
   off Windows.

Run:

```bash
npx vitest run src/main/__tests__/updateService.test.ts
```

Expected: FAIL against the current manual-download implementation and one-time schedule.

- [ ] **Step 3: Implement the minimal Windows update state machine and hourly schedule**

In `updateService.ts`, keep `electron-updater` as the sole Windows downloader and cache owner:

```ts
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

autoUpdater.autoDownload = process.platform === 'win32'
autoUpdater.autoInstallOnAppQuit = false
```

Track only whether a check or download is active. Use the existing three-second startup check and
one `setInterval` for the hourly check. Clear the active flags from updater completion/error events.
Do not write custom package deletion: installed `electron-updater` already compares update metadata
and checksum, clears a mismatched pending cache entry, and downloads the replacement.

Register `update:install-downloaded` only as a guarded Windows call to `quitAndInstall()`. Preserve
the explicit renderer `update:check` action for About/UserMenu checks.

- [ ] **Step 4: Write the failing macOS downloader security check**

Create focused tests for one exported `downloadMacUpdate()` function; do not introduce a one-use
interface or factory. Mock Electron download events, `net.fetch`, filesystem calls, and `shell` at
the module boundary. Require:

- Exact asset URL:
  `https://github.com/rayselfs/hhc-presenter/releases/download/v2.4.0/hhc-presenter-2.4.0.dmg`.
- Save paths remain inside `path.join(app.getPath('temp'), 'hhc-presenter-updates')`.
- Only older `.dmg` files in that directory are removed before download.
- Progress is forwarded from `DownloadItem`.
- `SHA256SUMS` must contain an exact `hhc-presenter-2.4.0.dmg` entry.
- A matching SHA-256 returns the verified path.
- A missing or mismatched checksum removes the new DMG and rejects.
- Cancelled or interrupted downloads reject and never open a file.

Run:

```bash
npx vitest run src/main/__tests__/macUpdateDownloader.test.ts
```

Expected: FAIL because the downloader does not exist.

- [ ] **Step 5: Implement the native macOS DMG download and verification**

Implement `downloadMacUpdate(window, version, onProgress, onVerifying)` with installed/native APIs
only:

1. Validate `version` with the release version format before interpolating a URL or filename.
2. Create the fixed managed temporary directory with `fs/promises.mkdir`.
3. Delete only directory entries ending in `.dmg`; never accept a caller-provided directory.
4. Attach the window session's `will-download` listener before calling
   `window.webContents.downloadURL()`. Require `DownloadItem.getURLChain()` to contain the exact
   GitHub asset URL before calling `DownloadItem.setSavePath()`.
5. Await a completed `done` event and reject cancellation/interruption.
6. Fetch the same release's `SHA256SUMS` with Electron `net.fetch`.
7. Parse the exact filename, hash the local DMG with Node `crypto`, and compare normalized digests.
8. Delete and reject on any checksum failure; return the verified DMG path on success.

The update service then calls `shell.openPath()` and treats a non-empty returned error string as a
failure. Emit `installer-opened` only after successful open. Never invoke `xattr` or any other shell
command.

- [ ] **Step 6: Implement the platform-specific UserMenu and macOS guidance**

Reuse the existing `isMacOS()` helper, update store, `useConfirm`, i18next bundles, and HeroUI v3
compound Modal/Button APIs. Do not add a platform context or UI dependency.

Windows behavior:

- `downloading` is informational and cannot be clicked.
- `downloaded` reads **Install update** and asks whether to close and install now.
- A declined confirmation keeps the downloaded update available.

macOS behavior:

- `available` reads **Download update** and starts the dedicated DMG action.
- `downloading` and `verifying` are informational and cannot be clicked again.
- `installer-opened` shows `MacUpdateInstallDialog` with these exact paths:
  **System Settings → Privacy & Security → Open Anyway**, followed by the copyable fallback:

```bash
xattr -dr com.apple.quarantine "/Applications/HHC Presenter.app"
```

State clearly that the fallback bypasses Gatekeeper. The dialog may copy the command with
`navigator.clipboard.writeText`; it must never execute it. Closing the dialog returns the store to
`idle`.

Add the new labels and guidance to all three existing locale bundles rather than hard-coding UI
copy. At minimum localize **Download update**, **Install update**, **Verifying download**, the
Windows close-and-install confirmation, the macOS **Open Anyway** steps, the Gatekeeper warning,
and the copy-command success/failure feedback.

- [ ] **Step 7: Run focused updater checks and commit**

Run:

```bash
npx vitest run \
  src/main/__tests__/updateService.test.ts \
  src/main/__tests__/macUpdateDownloader.test.ts \
  src/renderer/src/stores/__tests__/update.test.ts \
  src/renderer/src/hooks/__tests__/useAutoUpdateCheck.test.tsx \
  src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx \
  src/renderer/src/components/Control/UserMenu/__tests__/MacUpdateInstallDialog.test.tsx
npm run typecheck
```

Expected: PASS. Review the diff to confirm no dependency, custom Windows cache, automatic macOS
installation, or automatic Gatekeeper bypass was added.

```bash
git add src/main/updateService.ts src/main/macUpdateDownloader.ts \
  src/main/__tests__/updateService.test.ts src/main/__tests__/macUpdateDownloader.test.ts \
  src/shared/ipc-channels.ts src/preload src/renderer/src
git commit -m "feat: split Windows and macOS update flows"
```

### Task 6: Complete local quality and package verification

**Files:**
- Modify only files required to correct failures caused by Tasks 1-5.

**Interfaces:**
- Consumes: Complete HHC Presenter source and configuration.
- Produces: A reviewable branch proven by repository-required local gates.

- [ ] **Step 1: Run the complete unit suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Run static and build gates**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: all commands PASS, including bundle budget checks.

- [ ] **Step 3: Run browser E2E**

```bash
npm run test:e2e:browser
```

Expected: all browser projects PASS with HHC Presenter titles and fresh storage identifiers.

- [ ] **Step 4: Build and inspect the local macOS package**

```bash
npm run build:mac
npm run check:packaged-runtime
```

Expected: package paths, executable, metadata, app ID, protocol, updater repo/cache, and runtime
checks all use the new identity.

- [ ] **Step 5: Run packaged Electron smoke**

```bash
npm run test:e2e:packaged
```

Expected: control and projection windows open, the empty projection shows the localized HHC name,
and no existing LibrePresenter data appears.

- [ ] **Step 6: Review and commit verification corrections**

If verification required code corrections, rerun the failing gate and commit only those corrections:

```bash
git add <corrected-files>
git commit -m "test: align HHC Presenter release checks"
```

### Task 7: Merge, rename repository, and publish `v2.4.0`

**Files:**
- No product-code changes after the reviewed release commit.
- External: GitHub repository settings, Account OAuth registration, OneDrive app registration.

**Interfaces:**
- Consumes: Reviewed branch with green local and hosted checks.
- Produces: `rayselfs/hhc-presenter`, tag `v2.4.0`, complete release assets, and verified fresh installs.

- [ ] **Step 1: Open the PR and wait for exact-head CI**

Push the branch, open a PR to `main`, and wait for CI Quality Gates and Azure preview checks. Record
the reviewed PR head SHA; do not merge while any required check is pending or failed.

- [ ] **Step 2: Configure new OAuth redirect URIs**

Before release, add and verify:

```text
hhc-presenter://auth/account
hhc-presenter://auth/onedrive
```

Expected: both providers accept the exact production client IDs used by the packaged app.

- [ ] **Step 3: Merge only after review and green CI**

Merge the PR, then verify `origin/main` contains the reviewed commit and reports package version
`2.4.0`.

- [ ] **Step 4: Rename the existing GitHub repository**

```bash
gh repo rename hhc-presenter --repo rayselfs/libre-presenter --yes
git remote set-url origin git@github.com:rayselfs/hhc-presenter.git
git fetch origin
```

Expected: `gh repo view rayselfs/hhc-presenter` resolves, `origin` uses the new URL, and
`origin/main` equals the merged release commit.

- [ ] **Step 5: Tag the exact merged commit**

```bash
git tag -s v2.4.0 <merged-main-sha> -m "HHC Presenter v2.4.0"
git push origin v2.4.0
```

Expected: tag/package version equality gate passes and Build and Release starts from the exact merged
SHA. If signing keys are unavailable, stop and use the repository's approved tag procedure; do not
substitute an unsigned tag silently.

- [ ] **Step 6: Wait for the complete release workflow**

Require green quality, macOS arm64, Windows x64, runtime, packaged projection smoke, checksum, and
publish jobs. A green build without published assets is not release completion.

- [ ] **Step 7: Verify published release assets and updater manifests**

Require at least:

```text
hhc-presenter-2.4.0-setup.exe
hhc-presenter-2.4.0-setup.exe.blockmap
hhc-presenter-2.4.0.dmg
hhc-presenter-2.4.0.dmg.blockmap
hhc-presenter-2.4.0-arm64-mac.zip
hhc-presenter-2.4.0-arm64-mac.zip.blockmap
latest.yml
latest-mac.yml
SHA256SUMS
```

Verify every manifest path exists in the release and every SHA-256 checksum matches the downloaded
asset. Confirm `SHA256SUMS` contains exactly one entry for `hhc-presenter-2.4.0.dmg`; the macOS
manual downloader treats a missing or ambiguous entry as a hard failure.

- [ ] **Step 8: Fresh-install smoke on macOS and Windows**

For each platform:

1. Install from the published HHC Presenter asset.
2. Confirm OS name, executable/bundle, app ID, and protocol.
3. Confirm the app starts with empty files, folders, settings, and credentials.
4. Switch through English, Traditional Chinese, and Simplified Chinese names.
5. Open projection without content and verify the localized centered product name.
6. Complete Account and OneDrive OAuth callbacks.
7. Check updates and verify the HHC Presenter GitHub feed reports the installed `v2.4.0` as current.

Also inspect the packaged platform configuration:

- Windows retains `latest.yml`, automatic download, and manual installation. The focused tests are
  the `v2.4.0` evidence for download replacement and confirmation behavior.
- macOS retains `latest-mac.yml` for detection only. Verify the published DMG URL and
  `SHA256SUMS` URL used by `macUpdateDownloader.ts` both return the expected `v2.4.0` assets; do not
  claim a same-version manual download as cross-version update proof.

- [ ] **Step 9: Publish the new download link and close the release**

Use the canonical link:

```text
https://github.com/rayselfs/hhc-presenter/releases/tag/v2.4.0
```

State clearly that HHC Presenter is a fresh installation and begins with empty local data. On the
next normal release that already contains queued product fixes, include this installed-device
cross-version smoke in the release checklist:

- Windows: detect and automatically download the new version, decline once, confirm it remains ready,
  then install; if a later test release supersedes it before installation, verify the stale cached
  installer is removed and replaced.
- macOS: detect the new version, download only after the user action, verify progress and checksum, open the
  DMG, and verify both **Open Anyway** guidance and the non-executing `xattr` fallback.

Do not create a release only to test the updater. Do not report those live updater paths as verified
during `v2.4.0`, which cannot update to itself.
Update the primary checkout with `git pull --ff-only` only if it is clean. Remove only the clean
temporary worktree created for this task after merge, release, and fresh-install smoke are complete.
