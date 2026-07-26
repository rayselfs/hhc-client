# R0 Browser and Packaged Projection Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make projection start, payload delivery, passive Timer updates, and application close
executable quality gates in browser PR CI and packaged Windows/macOS release CI.

**Architecture:** Browser E2E serves the already-built `out/renderer` bundle and exercises the real
BroadcastChannel popup path in Chromium. Packaged smoke launches the unpacked desktop executable
through Playwright Electron, exercises the real preload/IPC dual-window path, and receives the
executable path from release CI rather than guessing inside the test.

**Tech Stack:** Playwright 1.59, Chromium, Playwright Electron, Vite preview, GitHub Actions,
electron-builder.

## Global Constraints

- Keep Electron and browser projection behavior on their real adapters; do not add test-only
  production IPC or renderer branches.
- Add no dependencies.
- Browser PR E2E runs after the production bundle is built.
- Packaged smoke runs against `dist/win-unpacked/libre-presenter.exe` on Windows and the unpacked
  `LibrePresenter.app` executable on macOS.
- Smoke must verify control window, projection start, payload delivery, passive Timer continuity,
  and clean application close.
- Keep Playwright artifacts on failure.

---

### Task 1: Browser projection E2E

**Files:**
- Create: `vite.web.config.ts`
- Create: `e2e/browser-projection.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: built renderer at `out/renderer`, Timer `data-testid="btn-start"`, web
  `BroadcastChannel('hhc-projection')`
- Produces: `npm run test:e2e:browser`

- [ ] **Step 1: Write the failing browser E2E**

Create `e2e/browser-projection.spec.ts` with one test that:

1. opens `/`;
2. records any main-page `window.focus()` calls through `page.addInitScript`;
3. clicks `btn-start` while awaiting the popup page;
4. verifies the popup URL ends in `#/projection`;
5. verifies a Timer digit is visible;
6. waits past one Timer tick;
7. verifies there is still exactly one projection popup and no focus call;
8. closes the control page and verifies the popup closes.

Use:

```ts
await page.addInitScript(() => {
  Object.defineProperty(window, '__projectionFocusCalls', {
    value: 0,
    writable: true
  })
  window.focus = () => {
    window.__projectionFocusCalls += 1
  }
})
```

Add the matching declaration inside the test file:

```ts
declare global {
  interface Window {
    __projectionFocusCalls: number
  }
}
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run build
npx playwright test e2e/browser-projection.spec.ts
```

Expected: FAIL because there is no preview web server configuration and no E2E file wiring.

- [ ] **Step 3: Add the production-bundle preview boundary**

Create `vite.web.config.ts`:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'out/renderer'
  },
  preview: {
    host: '127.0.0.1',
    port: 5173
  }
})
```

Add:

```json
"preview:web": "vite preview --config vite.web.config.ts",
"test:e2e:browser": "playwright test --project=chromium"
```

Configure Playwright with:

```ts
webServer: {
  command: 'npm run preview:web',
  url: 'http://127.0.0.1:5173',
  reuseExistingServer: !process.env.CI
}
```

and change `baseURL` to `http://127.0.0.1:5173`.

- [ ] **Step 4: Run and verify GREEN**

Run:

```bash
npm run test:e2e:browser
```

Expected: one Chromium projection test passes.

- [ ] **Step 5: Commit**

```bash
git add vite.web.config.ts e2e/browser-projection.spec.ts playwright.config.ts package.json
git commit -m "test: add browser projection e2e gate"
```

### Task 2: Packaged Electron projection smoke

**Files:**
- Create: `e2e/electron-packaged.spec.ts`
- Create: `playwright.electron.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PACKAGED_APP_PATH`
- Produces: `npm run test:e2e:packaged`

- [ ] **Step 1: Write the failing packaged smoke**

Create `e2e/electron-packaged.spec.ts`. Reject a missing `PACKAGED_APP_PATH` before launch. Launch:

```ts
electronApp = await electron.launch({
  executablePath: packagedAppPath,
  args: [`--user-data-dir=${test.info().outputPath('user-data')}`]
})
```

Then verify:

```ts
const control = await electronApp.firstWindow()
await expect(control).toHaveTitle(/LibrePresenter/)
await control.getByTestId('btn-start').click()

await expect
  .poll(() => electronApp.windows().length)
  .toBe(2)

const projection = electronApp.windows().find((window) =>
  window.url().endsWith('#/projection')
)
expect(projection).toBeDefined()
await expect(projection!.locator('.timer-digits').first()).toBeVisible()

await projection!.waitForTimeout(1200)
expect(electronApp.windows()).toHaveLength(2)
```

Close the Electron application in `afterEach`.

- [ ] **Step 2: Run and verify RED without a package**

Run:

```bash
npm run test:e2e:packaged
```

Expected: FAIL with `PACKAGED_APP_PATH is required`.

- [ ] **Step 3: Add isolated Electron Playwright configuration**

Create `playwright.electron.config.ts` with `testMatch: 'electron-packaged.spec.ts'`, one worker,
HTML output under `playwright-report/electron`, trace on first retry, and screenshots on failure.

Add:

```json
"test:e2e:packaged": "playwright test --config playwright.electron.config.ts"
```

- [ ] **Step 4: Type-check the smoke contract**

Run:

```bash
npm run typecheck
npx playwright test --config playwright.electron.config.ts --list
```

Expected: type checks pass and exactly one packaged smoke test is listed.

- [ ] **Step 5: Commit**

```bash
git add e2e/electron-packaged.spec.ts playwright.electron.config.ts package.json
git commit -m "test: add packaged projection smoke"
```

### Task 3: CI wiring and R0 completion

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/build-release.yml`
- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`

**Interfaces:**
- Consumes: `test:e2e:browser`, `test:e2e:packaged`
- Produces: required browser PR gate and per-platform packaged release smoke

- [ ] **Step 1: Add browser PR gate**

After `npm run build` in `ci.yml`, add:

```yaml
- name: Install Playwright Chromium
  run: npx playwright install --with-deps chromium

- name: Browser projection E2E
  run: npm run test:e2e:browser
```

- [ ] **Step 2: Add packaged smoke to release matrix**

Extend the package matrix:

```yaml
- os: macos-14
  target: --mac
  artifact: macos
  smoke_executable: dist/mac-arm64/LibrePresenter.app/Contents/MacOS/LibrePresenter
- os: windows-2025
  target: --win
  artifact: windows
  smoke_executable: dist/win-unpacked/libre-presenter.exe
```

After packaged-runtime verification, add:

```yaml
- name: Packaged projection smoke
  env:
    PACKAGED_APP_PATH: ${{ matrix.smoke_executable }}
  run: npm run test:e2e:packaged
```

- [ ] **Step 3: Validate YAML and runnable test discovery**

Run:

```bash
npx prettier --check .github/workflows/ci.yml .github/workflows/build-release.yml
npx playwright test --config playwright.electron.config.ts --list
npm run typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 4: Complete R0 roadmap status**

Mark both remaining R0 progress items complete and change the roadmap table status for R0 to
`Complete`. Record the browser test and packaged smoke commands as evidence, while stating that
actual Windows/macOS packaged execution is enforced by release CI.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/build-release.yml \
  docs/roadmap/librepresenter-optimization-roadmap.md
git commit -m "ci: enforce projection lifecycle gates"
```

## Self-review

- Spec coverage: browser PR E2E and packaged Windows/macOS smoke both have executable tests and
  workflow steps; projection start, payload, passive tick, and close are covered.
- Placeholder scan: no deferred implementation or undefined helper remains.
- Type consistency: both scripts match package names used by the workflows; the release matrix
  supplies the only environment variable required by the packaged test.
