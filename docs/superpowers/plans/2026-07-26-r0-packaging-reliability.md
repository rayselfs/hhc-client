# R0 Packaging Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject incomplete desktop packages, keep a damaged package bootable with VLC reported
unavailable, and run the real packaged projection lifecycle as a release gate.

**Architecture:** A source-tree native verifier and the existing packaged-runtime verifier form
fail-fast release boundaries. Main-process VLC integration loads `electron-vlc-player` through one
lazy adapter so a missing binding becomes a structured capability error instead of a bootstrap
crash. Release CI prepares native assets, verifies the package, then runs the packaged smoke.

**Tech Stack:** Electron 39, TypeScript, Node.js ESM scripts, Vitest, Playwright 1.59,
electron-builder 26, GitHub Actions

## Global Constraints

- Preserve `electron-vlc-player`; do not replace the player.
- Do not publish prebuilt native bindings from this repository.
- Do not change video playback UX or projection controls.
- A missing `vlc_binding.node` must fail desktop packaging before `electron-builder`.
- A damaged package must still open the main window and report VLC unavailable.
- A release-valid package must contain the native binding, VLC, FFmpeg, and license notices.
- Browser E2E and packaged Electron smoke remain separate gates.
- Add no runtime dependency.

---

### Task 1: Source Native Binding Gate

**Files:**
- Create: `scripts/check-desktop-native.mjs`
- Create: `src/main/__tests__/check-desktop-native.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run check:desktop-native`
- Requires:
  `node_modules/electron-vlc-player/build/Release/vlc_binding.node`

- [ ] **Step 1: Write the failing script tests**

Spawn the not-yet-created script in an empty temporary root and a root containing the expected
binding:

```ts
it('rejects a missing electron-vlc-player binding with rebuild guidance', async () => {
  const root = await createTempRoot()

  await expect(runChecker(root)).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining('electron-rebuild -f -w electron-vlc-player')
  })
})

it('accepts a compiled electron-vlc-player binding', async () => {
  const root = await createTempRoot()
  await writeFileIn(
    root,
    'node_modules/electron-vlc-player/build/Release/vlc_binding.node'
  )

  await expect(runChecker(root)).resolves.toBeUndefined()
})
```

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run src/main/__tests__/check-desktop-native.test.ts
```

Expected: script-not-found failure.

- [ ] **Step 3: Implement the minimal verifier**

Use `access()` against the exact binding path. On failure, print:

```text
Missing electron-vlc-player native binding: <absolute path>
Install the platform C++ toolchain, then run:
  npx electron-rebuild -f -w electron-vlc-player
Windows requires Visual Studio Build Tools with Desktop development with C++ and a Windows SDK.
```

Set `process.exitCode = 1`; otherwise print `ready: electron-vlc-player native binding`.

- [ ] **Step 4: Wire the package scripts**

Add:

```json
"check:desktop-native": "node scripts/check-desktop-native.mjs"
```

Run it after `npm run build` and before video-engine preparation in both `build:unpack` and
`package:desktop`.

- [ ] **Step 5: Run and verify GREEN**

```bash
npx vitest run src/main/__tests__/check-desktop-native.test.ts
npm run check:desktop-native
```

Expected: unit tests pass; the real repository command fails until the local native module is
compiled.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-desktop-native.mjs \
  src/main/__tests__/check-desktop-native.test.ts package.json
git commit -m "build: require VLC native binding"
```

---

### Task 2: Packaged Native Binding Gate

**Files:**
- Modify: `scripts/check-packaged-runtime.mjs`
- Modify: `src/main/__tests__/check-packaged-runtime.test.ts`

**Interfaces:**
- Consumes: unpacked resource roots discovered by `findResourceRoots()`
- Requires:
  `app.asar.unpacked/node_modules/electron-vlc-player/build/Release/vlc_binding.node`

- [ ] **Step 1: Add the binding to valid-package fixtures**

Update `writeValidMacPackage()` to create:

```ts
await writeFileIn(
  resourcesRoot,
  'app.asar.unpacked/node_modules/electron-vlc-player/build/Release/vlc_binding.node'
)
```

Add a test that removes this file and expects the checker to reject with code `1`.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run src/main/__tests__/check-packaged-runtime.test.ts
```

Expected: the missing-binding fixture is incorrectly accepted.

- [ ] **Step 3: Extend packaged verification**

Inside `checkResourceRoot()`, require the binding before checking platform runtimes:

```js
const nativeBinding =
  'app.asar.unpacked/node_modules/electron-vlc-player/build/Release/vlc_binding.node'
if (!(await exists(join(resourceRoot, nativeBinding)))) {
  failures.push(`Missing electron-vlc-player native binding: ${nativeBinding}`)
}
```

- [ ] **Step 4: Run and verify GREEN**

```bash
npx vitest run src/main/__tests__/check-packaged-runtime.test.ts
```

Expected: all packaged-runtime tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-packaged-runtime.mjs \
  src/main/__tests__/check-packaged-runtime.test.ts
git commit -m "build: verify packaged VLC binding"
```

---

### Task 3: Lazy VLC Native Adapter

**Files:**
- Create: `src/main/vlc-player-runtime.ts`
- Create: `src/main/__tests__/vlc-player-runtime.test.ts`
- Modify: `src/main/video-engine-runtime.ts`
- Modify: `src/main/__tests__/video-engine-runtime.test.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`

**Interfaces:**
- Produces:

```ts
export type VlcPlayerRuntime = typeof import('electron-vlc-player')

export type VlcPlayerRuntimeResult =
  | { status: 'ready'; runtime: VlcPlayerRuntime }
  | { status: 'error'; message: string }

export function loadVlcPlayerRuntime(): Promise<VlcPlayerRuntimeResult>
```

- Changes:

```ts
export function resolveVlcRuntime(
  probeDefaultVlcDir?: () => string | null
): VideoEngineRuntimeInfo
```

- [ ] **Step 1: Write failing lazy-loader tests**

Mock an injected loader by exposing a test-only reset and loader setter only from the test module
boundary:

```ts
it('converts a missing native binding into a structured error', async () => {
  setVlcPlayerRuntimeLoaderForTests(async () => {
    throw new Error('Cannot find module vlc_binding.node')
  })

  await expect(loadVlcPlayerRuntime()).resolves.toEqual({
    status: 'error',
    message: 'VLC native binding unavailable: Cannot find module vlc_binding.node'
  })
})
```

Also assert module import alone does not invoke the loader and successful loads are cached.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run src/main/__tests__/vlc-player-runtime.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the lazy loader**

Keep a single cached promise. The default loader is:

```ts
() => import('electron-vlc-player')
```

Convert unknown failures to one stable operator-facing message. Export
`resetVlcPlayerRuntimeForTests()` and `setVlcPlayerRuntimeLoaderForTests()` only from this internal
main-process module; production callers use only `loadVlcPlayerRuntime()`.

- [ ] **Step 4: Remove the eager runtime probe import**

Delete the static `probeDefaultVlcDir` import from `video-engine-runtime.ts`. In development, call
the optional probe only when supplied:

```ts
const system = probeDefaultVlcDir?.() ?? null
```

Update tests to pass `mockProbeDefaultVlcDir` explicitly.

- [ ] **Step 5: Write the failing IPC fallback test**

Mock `loadVlcPlayerRuntime()` to return an error, register handlers, and assert:

```ts
await expect(getHandler('projection-vlc:get-info')(makeEvent())).resolves.toEqual({
  status: 'error',
  message: 'VLC native binding unavailable: missing binding'
})
```

Assert registering the handlers did not construct or load `VlcPlayer`.

- [ ] **Step 6: Make VLC IPC handlers load on demand**

Remove the static runtime import. Make `getVlcInfo`, probe, and start obtain the runtime result
first. Store the successfully loaded module for player cleanup/control helpers. The `get-info` and
`probe` IPC handlers become async; their shared result types already flow through
`ipcMain.handle`.

- [ ] **Step 7: Run and verify GREEN**

```bash
npx vitest run src/main/__tests__/vlc-player-runtime.test.ts \
  src/main/__tests__/video-engine-runtime.test.ts \
  src/main/__tests__/ipc/projection-vlc.test.ts
npm run typecheck:node
```

Expected: all focused main-process tests and node typecheck pass.

- [ ] **Step 8: Commit**

```bash
git add src/main/vlc-player-runtime.ts src/main/video-engine-runtime.ts \
  src/main/ipc/projection-vlc.ts src/main/__tests__/vlc-player-runtime.test.ts \
  src/main/__tests__/video-engine-runtime.test.ts \
  src/main/__tests__/ipc/projection-vlc.test.ts
git commit -m "fix: load VLC native runtime on demand"
```

---

### Task 4: Complete Browser and Packaged CI Gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/build-release.yml`
- Modify: `e2e/electron-packaged.spec.ts`
- Modify: `playwright.electron.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `test:e2e:browser`, `test:e2e:packaged`, `PACKAGED_APP_PATH`
- Produces: browser PR gate and Windows/macOS packaged release smoke

- [ ] **Step 1: Remove diagnostic logging from packaged smoke**

Keep named `test.step()` boundaries and the explicit `electron.launch()` timeout, but remove
temporary `console.log()` calls. Preserve isolated `--user-data-dir`, timer payload assertions,
passive tick wait, and `afterEach` close.

- [ ] **Step 2: Add browser E2E to PR CI**

After production build in `ci.yml`:

```yaml
- name: Install Playwright Chromium
  run: npx playwright install --with-deps chromium

- name: Browser projection E2E
  run: npm run test:e2e:browser
```

- [ ] **Step 3: Add native and packaged smoke release gates**

In the release matrix add exact executable paths:

```yaml
smoke_executable: dist/mac-arm64/LibrePresenter.app/Contents/MacOS/LibrePresenter
```

and:

```yaml
smoke_executable: dist/win-unpacked/libre-presenter.exe
```

After runtime verification:

```yaml
- name: Packaged projection smoke
  env:
    PACKAGED_APP_PATH: ${{ matrix.smoke_executable }}
  run: npm run test:e2e:packaged
```

The existing package script runs `check:desktop-native` before `electron-builder`, while
`check:packaged-runtime` verifies the output before smoke.

- [ ] **Step 4: Validate test discovery and workflow formatting**

```bash
npx playwright test --config playwright.electron.config.ts --list
npx prettier --check .github/workflows/ci.yml .github/workflows/build-release.yml
npm run typecheck
```

Expected: exactly one packaged smoke is listed and all commands pass.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/build-release.yml \
  e2e/electron-packaged.spec.ts playwright.electron.config.ts package.json
git commit -m "ci: enforce packaged projection smoke"
```

---

### Task 5: Prepare and Verify a Real Windows Package

**Files:**
- Modify only generated/ignored local runtime and package artifacts

**Interfaces:**
- Requires: Visual Studio Build Tools with Desktop development with C++ and Windows SDK
- Requires:
  `.local-runtimes/vlc/win32-x64/libvlc.dll`
  and `.local-runtimes/ffmpeg/win32-x64/ffmpeg.exe`
- Produces: a locally verified `dist/win-unpacked/libre-presenter.exe`

- [ ] **Step 1: Install the Windows native toolchain if absent**

Use Windows Package Manager with the C++ workload:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact `
  --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Verify `vswhere.exe` reports an installation containing
`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`.

- [ ] **Step 2: Rebuild the native dependency**

```bash
npx electron-rebuild -f -w electron-vlc-player
npm run check:desktop-native
```

Expected: `vlc_binding.node` exists and the native gate passes.

- [ ] **Step 3: Prepare video-engine source runtimes**

Use the repository download script with the configured Windows VLC and FFmpeg release URLs and
SHA-256 values:

```bash
node scripts/download-video-engine-runtime.mjs \
  --component=vlc --platform=win32 --arch=x64 --url="$VLC_URL" --sha256="$VLC_SHA256"
node scripts/download-video-engine-runtime.mjs \
  --component=ffmpeg --platform=win32 --arch=x64 --url="$FFMPEG_URL" --sha256="$FFMPEG_SHA256"
```

Verify the exact required files under `.local-runtimes`.

- [ ] **Step 4: Build and validate the unpacked package**

```bash
npm run build:unpack
npm run check:packaged-runtime
```

Expected: both commands pass and the packaged binding is in `app.asar.unpacked`.

- [ ] **Step 5: Run the packaged smoke**

```powershell
$env:PACKAGED_APP_PATH =
  "C:\Users\IT\Projects\hhc-client\dist\win-unpacked\libre-presenter.exe"
npm run test:e2e:packaged
```

Expected: control/projection Timer smoke passes and leaves no LibrePresenter process running.

---

### Task 6: Close R0 With Evidence

**Files:**
- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`

**Interfaces:**
- Produces: R0 status `Complete` only after all local and workflow gates are present

- [ ] **Step 1: Run focused and production gates**

```bash
npx vitest run src/main/__tests__/check-desktop-native.test.ts \
  src/main/__tests__/check-packaged-runtime.test.ts \
  src/main/__tests__/vlc-player-runtime.test.ts \
  src/main/__tests__/video-engine-runtime.test.ts \
  src/main/__tests__/ipc/projection-vlc.test.ts
npm run typecheck
npm run test:e2e:browser
npm run check:desktop-native
npm run check:packaged-runtime
npm run test:e2e:packaged
```

- [ ] **Step 2: Update roadmap evidence**

Mark browser E2E and packaged Electron smoke complete. Record the native binding/runtime failure
guards and the successful Windows executable smoke. Change R0 table status to `Complete`.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap/librepresenter-optimization-roadmap.md
git commit -m "docs: complete R0 reliability gates"
```
