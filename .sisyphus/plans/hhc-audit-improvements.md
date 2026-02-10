# HHC Client: Comprehensive Security Audit & Code Quality Improvement Plan

## TL;DR

> **Quick Summary**: Fix critical security vulnerabilities (XSS, path traversal, IPC), establish test infrastructure with TDD workflow, add CI quality gates, then systematically improve TypeScript strictness, error handling, code structure, accessibility, and CSS maintainability across the entire HHC Client codebase.
>
> **Deliverables**:
>
> - All 5 security vulnerabilities patched with exploit verification tests
> - Test infrastructure (Vitest) with initial test suite for critical modules
> - CI pipeline with quality gates (lint, type-check, test, build)
> - TypeScript strict mode enabled incrementally
> - Error handling standardized to Sentry across codebase
> - Large files refactored below size limits (500L components, 400L composables)
> - Production build hardened (no devtools, sourcemaps for Sentry)
> - WCAG 2.1 Level AA accessibility improvements
> - CSS variables migration, !important audit
> - Route lazy loading
>
> **Estimated Effort**: XL (4-6 weeks)
> **Parallel Execution**: YES — 6 waves
> **Critical Path**: Task 1 (Test Infra) → Task 3 (CI Gates) → Task 5 (TS Strict) → Task 8-11 (Refactoring)

---

## Context

### Original Request

User requested a thorough analysis of the HHC Client project, identifying all areas for improvement, optimization issues, and a prioritized action plan. (Original: "幫我詳細分析此專案，列出可以需要改善優化的狀況，或是issue，並寫下plan")

### Interview Summary

**Key Discussions**:

- **Priority**: Security First — fix vulnerabilities before all other work
- **Test Strategy**: TDD (Red-Green-Refactor) for all improvement tasks
- **Scope**: Full comprehensive plan covering ALL 10 issue categories
- **Plan Format**: Parallel execution waves with dependency ordering

**Research Findings**:

- 4 parallel background agents analyzed: code quality, architecture, test/CI/build, and components/UI/a11y
- **Zero test files exist** despite vitest being configured
- **5 security vulnerabilities identified** (XSS, path traversal, postMessage wildcard, ffmpeg path injection, bypassCSP)
- **50+ `any` usages** across 20+ files with no explicit `strict: true`
- **7 Vue components >400 lines**, 2 composables >500 lines, 2 stores >700 lines
- **CI only builds and publishes** — no tests, lint, or type-check in pipeline
- **vue-devtools ships in production** builds
- **No production sourcemaps** for Sentry error mapping
- **Sentry version mismatch**: @sentry/electron ^7.2.0 vs @sentry/vue ^10.20.0
- **33+ `!important`** in CSS, hardcoded colors alongside CSS variables
- **Minimal ARIA** on custom components, no route lazy loading

### Metis Review

**Identified Gaps** (addressed):

- Security fixes may break production (projection window IPC) → Applied: batch with tests, not hotfix
- Characterization tests needed before refactoring → Applied: write characterization tests first (Option A)
- TypeScript strict mode blast radius (100+ errors) → Applied: incremental per-directory rollout
- CSS !important removal could break Vuetify overrides → Applied: audit each, keep legitimate overrides
- CI coverage threshold could block progress on old code → Applied: differential coverage (changed files only)
- postMessage origin lockdown needs dev flexibility → Applied: environment variable for dev port
- v-html XSS fix must allow legitimate HTML tags → Applied: DOMPurify with whitelist
- Missing staging environment concern → Applied: deploy waves separately with testing between
- Router guards unnecessary for desktop Electron app → Applied: lazy loading only, no auth guards

---

## Work Objectives

### Core Objective

Systematically harden security, establish automated quality gates, and improve code maintainability across the entire HHC Client codebase while maintaining zero regressions through TDD practices.

### Concrete Deliverables

- 5 security vulnerabilities patched with verification tests
- Vitest test suite with initial coverage for stores, composables, and electron services
- GitHub Actions CI workflow with lint/type-check/test/build gates
- Pre-commit hooks (Husky + lint-staged)
- TypeScript strict mode enabled incrementally across all files
- Standardized error handling (Sentry `reportError` everywhere)
- 11 large files refactored below size limits
- Production build without devtools, with Sentry sourcemaps
- WCAG 2.1 Level AA accessibility improvements on custom components
- CSS variables migration with !important audit
- Route lazy loading for projection view

### Definition of Done

- [ ] `npm run test:unit` passes with >60% coverage on changed files
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run type-check` passes (vue-tsc)
- [ ] `npm run build` succeeds for all targets
- [ ] No `v-html` without DOMPurify sanitization
- [ ] No `bypassCSP: true` in production
- [ ] No `postMessage('*')` wildcard origins
- [ ] All `any` usages documented or eliminated
- [ ] All error catches use `reportError()` (not bare `console.error`)

### Must Have

- All 5 security vulnerabilities patched
- Test infrastructure operational with CI integration
- TypeScript strict mode enabled (incremental OK)
- Standardized error handling pattern
- Production build hardened

### Must NOT Have (Guardrails)

- **No new features** during this audit — only fixes and improvements
- **No technology swaps** — keep Vuetify, Pinia, Vue Router, Electron stack as-is
- **No full component rewrites** — refactor incrementally, preserve external APIs (props/events/exposed)
- **No premature abstraction** — extract composables only when file exceeds size limit
- **No "while we're here" scope creep** — if a tangential issue is found, log it but don't fix it
- **No IPC message format changes** without updating both windows — MessageType enum must stay backward-compatible
- **No database schema changes** — IndexedDB structure stays as-is
- **No dependency major version upgrades** except Sentry (which has version mismatch)

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional — it applies to EVERY task, regardless of test strategy.
>
> **FORBIDDEN** — acceptance criteria that require:
>
> - "User manually tests..." / "使用者手動測試..."
> - "User visually confirms..." / "使用者目視確認..."
> - "User interacts with..." / "使用者互動..."
> - ANY step where a human must perform an action
>
> **ALL verification is executed by the agent** using tools (Playwright, interactive_bash, curl, etc.). No exceptions.

### Test Decision

- **Infrastructure exists**: YES (vitest in devDependencies, test script configured) — but ZERO test files
- **Automated tests**: TDD (Red-Green-Refactor) for all improvement tasks
- **Framework**: Vitest + @vue/test-utils + jsdom

### TDD Workflow Per Task

Each TODO follows RED-GREEN-REFACTOR:

1. **RED**: Write failing test first
   - Test file: `src/**/__tests__/*.test.ts` or `test/electron/*.test.ts`
   - Test command: `npx vitest run [file]`
   - Expected: FAIL (test exists, implementation doesn't)
2. **GREEN**: Implement minimum code to pass
   - Command: `npx vitest run [file]`
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green
   - Command: `npx vitest run [file]`
   - Expected: PASS (still)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type                    | Tool                                 | How Agent Verifies                                      |
| ----------------------- | ------------------------------------ | ------------------------------------------------------- |
| **Security fixes**      | Bash (grep, curl) + Playwright       | Exploit test before/after, assert vulnerability patched |
| **Test infrastructure** | Bash (npx vitest)                    | Run tests, verify pass/fail counts                      |
| **CI pipeline**         | Bash (act or gh workflow view)       | Trigger workflow, check status                          |
| **TypeScript**          | Bash (npx tsc --noEmit)              | Type-check specific files, assert zero errors           |
| **Refactoring**         | Bash (wc -l) + vitest                | Line count below limit + all tests pass                 |
| **Accessibility**       | Playwright + axe-core                | Navigate, check ARIA, run axe scan                      |
| **CSS**                 | Bash (grep) + Playwright screenshots | No !important violations, visual baseline match         |
| **Build**               | Bash (npm run build)                 | Build succeeds, artifacts exist                         |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Foundation):
├── Task 1: Test Infrastructure Setup [no dependencies]
└── Task 2: Security Hardening (5 vulnerabilities) [no dependencies]

Wave 2 (After Wave 1):
├── Task 3: CI Quality Gates [depends: 1]
├── Task 4: Pre-commit Hooks [depends: 1]
└── Task 5: TypeScript Strict Mode (Phase 1 — security files) [depends: 2]

Wave 3 (After Wave 2):
├── Task 6: Error Handling Standardization [depends: 3]
├── Task 7: Sentry Version Alignment + Sourcemaps [depends: 3]
└── Task 8: Build Hardening (devtools, sourcemaps) [depends: 3]

Wave 4 (After Wave 3):
├── Task 9: Refactor Large Stores (folder.ts, bible.ts, timer.ts) [depends: 5, 6]
├── Task 10: Refactor Large Composables (useMediaOperations, useElectron) [depends: 5, 6]
└── Task 11: TypeScript Strict Mode (Phase 2 — remaining files) [depends: 5]

Wave 5 (After Wave 4):
├── Task 12: Refactor Large Vue Components (Control.vue, MediaPresenter, BibleControl) [depends: 9, 10]
└── Task 13: Router Lazy Loading [depends: 3]

Wave 6 (After Wave 5):
├── Task 14: Accessibility Improvements (WCAG 2.1 AA) [depends: 12]
└── Task 15: CSS Audit & Variables Migration [depends: 12]

Critical Path: Task 1 → Task 3 → Task 5 → Task 9 → Task 12 → Task 14
Parallel Speedup: ~45% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks      | Can Parallelize With |
| ---- | ---------- | ----------- | -------------------- |
| 1    | None       | 3, 4, 5     | 2                    |
| 2    | None       | 5           | 1                    |
| 3    | 1          | 6, 7, 8, 13 | 4, 5                 |
| 4    | 1          | None        | 3, 5                 |
| 5    | 2          | 9, 10, 11   | 3, 4                 |
| 6    | 3          | 9, 10       | 7, 8                 |
| 7    | 3          | None        | 6, 8                 |
| 8    | 3          | None        | 6, 7                 |
| 9    | 5, 6       | 12          | 10, 11               |
| 10   | 5, 6       | 12          | 9, 11                |
| 11   | 5          | None        | 9, 10                |
| 12   | 9, 10      | 14, 15      | 13                   |
| 13   | 3          | None        | 9-12, 14, 15         |
| 14   | 12         | None        | 15                   |
| 15   | 12         | None        | 14                   |

### Agent Dispatch Summary

| Wave | Tasks     | Recommended Agents                                                        |
| ---- | --------- | ------------------------------------------------------------------------- |
| 1    | 1, 2      | task(category="unspecified-high") — foundational setup                    |
| 2    | 3, 4, 5   | task(category="quick") for 3,4; task(category="unspecified-high") for 5   |
| 3    | 6, 7, 8   | task(category="unspecified-low") — config & pattern changes               |
| 4    | 9, 10, 11 | task(category="deep") — complex refactoring                               |
| 5    | 12, 13    | task(category="visual-engineering") for 12; task(category="quick") for 13 |
| 6    | 14, 15    | task(category="visual-engineering") — UI/a11y focus                       |

---

## TODOs

---

- [x] 1. Test Infrastructure Setup

  **What to do**:
  - Verify vitest configuration works (`npm run test:unit` exits cleanly even with no tests)
  - Create test directory structure: `src/stores/__tests__/`, `src/composables/__tests__/`, `test/electron/`
  - Install `@pinia/testing` as devDependency: `npm i -D @pinia/testing` (required for `createTestingPinia()`)
  - Write first example test: `src/stores/__tests__/timer.test.ts` with 1 passing test that verifies timer store can be instantiated with `createTestingPinia()`
  - Write first electron test: `test/electron/timerService.test.ts` with fake timers and mocked BrowserWindow
  - Configure test setup file for mocking `window.electronAPI` globally
  - Verify: `npm run test:unit` runs and passes with ≥2 test files

  **Must NOT do**:
  - Don't write comprehensive test suites yet — just infrastructure + example tests
  - Don't change any production code
  - Don't add test dependencies beyond what's in devDependencies (vitest, @vue/test-utils already present) **except** `@pinia/testing` which must be installed for `createTestingPinia()`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Test infrastructure setup is foundational work requiring careful configuration
  - **Skills**: []
    - No specialized skills needed — standard TypeScript/Vitest work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `package.json` — devDependencies section: vitest, @vue/test-utils already installed; test:unit script defined as "vitest"
  - `src/stores/timer.ts:1-30` — Timer store setup pattern (defineStore with setup function) — use as model for test target
  - `electron/timerService.ts:1-50` — TimerService class with BrowserWindow dependency — needs mock pattern

  **API/Type References**:
  - `src/types/electron.d.ts` — Full typing for `window.electronAPI` interface — mock this shape in test setup
  - `src/types/common.ts` — MessageType enum, TimerMode, TimerStatus types used in timer tests

  **Documentation References**:
  - AGENTS.md section "Testing" — `npm run test:unit`, `npx vitest run src/stores/timer.test.ts` patterns documented

  **External References**:
  - Vitest docs: https://vitest.dev/guide/ — test configuration and setup files
  - @vue/test-utils: https://test-utils.vuejs.org/ — Pinia testing with createTestingPinia

  **WHY Each Reference Matters**:
  - `package.json` — confirms vitest is installed; `@pinia/testing` must be added for `createTestingPinia()`
  - `timer.ts` — this is the first store to test; understand its shape to write meaningful example test
  - `electron.d.ts` — mock shape must match this interface exactly for test setup file
  - `timerService.ts` — electron-side service needs different mock strategy (BrowserWindow stub)

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test setup file exists at `src/__tests__/setup.ts` or `test/setup.ts`
  - [ ] `window.electronAPI` is globally mocked in setup file
  - [ ] `src/stores/__tests__/timer.test.ts` exists with ≥1 passing test
  - [ ] `test/electron/timerService.test.ts` exists with ≥1 passing test using `vi.useFakeTimers()`
  - [ ] `npx vitest run` → PASS (all tests pass, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Vitest runs and discovers test files
    Tool: Bash
    Preconditions: Repository cloned, dependencies installed
    Steps:
      1. Run: npx vitest run --reporter=verbose 2>&1
      2. Assert: exit code is 0
      3. Assert: stdout contains "Tests" and a count ≥ 2
      4. Assert: stdout contains "timer.test.ts"
      5. Assert: stdout contains "timerService.test.ts"
    Expected Result: All test files discovered and pass
    Evidence: Terminal output captured

  Scenario: Test setup correctly mocks electronAPI
    Tool: Bash
    Preconditions: Test files created
    Steps:
      1. Run: npx vitest run src/stores/__tests__/timer.test.ts --reporter=verbose 2>&1
      2. Assert: exit code is 0
      3. Assert: no "window.electronAPI is undefined" errors in output
      4. Assert: stdout contains "PASS" or "✓"
    Expected Result: Timer store tests pass with mocked electronAPI
    Evidence: Terminal output captured
  ```

  **Evidence to Capture:**
  - [ ] Terminal output of `npx vitest run --reporter=verbose`

  **Commit**: YES
  - Message: `test: add test infrastructure with vitest setup and initial timer tests`
  - Files: `src/__tests__/setup.ts`, `src/stores/__tests__/timer.test.ts`, `test/electron/timerService.test.ts`, `vitest.config.ts` (if modified)
  - Pre-commit: `npx vitest run`

---

- [x] 2. Security Hardening (5 Vulnerabilities)

  **What to do**:

  **2a. XSS: Sanitize v-html in BibleControl.vue**
  - Install DOMPurify: `npm install dompurify` and `npm install -D @types/dompurify`
  - Create utility: `src/utils/sanitize.ts` exporting `sanitizeHTML(html: string): string` using DOMPurify with whitelist `{ ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'span', 'p', 'div', 'sup', 'sub'], ALLOWED_ATTR: ['class', 'style'] }`
  - Write test: `src/utils/__tests__/sanitize.test.ts` — test that `<script>`, `<iframe>`, `onerror=` are stripped; `<br>`, `<b>`, `<i>` are preserved
  - Replace `v-html="unsanitizedContent"` with `v-html="sanitizeHTML(content)"` in `src/layouts/control/BibleControl.vue` (around line 92)
  - Search for any other `v-html` or `innerHTML` usage across codebase and sanitize

  **2b. Path Traversal: Restrict local-resource protocol handler**
  - In `electron/file.ts`, modify `registerFileProtocols` handler:
    - After resolving filePath, call `fs.realpathSync(filePath)`
    - Check that realpath starts with allowed base directories: `app.getPath('userData')` and app resources path
    - Return 403 error for paths outside allowed directories
  - Write test: `test/electron/__tests__/fileProtocol.test.ts` — test that symlinks outside userData are blocked, `..` paths are blocked, absolute paths to system files are blocked

  **2c. postMessage: Lock down origin**
  - In `src/composables/useElectron.ts` (useProjectionElectron section around line 562):
    - Replace `window.opener.postMessage(data, '*')` with `window.opener.postMessage(data, window.location.origin)`
    - Add origin check in message listener: `if (event.origin !== window.location.origin) return`
  - Write test verifying origin is checked

  **2d. FFmpeg path validation**
  - In `electron/file.ts` or wherever `ffmpegSetPath` is handled:
    - Validate path with `fs.existsSync()` and `fs.accessSync(path, fs.constants.X_OK)`
    - Reject paths containing suspicious characters or pointing to non-executable files
  - Write test for path validation

  **2e. Remove bypassCSP**
  - In `electron/main.ts`, change `protocol.registerSchemesAsPrivileged` to remove `bypassCSP: true`
  - Test that the app still works without CSP bypass (local-resource protocol may need nonce or hash)
  - If inline styles from Vuetify break, add `style-src 'unsafe-inline'` as temporary measure and document for future CSP tightening

  **Must NOT do**:
  - Don't change Bible text rendering logic beyond sanitization
  - Don't change IPC message formats
  - Don't change file system API surface (just add validation)
  - Don't remove the local-resource protocol — just restrict it

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Security fixes require careful analysis of attack surfaces and precise implementation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/layouts/control/BibleControl.vue:~92` — Location of `v-html` usage (XSS vector)
  - `electron/file.ts` — `registerFileProtocols` function implementing `local-resource` protocol handler; contains the path traversal vulnerability (only blocks `..` but not symlinks/absolute paths)
  - `electron/file.ts` — `delete-file` and `copy-file` handlers have proper `normalizedUserDataPath.startsWith` checks — use this pattern for local-resource
  - `src/composables/useElectron.ts:~562` — `window.opener.postMessage(data, '*')` wildcard origin in useProjectionElectron
  - `electron/main.ts` — `protocol.registerSchemesAsPrivileged` call with `bypassCSP: true`

  **API/Type References**:
  - `src/types/electron.d.ts` — `ffmpegSetPath` and `ffmpegProbePath` type definitions
  - `electron/handlers.ts` — IPC handler registrations for ffmpeg operations

  **Documentation References**:
  - AGENTS.md — "IPC Communication" section documents send/on/invoke patterns

  **External References**:
  - DOMPurify: https://github.com/cure53/DOMPurify — HTML sanitization library
  - Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security

  **WHY Each Reference Matters**:
  - `BibleControl.vue:92` — exact location of XSS vector to fix
  - `electron/file.ts` — contains both the vulnerability AND the pattern for proper path validation (copy from delete-file handler)
  - `useElectron.ts:562` — exact location of postMessage wildcard
  - `electron/main.ts` — where bypassCSP is set

  **Acceptance Criteria**:

  **TDD:**
  - [ ] `src/utils/__tests__/sanitize.test.ts` — PASS (strips script/iframe, preserves br/b/i)
  - [ ] `test/electron/__tests__/fileProtocol.test.ts` — PASS (blocks symlinks, .., absolute paths outside userData)
  - [ ] `npx vitest run` → PASS (all security tests pass)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: v-html XSS vector is sanitized
    Tool: Bash (grep + ast_grep_search)
    Preconditions: Code changes applied
    Steps:
      1. Run: grep -rn 'v-html' src/ --include='*.vue'
      2. Assert: every v-html usage references sanitizeHTML() or DOMPurify
      3. Run: grep -rn 'innerHTML' src/ --include='*.vue' --include='*.ts'
      4. Assert: no unsanitized innerHTML assignments
    Expected Result: All v-html/innerHTML sanitized
    Evidence: Grep output captured

  Scenario: DOMPurify strips dangerous tags but preserves safe ones
    Tool: Bash (npx vitest)
    Preconditions: sanitize.test.ts written
    Steps:
      1. Run: npx vitest run src/utils/__tests__/sanitize.test.ts --reporter=verbose
      2. Assert: test "strips <script> tags" passes
      3. Assert: test "strips <iframe> tags" passes
      4. Assert: test "strips onerror attributes" passes
      5. Assert: test "preserves <br> tags" passes
      6. Assert: test "preserves <b> and <i> tags" passes
    Expected Result: All sanitization tests pass
    Evidence: Terminal output captured

  Scenario: Path traversal via symlinks is blocked
    Tool: Bash (npx vitest)
    Preconditions: fileProtocol.test.ts written
    Steps:
      1. Run: npx vitest run test/electron/__tests__/fileProtocol.test.ts --reporter=verbose
      2. Assert: test "blocks paths outside userData" passes
      3. Assert: test "blocks symlinks to system files" passes
      4. Assert: test "allows paths within userData" passes
    Expected Result: Path traversal tests pass
    Evidence: Terminal output captured

  Scenario: postMessage no longer uses wildcard origin
    Tool: Bash (grep)
    Preconditions: Code changes applied
    Steps:
      1. Run: grep -rn "postMessage.*'\\*'" src/ --include='*.ts' --include='*.vue'
      2. Assert: zero matches (no wildcard origins remain)
      3. Run: grep -rn 'postMessage' src/ --include='*.ts'
      4. Assert: all postMessage calls specify explicit origin
    Expected Result: No wildcard postMessage origins
    Evidence: Grep output captured

  Scenario: bypassCSP is removed from production
    Tool: Bash (grep)
    Preconditions: Code changes applied
    Steps:
      1. Run: grep -rn 'bypassCSP.*true' electron/
      2. Assert: zero matches
    Expected Result: bypassCSP:true no longer present
    Evidence: Grep output captured

  Scenario: Full build succeeds after security changes
    Tool: Bash
    Preconditions: All security fixes applied
    Steps:
      1. Run: npm run type-check 2>&1
      2. Assert: exit code 0
      3. Run: npm run build 2>&1
      4. Assert: exit code 0
      5. Assert: dist-electron/main.js exists
    Expected Result: Build succeeds with security changes
    Evidence: Build output captured
  ```

  **Commit**: YES
  - Message: `security: patch XSS, path traversal, postMessage origin, ffmpeg validation, and remove bypassCSP`
  - Files: `src/utils/sanitize.ts`, `src/utils/__tests__/sanitize.test.ts`, `src/layouts/control/BibleControl.vue`, `electron/file.ts`, `test/electron/__tests__/fileProtocol.test.ts`, `src/composables/useElectron.ts`, `electron/main.ts`, `package.json`
  - Pre-commit: `npx vitest run`

---

- [x] 3. CI Quality Gates

  **What to do**:
  - Create new GitHub Actions workflow `.github/workflows/ci.yml` for PR checks:
    - Trigger: `pull_request` to `main`/`master` and `push` to `main`/`master`
    - Job `quality-gates` on `ubuntu-latest`:
      - `npm ci`
      - `npm run lint`
      - `npm run type-check`
      - `npm run test:unit -- --run`
      - `npm run build`
  - Update `.github/workflows/build-release.yml` to depend on quality-gates job passing (add `needs: quality-gates` or add steps to existing build job)
  - Ensure failed checks block merges

  **Must NOT do**:
  - Don't add coverage thresholds yet (will be added after more tests exist)
  - Don't change the release workflow logic — only add prerequisite checks
  - Don't add bundle size checks yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single YAML file creation and minor edit to existing workflow
  - **Skills**: [`git-master`]
    - `git-master`: Commit workflow changes properly

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 6, 7, 8, 13
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `.github/workflows/build-release.yml` — Existing CI workflow structure: uses `actions/checkout@v4`, `actions/setup-node@v4`, node-version from `.node-version`; builds on `macos-14` and `windows-2025`
  - `package.json` — Script definitions: `lint`, `type-check`, `test:unit`, `build`

  **Documentation References**:
  - AGENTS.md — Build commands section lists all available npm scripts

  **WHY Each Reference Matters**:
  - `build-release.yml` — follow same checkout/setup pattern and runner config
  - `package.json` — verify exact script names to use in CI steps

  **Acceptance Criteria**:
  - [ ] `.github/workflows/ci.yml` exists with lint, type-check, test, build steps
  - [ ] Workflow triggers on PR and push to main
  - [ ] `build-release.yml` depends on quality checks

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: CI workflow file is valid YAML and has required steps
    Tool: Bash (grep + yaml validation)
    Preconditions: ci.yml created
    Steps:
      1. Run: cat .github/workflows/ci.yml | head -5
      2. Assert: file starts with valid YAML (name: field present)
      3. Run: grep -c 'npm run lint' .github/workflows/ci.yml
      4. Assert: count ≥ 1
      5. Run: grep -c 'npm run type-check' .github/workflows/ci.yml
      6. Assert: count ≥ 1
      7. Run: grep -c 'npm run test:unit' .github/workflows/ci.yml
      8. Assert: count ≥ 1
      9. Run: grep -c 'npm run build' .github/workflows/ci.yml
      10. Assert: count ≥ 1
    Expected Result: CI workflow contains all quality gate steps
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `ci: add quality gates workflow with lint, type-check, test, and build checks`
  - Files: `.github/workflows/ci.yml`, `.github/workflows/build-release.yml`
  - Pre-commit: `npx vitest run`

---

- [x] 4. Pre-commit Hooks (Husky + lint-staged)

  **What to do**:
  - Install Husky and lint-staged: `npm install -D husky lint-staged`
  - Initialize Husky: `npx husky init`
  - Create `.husky/pre-commit` hook that runs `npx lint-staged`
  - Add lint-staged config to `package.json`:
    ```json
    "lint-staged": {
      "*.{ts,vue}": ["eslint --fix"],
      "*.{ts,vue,js,json,md}": ["prettier --write"]
    }
    ```
  - Test that committing a file with lint errors triggers the hook

  **Must NOT do**:
  - Don't add vitest to pre-commit (too slow) — save test running for CI
  - Don't add pre-push hooks yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard Husky + lint-staged setup, well-documented
  - **Skills**: [`git-master`]
    - `git-master`: Proper hook setup and commit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `package.json` — Current scripts and devDependencies; verify husky/lint-staged not already present

  **External References**:
  - Husky: https://typicode.github.io/husky/ — Git hooks setup
  - lint-staged: https://github.com/lint-staged/lint-staged — Run linters on staged files

  **WHY Each Reference Matters**:
  - `package.json` — need to add lint-staged config and husky prepare script

  **Acceptance Criteria**:
  - [ ] `.husky/pre-commit` file exists and is executable
  - [ ] `package.json` contains `lint-staged` configuration
  - [ ] `package.json` contains `"prepare": "husky"` script

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Husky pre-commit hook is installed and executable
    Tool: Bash
    Preconditions: Husky installed
    Steps:
      1. Run: test -f .husky/pre-commit && echo "EXISTS" || echo "MISSING"
      2. Assert: output is "EXISTS"
      3. Run: test -x .husky/pre-commit && echo "EXECUTABLE" || echo "NOT_EXECUTABLE"
      4. Assert: output is "EXECUTABLE"
      5. Run: grep -q 'lint-staged' package.json && echo "CONFIGURED" || echo "MISSING"
      6. Assert: output is "CONFIGURED"
    Expected Result: Hook exists, is executable, lint-staged configured
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `chore: add husky pre-commit hooks with lint-staged for eslint and prettier`
  - Files: `.husky/pre-commit`, `package.json`, `package-lock.json`
  - Pre-commit: N/A (first commit with hooks)

---

- [x] 5. TypeScript Strict Mode (Phase 1 — Security-Critical Files)

  **What to do**:
  - Enable `"strict": true` in `tsconfig.app.json`
  - Run `npx vue-tsc --noEmit 2>&1 | tee /tmp/strict-errors.txt` to baseline error count
  - Fix `any`/`as any` usages in security-critical files FIRST (priority order):
    1. `src/composables/useElectron.ts` — IPC wrapper, replace `any` with proper types from `electron.d.ts`
    2. `electron/file.ts` — file operations and protocol handler
    3. `electron/handlers.ts` — IPC handlers
    4. `src/composables/useFileSystem.ts` — file system operations
    5. `src/services/filesystem/providers/LocalProvider.ts` — direct electronAPI access
  - For files NOT being fixed in this phase, add `// @ts-expect-error` with comment `// TODO: strict mode migration`
  - Write characterization tests for each file before modifying types

  **Must NOT do**:
  - Don't fix ALL `any` usages — only security-critical files in this phase
  - Don't change runtime behavior — only type annotations
  - Don't use `as unknown as T` pattern (that's just hiding the problem)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: TypeScript strict mode migration requires careful type analysis and may surface deep type issues
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Tasks 9, 10, 11
  - **Blocked By**: Task 2 (security files must be patched first)

  **References**:

  **Pattern References**:
  - `src/composables/useElectron.ts` — 591 lines, wraps all electronAPI calls; many `any` params in try/catch blocks
  - `src/types/electron.d.ts` — Proper type definitions for electronAPI interface — use these to replace `any`
  - `src/types/common.ts` — MessageType, AppMessage, TimerMode types — use in type narrowing
  - `electron/file.ts` — File operations with `any` in stream handling
  - `src/services/filesystem/providers/LocalProvider.ts:55,79,106,160,225` — Direct `window.electronAPI` access bypassing wrapper

  **API/Type References**:
  - `tsconfig.app.json` — Current config extends `@vue/tsconfig/tsconfig.dom.json`, no explicit strict
  - `tsconfig.json` — Project references structure

  **WHY Each Reference Matters**:
  - `useElectron.ts` — highest priority: IPC wrapper used by entire app, any types here propagate everywhere
  - `electron.d.ts` — the source of truth for what types SHOULD be used
  - `LocalProvider.ts` — bypasses useElectron, so types must be independently correct

  **Acceptance Criteria**:
  - [ ] `tsconfig.app.json` contains `"strict": true`
  - [ ] `npx vue-tsc --noEmit` passes (with @ts-expect-error on non-priority files)
  - [ ] Zero `any` in: useElectron.ts, file.ts, handlers.ts, useFileSystem.ts, LocalProvider.ts
  - [ ] All existing tests still pass: `npx vitest run` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Strict mode enabled and type-check passes
    Tool: Bash
    Preconditions: tsconfig.app.json modified
    Steps:
      1. Run: grep '"strict"' tsconfig.app.json
      2. Assert: output contains "strict": true
      3. Run: npm run type-check 2>&1
      4. Assert: exit code 0
      5. Run: npx vitest run 2>&1
      6. Assert: exit code 0
    Expected Result: Strict mode enabled, type-check and tests pass
    Evidence: Terminal output captured

  Scenario: Security-critical files have zero any usages
    Tool: Bash (grep)
    Preconditions: Type fixes applied
    Steps:
      1. Run: grep -c '\bany\b' src/composables/useElectron.ts
      2. Assert: count is 0 (or only in type imports)
      3. Run: grep -c '\bany\b' electron/file.ts
      4. Assert: count is 0
      5. Run: grep -c '\bany\b' electron/handlers.ts
      6. Assert: count is 0
    Expected Result: No any in security files
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `types: enable TypeScript strict mode and fix any usages in security-critical files`
  - Files: `tsconfig.app.json`, `src/composables/useElectron.ts`, `electron/file.ts`, `electron/handlers.ts`, `src/composables/useFileSystem.ts`, `src/services/filesystem/providers/LocalProvider.ts`
  - Pre-commit: `npm run type-check && npx vitest run`

---

- [x] 6. Error Handling Standardization

  **What to do**:
  - Audit ALL catch blocks across the codebase using `ast_grep_search` for `catch` pattern
  - Categorize each catch block:
    - ✅ Already uses `reportError()` — no change needed
    - ❌ Uses `console.error()` only — migrate to `reportError()`
    - ❌ Empty catch / swallowed — add `reportError()` with context
  - Migrate all `console.error` catch blocks to use `reportError(error, { operation: '...', component: '...' })` pattern from `src/composables/useSentry.ts`
  - Priority files (most catch blocks):
    - `src/stores/bible.ts` — ~10 console-only error logs
    - `src/services/pdf/PdfService.ts:~252` — bare catch
    - `src/components/Media/MediaItemList.vue:~463` — bare catch
    - `src/composables/useFileSystem.ts:~308` — bare catch
    - `src/composables/useIndexedDB.ts` — multiple console.error catches
  - Add ESLint rule to prevent future `console.error` in catch blocks (custom rule or comment convention)

  **Must NOT do**:
  - Don't change error messages — only the reporting mechanism
  - Don't remove console.error entirely — reportError should call both Sentry AND console.error
  - Don't add try/catch where none exists (only fix existing ones)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Pattern-based search-and-replace across many files, but each change is simple
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `src/composables/useSentry.ts` — `reportError(error, context)` function implementation — THE standard pattern to follow
  - `src/stores/timer.ts` — Example of CORRECT pattern: `reportError(error, { operation: 'initialize-timer-ipc', component: 'TimerStore' })`
  - `src/stores/bible.ts` — ~10 locations using `console.error` instead of `reportError` — highest priority migration target
  - `src/services/pdf/PdfService.ts:~252` — Bare/swallowed catch block
  - `src/components/Media/MediaItemList.vue:~463` — Bare catch
  - `src/composables/useFileSystem.ts:~308` — Bare catch

  **WHY Each Reference Matters**:
  - `useSentry.ts` — defines THE function to use; executor must understand its signature
  - `timer.ts` — shows correct usage pattern with operation + component context

  **Acceptance Criteria**:
  - [ ] Zero `console.error` in catch blocks (all migrated to `reportError`)
  - [ ] Zero empty/swallowed catch blocks
  - [ ] `npx vitest run` → PASS
  - [ ] `npm run type-check` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: No console.error in catch blocks
    Tool: Bash (grep)
    Preconditions: Error handling migration applied
    Steps:
      1. Run: grep -rn 'catch.*{' src/ --include='*.ts' --include='*.vue' -A5 | grep 'console.error' | wc -l
      2. Assert: count is 0
      3. Run: grep -rn 'catch.*{' electron/ --include='*.ts' -A5 | grep 'console.error' | wc -l
      4. Assert: count is 0
    Expected Result: All catch blocks use reportError, not console.error
    Evidence: Grep output captured

  Scenario: Build and tests pass after error handling changes
    Tool: Bash
    Preconditions: All error handling migrated
    Steps:
      1. Run: npm run type-check 2>&1
      2. Assert: exit code 0
      3. Run: npx vitest run 2>&1
      4. Assert: exit code 0
    Expected Result: No regressions from error handling changes
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `fix: standardize error handling to use reportError across all catch blocks`
  - Files: `src/stores/bible.ts`, `src/services/pdf/PdfService.ts`, `src/components/Media/MediaItemList.vue`, `src/composables/useFileSystem.ts`, `src/composables/useIndexedDB.ts`, and others with console.error in catch blocks
  - Pre-commit: `npm run type-check && npx vitest run`

---

- [x] 7. Sentry Version Alignment + Sourcemaps Configuration

  **What to do**:
  - Upgrade Sentry packages to aligned major versions:
    - `npm install @sentry/electron@latest @sentry/vue@latest`
    - Update initialization code in `electron/main.ts` if API changed
    - Update `src/composables/useSentry.ts` if Vue integration API changed
  - Configure Sentry sourcemaps:
    - Install: `npm install -D @sentry/vite-plugin`
    - Add to `vite.config.ts`: Sentry Vite plugin with `sourceMapsUploadOptions`
    - Enable `build.sourcemap: 'hidden'` in vite.config.ts (generates sourcemaps but doesn't include reference in bundle)
    - Update `electron-builder.config.ts` to NOT exclude `.map` files (or upload to Sentry and then exclude)
  - Verify Sentry error capture works end-to-end

  **Must NOT do**:
  - Don't change error reporting semantics — only upgrade packages
  - Don't add new Sentry integrations beyond what exists
  - Don't expose sourcemaps to end users (use 'hidden' mode)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Package upgrade + config changes, well-documented migration paths
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 6, 8)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `electron/main.ts:1-20` — Sentry initialization with `@sentry/electron` — may need API updates after upgrade
  - `src/composables/useSentry.ts` — Vue-side Sentry integration — check for API changes
  - `vite.config.ts` — Build configuration where sourcemap and Sentry plugin should be added
  - `electron-builder.config.ts` — Currently excludes `**/*.map` files — needs update for sourcemap strategy
  - `package.json` — Current versions: `@sentry/electron: ^7.2.0`, `@sentry/vue: ^10.20.0`

  **External References**:
  - Sentry Electron SDK migration: https://docs.sentry.io/platforms/javascript/guides/electron/
  - @sentry/vite-plugin: https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/

  **WHY Each Reference Matters**:
  - `main.ts` and `useSentry.ts` — initialization code that may break after major version upgrade
  - `vite.config.ts` — where to add sourcemap plugin
  - `electron-builder.config.ts` — controls whether .map files are packaged

  **Acceptance Criteria**:
  - [ ] `npm list @sentry/electron @sentry/vue` shows aligned major versions
  - [ ] `npm run build` → PASS (build works with new Sentry versions)
  - [ ] Sourcemaps generated during build (`dist-electron/**/*.map` files exist OR uploaded to Sentry)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Sentry versions are aligned
    Tool: Bash
    Preconditions: Packages upgraded
    Steps:
      1. Run: npm list @sentry/electron @sentry/vue 2>&1
      2. Assert: both packages show same major version (e.g., both @10.x or both @9.x)
      3. Run: npm run build 2>&1
      4. Assert: exit code 0
    Expected Result: Aligned versions, build succeeds
    Evidence: npm list and build output captured
  ```

  **Commit**: YES
  - Message: `chore: align sentry versions and configure sourcemap uploads`
  - Files: `package.json`, `package-lock.json`, `vite.config.ts`, `electron/main.ts`, `src/composables/useSentry.ts`, `electron-builder.config.ts`
  - Pre-commit: `npm run type-check && npx vitest run`

---

- [x] 8. Build Hardening (Remove Devtools from Production)

  **What to do**:
  - In `vite.config.ts`, wrap `vueDevTools()` plugin with environment check:
    ```typescript
    ...(process.env.NODE_ENV === 'development' ? [vueDevTools()] : [])
    ```
  - Verify production build does NOT include vue-devtools code:
    - Build and check output bundle for devtools references
  - Review `electron/windowManager.ts` — ensure `webContents.openDevTools()` is only called in dev mode (it already checks `VITE_DEV_SERVER_URL`)

  **Must NOT do**:
  - Don't remove vue-devtools from devDependencies — it's still useful in dev
  - Don't change any other vite plugins

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line config change in vite.config.ts
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 6, 7)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `vite.config.ts:~15-25` — Plugin array where `vueDevTools()` is currently included unconditionally
  - `electron/windowManager.ts` — `createMainWindow()` function checks `VITE_DEV_SERVER_URL` before opening devtools

  **WHY Each Reference Matters**:
  - `vite.config.ts` — exact location to add environment check
  - `windowManager.ts` — verify devtools already gated in electron (may already be fine)

  **Acceptance Criteria**:
  - [ ] `vueDevTools()` only included when `NODE_ENV === 'development'`
  - [ ] `npm run build` → PASS
  - [ ] Production bundle does NOT contain devtools: `grep -r 'devtools' dist-electron/renderer/ | wc -l` → 0 (or minimal)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Devtools removed from production build
    Tool: Bash
    Preconditions: vite.config.ts modified
    Steps:
      1. Run: npm run build 2>&1
      2. Assert: exit code 0
      3. Run: grep -r 'vue-devtools' dist-electron/renderer/ | wc -l
      4. Assert: count is 0 or significantly less than before
    Expected Result: Production build clean of devtools
    Evidence: Build output and grep results captured
  ```

  **Commit**: YES
  - Message: `build: exclude vue-devtools from production builds`
  - Files: `vite.config.ts`
  - Pre-commit: `npm run build`

---

- [ ] 9. Refactor Large Stores (folder.ts 748L, bible.ts 787L, timer.ts 547L)

  **What to do**:
  - **Target**: Each store file should be ≤500 lines after refactoring
  - **Strategy**: Extract logical groups into separate modules, keep store as orchestrator

  **9a. folder.ts (748L → ~400L)**:
  - Write characterization tests first: `src/stores/__tests__/folder.test.ts`
  - Extract tree operations (moveFolder, pasteItem, reorderFolders) into `src/utils/folderTree.ts`
  - Extract IndexedDB persistence (saveFolderDoc, saveFolderTreeBatch, loadRootFolder) into `src/services/folderPersistence.ts`
  - Remove file-level `eslint-disable @typescript-eslint/no-explicit-any` and fix actual types
  - Keep store file as state + orchestration only

  **9b. bible.ts (787L → ~450L)**:
  - Write characterization tests: `src/stores/__tests__/bible.test.ts`
  - Extract search logic (FlexSearch interaction, indexing) into composable or service
  - Extract version management into `src/services/bibleVersions.ts`
  - Extract history/preview state management

  **9c. timer.ts (547L → ~400L)**:
  - Write characterization tests: `src/stores/__tests__/timer.test.ts` (extend from Task 1)
  - Extract preset management into `src/utils/timerPresets.ts`
  - Extract formatting/validation logic into `src/utils/timerFormatting.ts`
  - Keep IPC synchronization in store (it's core responsibility)

  **Must NOT do**:
  - Don't change store public API (exported reactive state, computed, actions)
  - Don't change how stores interact with each other
  - Don't change IndexedDB schema or localStorage keys
  - Don't refactor more than one store per commit

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex refactoring with dependency analysis, test-first approach, and careful API preservation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 10, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `src/stores/folder.ts:1-748` — Full store file; identify logical groupings: tree ops (~lines 200-450), persistence (~lines 450-650), state (~lines 1-100)
  - `src/stores/bible.ts:1-787` — Full store; groups: search/indexing, version mgmt, history, content fetching
  - `src/stores/timer.ts:1-547` — Full store; groups: presets, formatting, IPC sync, state machine
  - `src/stores/stopwatch.ts` — Timer depends on stopwatch store — understand cross-store dependency

  **API/Type References**:
  - `src/types/common.ts` — FolderItem, FileItem, VerseItem generics used by folder store
  - `src/types/common.ts` — TimerMode, TimerStatus types used by timer store

  **Test References**:
  - `src/stores/__tests__/timer.test.ts` — Initial test from Task 1; extend with characterization tests

  **WHY Each Reference Matters**:
  - `folder.ts` — must understand internal structure to identify extraction boundaries
  - `common.ts` — types define the contract between extracted modules
  - Existing timer test — don't duplicate, extend

  **Acceptance Criteria**:
  - [ ] `wc -l src/stores/folder.ts` → ≤500
  - [ ] `wc -l src/stores/bible.ts` → ≤500
  - [ ] `wc -l src/stores/timer.ts` → ≤500
  - [ ] Zero `eslint-disable` comments in store files
  - [ ] `npx vitest run src/stores/__tests__/` → PASS (characterization + new tests)
  - [ ] `npm run type-check` → PASS
  - [ ] Extracted modules have their own test files

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Store files are within size limits
    Tool: Bash (wc)
    Preconditions: Refactoring complete
    Steps:
      1. Run: wc -l src/stores/folder.ts
      2. Assert: line count ≤ 500
      3. Run: wc -l src/stores/bible.ts
      4. Assert: line count ≤ 500
      5. Run: wc -l src/stores/timer.ts
      6. Assert: line count ≤ 500
    Expected Result: All stores within limits
    Evidence: wc output captured

  Scenario: All store tests pass after refactoring
    Tool: Bash (vitest)
    Preconditions: Characterization tests + extracted module tests
    Steps:
      1. Run: npx vitest run src/stores/ --reporter=verbose 2>&1
      2. Assert: exit code 0
      3. Assert: stdout shows test counts for folder, bible, timer
    Expected Result: All tests pass
    Evidence: Test output captured

  Scenario: No eslint-disable in store files
    Tool: Bash (grep)
    Preconditions: Refactoring complete
    Steps:
      1. Run: grep -c 'eslint-disable' src/stores/folder.ts
      2. Assert: count is 0
      3. Run: grep -c 'eslint-disable' src/stores/bible.ts
      4. Assert: count is 0
    Expected Result: No eslint-disable comments
    Evidence: Grep output captured
  ```

  **Commit**: YES (3 separate commits, one per store)
  - Message 1: `refactor: extract tree operations and persistence from folder store`
  - Message 2: `refactor: extract search and version management from bible store`
  - Message 3: `refactor: extract presets and formatting from timer store`
  - Pre-commit: `npm run type-check && npx vitest run`

---

- [x] 10. Refactor Large Composables (useMediaOperations 940L, useElectron 591L)

  **What to do**:
  - **Target**: Each composable should be ≤400 lines

  **10a. useMediaOperations.ts (940L → ~350L)**:
  - Write characterization tests: `src/composables/__tests__/useMediaOperations.test.ts`
  - Extract upload logic into `src/composables/useMediaUpload.ts`
  - Extract paste/clipboard logic into `src/composables/useMediaClipboard.ts`
  - Extract FFmpeg/PDF processing into `src/composables/useMediaProcessing.ts`
  - Keep useMediaOperations as a facade that composes the extracted composables

  **10b. useElectron.ts (591L → ~300L)**:
  - Write characterization tests: `src/composables/__tests__/useElectron.test.ts`
  - Extract timer IPC methods into `src/composables/useTimerIPC.ts`
  - Extract file operations into `src/composables/useElectronFiles.ts`
  - Extract projection-specific code (useProjectionElectron) into separate file `src/composables/useProjectionElectron.ts` (it's already logically separate within the file)
  - Keep core useElectron with: `isElectron()`, `sendToProjection()`, `sendToMain()`, and re-exports

  **Must NOT do**:
  - Don't change composable return signatures (external API stays same)
  - Don't change how composables are imported in components
  - Don't introduce new dependencies between composables

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex composable extraction with dependency chains and lifecycle concerns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 9, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `src/composables/useMediaOperations.ts:1-940` — Full file; logical sections: upload (~1-200), paste (~200-400), FFmpeg (~400-600), PDF (~600-800), sort/filter (~800-940)
  - `src/composables/useElectron.ts:1-591` — Full file; sections: core electron check (~1-50), file ops (~50-200), timer IPC (~200-350), projection (~350-500), useProjectionElectron (~500-591)
  - `src/composables/useProjectionManager.ts` — Depends on useElectron.sendToProjection — ensure extracted API matches

  **Test References**:
  - Mock pattern: use `vi.stubGlobal('electronAPI', {...})` from Task 1 setup

  **WHY Each Reference Matters**:
  - `useMediaOperations.ts` — must read to identify logical extraction boundaries
  - `useElectron.ts` — core IPC wrapper; extraction must preserve sendToProjection contract
  - `useProjectionManager.ts` — consumer that will break if useElectron API changes

  **Acceptance Criteria**:
  - [ ] `wc -l src/composables/useMediaOperations.ts` → ≤400
  - [ ] `wc -l src/composables/useElectron.ts` → ≤400
  - [ ] All extracted composables have test files
  - [ ] `npx vitest run src/composables/` → PASS
  - [ ] `npm run type-check` → PASS
  - [ ] `npm run build` → PASS (no broken imports)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Composable files within size limits
    Tool: Bash (wc)
    Preconditions: Refactoring complete
    Steps:
      1. Run: wc -l src/composables/useMediaOperations.ts
      2. Assert: line count ≤ 400
      3. Run: wc -l src/composables/useElectron.ts
      4. Assert: line count ≤ 400
    Expected Result: All composables within limits
    Evidence: wc output captured

  Scenario: No broken imports after extraction
    Tool: Bash
    Preconditions: Composables extracted
    Steps:
      1. Run: npm run type-check 2>&1
      2. Assert: exit code 0
      3. Run: npm run build 2>&1
      4. Assert: exit code 0
    Expected Result: Type-check and build succeed
    Evidence: Terminal output captured
  ```

  **Commit**: YES (2 separate commits)
  - Message 1: `refactor: extract upload, clipboard, and processing logic from useMediaOperations`
  - Message 2: `refactor: extract timer IPC, file ops, and projection from useElectron`
  - Pre-commit: `npm run type-check && npx vitest run`

---

- [x] 11. TypeScript Strict Mode (Phase 2 — Remaining Files)

  **What to do**:
  - Remove ALL remaining `// @ts-expect-error` annotations added in Task 5
  - Fix `any`/`as any` in remaining files (priority order):
    1. `src/composables/useIndexedDB.ts` — heavy `any` usage for IndexedDB generics
    2. `src/workers/flexsearch.worker.ts` — FlexSearch API types
    3. `src/composables/useMediaOperations.ts` (post-refactor from Task 10)
    4. `src/utils/performanceUtils.ts` — performance monitoring types
    5. `src/utils/memoryManager.ts` — memory management types
    6. All Vue components with `any` (LiquidBtnToggle.vue, etc.)
  - For third-party libraries with incomplete types, create `.d.ts` augmentation files in `src/types/`
  - Add ESLint rule `@typescript-eslint/no-explicit-any: 'error'` to prevent future `any` usage

  **Must NOT do**:
  - Don't use `as unknown as T` to bypass type checking
  - Don't create overly generic types that are effectively `any`
  - Don't change runtime behavior

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Fixing remaining `any` across 20+ files requires careful type analysis
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 9, 10)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/composables/useIndexedDB.ts` — Heavy `any` casts for IDBDatabase/IDBTransaction — needs proper generics
  - `src/workers/flexsearch.worker.ts` — FlexSearch library has limited types — may need `.d.ts` augmentation
  - `src/utils/performanceUtils.ts` — Performance API types
  - `src/utils/memoryManager.ts` — Memory measurement types

  **External References**:
  - FlexSearch types: https://github.com/nextapps-de/flexsearch — check for @types/flexsearch or included types

  **WHY Each Reference Matters**:
  - `useIndexedDB.ts` — heaviest `any` usage, fixing this file eliminates the most type holes
  - `flexsearch.worker.ts` — may need custom type definitions if library types are incomplete

  **Acceptance Criteria**:
  - [ ] `grep -rn '\bany\b' src/ --include='*.ts' --include='*.vue' | grep -v 'node_modules' | grep -v '.d.ts' | grep -v '// eslint' | wc -l` → ≤5 (near-zero any usages)
  - [ ] Zero `@ts-expect-error` annotations remaining
  - [ ] ESLint config includes `@typescript-eslint/no-explicit-any: 'error'`
  - [ ] `npm run type-check` → PASS
  - [ ] `npm run lint` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Near-zero any usages in codebase
    Tool: Bash (grep)
    Preconditions: All any usages fixed
    Steps:
      1. Run: grep -rn '\bany\b' src/ --include='*.ts' --include='*.vue' | grep -v 'node_modules' | grep -v '.d.ts' | wc -l
      2. Assert: count ≤ 5
      3. Run: grep -rn '@ts-expect-error' src/ --include='*.ts' --include='*.vue' | wc -l
      4. Assert: count is 0
    Expected Result: Codebase is nearly any-free
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `types: eliminate remaining any usages and add no-explicit-any ESLint rule`
  - Files: Multiple (all files with `any` fixes)
  - Pre-commit: `npm run type-check && npm run lint && npx vitest run`

---

- [x] 12. Refactor Large Vue Components

  **What to do**:
  - **Target**: Each Vue component should be ≤500 lines
  - **Strategy**: Extract logic to composables first, then split templates into child components

  **12a. Bible/MultiFunction/Control.vue (1114L → ~400L)**:
  - Extract search/filter logic into composable
  - Extract verse selection logic into composable
  - Split template into child components: SearchPanel, VerseList, ControlBar

  **12b. Media/MediaPresenter.vue (1067L → ~400L)**:
  - Extract media playback logic (already partially in useVideoPlayer)
  - Extract PDF rendering logic into child component
  - Split template: MediaPlayer, PdfSlideshow, MediaControls

  **12c. layouts/control/BibleControl.vue (774L → ~400L)**:
  - Extract Bible version switching logic
  - Extract projection controls
  - Split template: VersionSelector, ChapterNav, ProjectionControls

  **12d. Media/MediaItemList.vue (686L → ~400L)**:
  - Extract drag-and-drop logic (already in useDragAndDrop composable — ensure fully extracted)
  - Extract selection logic (useSelectionManager)
  - Split template: MediaGrid, MediaListItem, MediaToolbar

  **12e. layouts/control/TimerControl.vue (488L → ~350L)**:
  - Extract preset management UI into child component
  - Extract timer display into reusable component

  **Must NOT do**:
  - Don't change component props/events/exposed API
  - Don't change visual appearance or behavior
  - Don't refactor components that depend on these (cascade later)
  - Don't refactor more than one component per commit

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Vue component refactoring requires understanding of template structure, reactivity, and UI concerns
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Understands component composition patterns and Vue best practices

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential within wave, each component depends on prior for pattern)
  - **Parallel Group**: Wave 5
  - **Blocks**: Tasks 14, 15
  - **Blocked By**: Tasks 9, 10

  **References**:

  **Pattern References**:
  - `src/components/Bible/MultiFunction/Control.vue:1-1114` — Largest component; mixed search, verse selection, keyboard nav, and projection logic
  - `src/components/Media/MediaPresenter.vue:1-1067` — Media playback + PDF + controls all in one
  - `src/layouts/control/BibleControl.vue:1-774` — Layout with version switching, chapter nav, projection controls
  - `src/components/Media/MediaItemList.vue:1-686` — List with drag/drop, selection, context menu
  - `src/layouts/control/TimerControl.vue:1-488` — Timer display + presets + controls
  - `src/composables/useVideoPlayer.ts` — Already extracted video logic — extend this pattern
  - `src/composables/useSelectionManager.ts` — Already extracted selection — ensure fully used

  **WHY Each Reference Matters**:
  - Each component file must be read in full to identify extraction boundaries
  - Existing composables show the extraction pattern to follow
  - Understanding current template structure is essential for child component splits

  **Acceptance Criteria**:
  - [ ] `wc -l src/components/Bible/MultiFunction/Control.vue` → ≤500
  - [ ] `wc -l src/components/Media/MediaPresenter.vue` → ≤500
  - [ ] `wc -l src/layouts/control/BibleControl.vue` → ≤500
  - [ ] `wc -l src/components/Media/MediaItemList.vue` → ≤500
  - [ ] `wc -l src/layouts/control/TimerControl.vue` → ≤500
  - [ ] `npm run type-check` → PASS
  - [ ] `npm run build` → PASS
  - [ ] `npx vitest run` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All large components within size limits
    Tool: Bash (wc)
    Preconditions: Refactoring complete
    Steps:
      1. Run: wc -l src/components/Bible/MultiFunction/Control.vue
      2. Assert: ≤ 500
      3. Run: wc -l src/components/Media/MediaPresenter.vue
      4. Assert: ≤ 500
      5. Run: wc -l src/layouts/control/BibleControl.vue
      6. Assert: ≤ 500
      7. Run: wc -l src/components/Media/MediaItemList.vue
      8. Assert: ≤ 500
      9. Run: wc -l src/layouts/control/TimerControl.vue
      10. Assert: ≤ 500
    Expected Result: All components within limits
    Evidence: wc output captured

  Scenario: App builds and works after component refactoring
    Tool: Bash
    Preconditions: All components refactored
    Steps:
      1. Run: npm run type-check 2>&1
      2. Assert: exit code 0
      3. Run: npm run build 2>&1
      4. Assert: exit code 0
      5. Run: npx vitest run 2>&1
      6. Assert: exit code 0
    Expected Result: No regressions from refactoring
    Evidence: Terminal output captured
  ```

  **Commit**: YES (5 separate commits, one per component)
  - Message pattern: `refactor: split [ComponentName] into composables and child components`
  - Pre-commit: `npm run type-check && npx vitest run`

---

- [x] 13. Router Lazy Loading

  **What to do**:
  - In `src/router/index.ts`:
    - Convert static imports to dynamic imports for lazy loading
    - `component: () => import('@/views/ProjectionView.vue')` for projection route
    - Keep HomeView as eager load (it's the main entry, always needed)
  - Verify code splitting in build output (separate chunk for projection)

  **Must NOT do**:
  - Don't add route guards (desktop app, no auth needed)
  - Don't add new routes
  - Don't change route paths or names

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file change, standard Vue Router pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 12)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `src/router/index.ts` — Current static imports: `import HomeView from '@/views/HomeView.vue'` and `import ProjectionView from '@/views/ProjectionView.vue'`

  **WHY Each Reference Matters**:
  - `router/index.ts` — the only file that needs changing

  **Acceptance Criteria**:
  - [ ] `src/router/index.ts` uses `() => import(...)` for ProjectionView
  - [ ] `npm run build` → PASS
  - [ ] Build output contains separate chunk for projection

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Lazy loading implemented and build creates separate chunk
    Tool: Bash
    Preconditions: Router updated
    Steps:
      1. Run: grep 'import(' src/router/index.ts | wc -l
      2. Assert: count ≥ 1 (at least projection is lazy-loaded)
      3. Run: npm run build 2>&1
      4. Assert: exit code 0
      5. Run: ls dist-electron/renderer/assets/*.js | wc -l
      6. Assert: count > 1 (multiple chunks = code splitting working)
    Expected Result: Projection route lazy-loaded, separate chunk created
    Evidence: Build output and file listing captured
  ```

  **Commit**: YES
  - Message: `perf: add route lazy loading for projection view`
  - Files: `src/router/index.ts`
  - Pre-commit: `npm run build`

---

- [x] 14. Accessibility Improvements (WCAG 2.1 Level AA)

  **What to do**:
  - Install axe-core for automated accessibility testing: `npm install -D @axe-core/playwright` (if Playwright tests are set up) or `npm install -D axe-core` for vitest
  - Audit and fix custom components (NOT Vuetify components — they have built-in a11y):

  **14a. Add ARIA labels to all interactive custom elements**:
  - LiquidGlass components: LiquidBtn, LiquidSelect, LiquidTextField, LiquidSearchBar — add `aria-label`, `role` attributes
  - Context menus: add `role="menu"`, `role="menuitem"`, keyboard navigation (arrow keys, Enter, Escape)
  - Custom dialogs: add `role="dialog"`, `aria-modal="true"`, focus trap

  **14b. Keyboard navigation**:
  - Ensure all interactive elements are focusable (tabindex where needed)
  - Add keyboard shortcuts documentation (already have useKeyboardShortcuts composable)
  - Ensure Escape closes modals/menus

  **14c. Color contrast**:
  - Check custom-colored elements meet 4.5:1 contrast ratio (WCAG AA)
  - Fix any low-contrast text (especially on overlays, glass effects)

  **14d. Focus management**:
  - When modals open, move focus to first interactive element
  - When modals close, return focus to trigger element
  - Visible focus indicators on all interactive elements

  **Must NOT do**:
  - Don't modify Vuetify component accessibility (it's already handled)
  - Don't add ARIA where semantic HTML suffices
  - Don't change visual design — only add accessibility attributes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Accessibility improvements are tightly coupled with UI component structure
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Understands a11y patterns and component composition

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6 (with Task 15)
  - **Blocks**: None
  - **Blocked By**: Task 12

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/` — Custom UI components that need ARIA attributes
  - `src/composables/useKeyboardShortcuts.ts` — Existing keyboard shortcut infrastructure
  - `src/composables/useContextMenu.ts` — Context menu lifecycle — needs role/keyboard attributes
  - `src/components/Main/SettingsDialog.vue` — Dialog component — needs focus trap

  **External References**:
  - WAI-ARIA Practices: https://www.w3.org/TR/wai-aria-practices/
  - WCAG 2.1 Quick Reference: https://www.w3.org/WAI/WCAG21/quickref/
  - axe-core: https://github.com/dequelabs/axe-core

  **WHY Each Reference Matters**:
  - LiquidGlass components — custom UI without built-in a11y; primary targets
  - useKeyboardShortcuts — existing pattern to extend for a11y keyboard nav
  - WAI-ARIA docs — authoritative source for correct ARIA usage

  **Acceptance Criteria**:
  - [ ] All custom buttons have `aria-label` attributes
  - [ ] All custom dialogs have `role="dialog"` and `aria-modal="true"`
  - [ ] Context menus have `role="menu"` and `role="menuitem"`
  - [ ] All interactive elements are keyboard-focusable
  - [ ] `npm run type-check` → PASS
  - [ ] `npm run build` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Custom components have ARIA attributes
    Tool: Bash (grep)
    Preconditions: A11y improvements applied
    Steps:
      1. Run: grep -rn 'aria-label\|aria-modal\|role=' src/components/LiquidGlass/ --include='*.vue' | wc -l
      2. Assert: count ≥ 10 (multiple ARIA attributes added)
      3. Run: grep -rn 'role="menu"\|role="menuitem"' src/composables/useContextMenu.ts src/components/ --include='*.vue' --include='*.ts' | wc -l
      4. Assert: count ≥ 2
    Expected Result: ARIA attributes present on custom components
    Evidence: Grep output captured

  Scenario: Build succeeds with a11y changes
    Tool: Bash
    Preconditions: All a11y changes applied
    Steps:
      1. Run: npm run type-check 2>&1
      2. Assert: exit code 0
      3. Run: npm run build 2>&1
      4. Assert: exit code 0
    Expected Result: No regressions from a11y changes
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `a11y: add ARIA labels, keyboard navigation, and focus management to custom components`
  - Files: Multiple LiquidGlass components, useContextMenu.ts, SettingsDialog.vue
  - Pre-commit: `npm run type-check && npx vitest run`

---

- [ ] 15. CSS Audit & Variables Migration

  **What to do**:

  **15a. Audit !important usages (33+ occurrences)**:
  - Run `grep -rn '!important' src/ --include='*.vue' --include='*.scss' --include='*.css'`
  - For each occurrence, classify:
    - **Keep**: Legitimately needed for Vuetify override (document reason with comment)
    - **Remove**: Can be replaced with higher specificity or CSS variable
  - Add ESLint/Stylelint rule to warn on new `!important` usage

  **15b. Migrate hardcoded colors to CSS variables**:
  - Search for hex colors and rgb() in component styles
  - Create missing CSS variables in theme files (`src/components/LiquidGlass/styles/_variables.scss` or `src/assets/main.scss`)
  - Replace hardcoded values with `var(--variable-name, fallback-value)` (always include fallback)
  - Priority: colors used in multiple components first

  **15c. Style consistency**:
  - Ensure all component styles use `<style scoped>` (unless intentionally global)
  - Document any global style overrides with comments explaining why

  **Must NOT do**:
  - Don't change colors or visual appearance — only move to variables
  - Don't remove Vuetify overrides that are legitimately needed
  - Don't add new CSS frameworks or methodologies
  - Don't change component logic — CSS only

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: CSS refactoring with visual impact assessment
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Understands CSS specificity, variables, and Vuetify override patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6 (with Task 14)
  - **Blocks**: None
  - **Blocked By**: Task 12

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/styles/_variables.scss` — Existing CSS variable definitions — extend this file
  - `src/components/LiquidGlass/styles/_theme.scss` — Theme configuration
  - `src/components/LiquidGlass/styles/_mixins.scss` — SCSS mixins
  - `src/assets/main.scss` — Global styles entry point
  - Components with most `!important`: HomeView.vue, MediaItem.vue, CustomFolderTab.vue, LiquidContainer

  **WHY Each Reference Matters**:
  - `_variables.scss` — the canonical location for new CSS variables
  - Components with `!important` — direct targets for the audit

  **Acceptance Criteria**:
  - [ ] Every `!important` has a comment justifying its existence, OR has been removed
  - [ ] Hardcoded hex/rgb colors replaced with CSS variables (with fallbacks)
  - [ ] All `<style>` blocks use `scoped` unless documented otherwise
  - [ ] `npm run build` → PASS
  - [ ] No visual regressions (Playwright screenshots match baseline)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: !important audit complete
    Tool: Bash (grep)
    Preconditions: CSS audit applied
    Steps:
      1. Run: grep -rn '!important' src/ --include='*.vue' --include='*.scss' --include='*.css' | wc -l
      2. Assert: count ≤ 15 (reduced from 33+; remaining are documented Vuetify overrides)
      3. Run: grep -B1 '!important' src/ --include='*.vue' --include='*.scss' | grep -c '\/\*\|\/\/'
      4. Assert: count ≥ remaining !important count (each has a comment)
    Expected Result: !important usages reduced and documented
    Evidence: Grep output captured

  Scenario: CSS variables have fallbacks
    Tool: Bash (grep)
    Preconditions: Variables migration applied
    Steps:
      1. Run: grep -rn 'var(--' src/ --include='*.vue' --include='*.scss' | grep -v ',' | wc -l
      2. Assert: count is 0 or very low (all var() calls have fallback values)
    Expected Result: All CSS variables include fallback values
    Evidence: Grep output captured

  Scenario: Build succeeds with CSS changes
    Tool: Bash
    Preconditions: All CSS changes applied
    Steps:
      1. Run: npm run build 2>&1
      2. Assert: exit code 0
    Expected Result: Build succeeds
    Evidence: Build output captured
  ```

  **Commit**: YES
  - Message: `style: audit !important usages and migrate hardcoded colors to CSS variables`
  - Files: Multiple .vue and .scss files
  - Pre-commit: `npm run build`

---

## Commit Strategy

| After Task | Message                                                                   | Key Files                                                                              | Verification         |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------- |
| 1          | `test: add test infrastructure with vitest setup and initial timer tests` | setup.ts, timer.test.ts, timerService.test.ts                                          | `npx vitest run`     |
| 2          | `security: patch XSS, path traversal, postMessage, ffmpeg, bypassCSP`     | sanitize.ts, BibleControl.vue, file.ts, useElectron.ts, main.ts                        | `npx vitest run`     |
| 3          | `ci: add quality gates workflow`                                          | ci.yml, build-release.yml                                                              | YAML validation      |
| 4          | `chore: add husky pre-commit hooks with lint-staged`                      | .husky/pre-commit, package.json                                                        | Hook existence check |
| 5          | `types: enable strict mode and fix security-critical any usages`          | tsconfig.app.json, useElectron.ts, file.ts, handlers.ts                                | `npm run type-check` |
| 6          | `fix: standardize error handling to reportError`                          | bible.ts, PdfService.ts, MediaItemList.vue + others                                    | `npx vitest run`     |
| 7          | `chore: align sentry versions and configure sourcemaps`                   | package.json, vite.config.ts, main.ts                                                  | `npm run build`      |
| 8          | `build: exclude vue-devtools from production`                             | vite.config.ts                                                                         | `npm run build`      |
| 9          | `refactor: split large stores` (3 commits)                                | folder.ts, bible.ts, timer.ts + extracted modules                                      | `npx vitest run`     |
| 10         | `refactor: split large composables` (2 commits)                           | useMediaOperations.ts, useElectron.ts + extracted                                      | `npx vitest run`     |
| 11         | `types: eliminate remaining any and add lint rule`                        | Multiple files                                                                         | `npm run lint`       |
| 12         | `refactor: split large Vue components` (5 commits)                        | Control.vue, MediaPresenter.vue, BibleControl.vue, MediaItemList.vue, TimerControl.vue | `npm run build`      |
| 13         | `perf: add route lazy loading`                                            | router/index.ts                                                                        | `npm run build`      |
| 14         | `a11y: add ARIA labels and keyboard navigation`                           | LiquidGlass components, useContextMenu.ts                                              | `npm run build`      |
| 15         | `style: CSS variables migration and !important audit`                     | Multiple .vue/.scss                                                                    | `npm run build`      |

---

## Success Criteria

### Verification Commands

```bash
# All tests pass
npm run test:unit -- --run                    # Expected: 0 failures

# Type checking passes
npm run type-check                             # Expected: exit 0

# Linting passes (no warnings)
npm run lint                                   # Expected: exit 0, 0 warnings

# Build succeeds
npm run build                                  # Expected: exit 0

# Security: No XSS vectors
grep -rn 'v-html' src/ --include='*.vue' | grep -v sanitize  # Expected: 0 matches

# Security: No wildcard postMessage
grep -rn "postMessage.*'\\*'" src/             # Expected: 0 matches

# Security: No bypassCSP
grep -rn 'bypassCSP.*true' electron/          # Expected: 0 matches

# TypeScript: Near-zero any
grep -rn '\bany\b' src/ --include='*.ts' --include='*.vue' | grep -v node_modules | grep -v '.d.ts' | wc -l  # Expected: ≤5

# File sizes within limits
wc -l src/stores/folder.ts src/stores/bible.ts src/stores/timer.ts  # Expected: each ≤500
wc -l src/composables/useMediaOperations.ts src/composables/useElectron.ts  # Expected: each ≤400
```

### Final Checklist

- [ ] All 5 security vulnerabilities patched
- [ ] Test infrastructure operational with ≥10 passing tests
- [ ] CI quality gates enforced on all PRs
- [ ] Pre-commit hooks active
- [ ] TypeScript strict mode enabled, near-zero `any`
- [ ] All error handling uses `reportError()` consistently
- [ ] Sentry versions aligned, sourcemaps configured
- [ ] No vue-devtools in production builds
- [ ] All stores ≤500 lines
- [ ] All composables ≤400 lines
- [ ] All Vue components ≤500 lines
- [ ] Projection route lazy-loaded
- [ ] ARIA labels on all custom interactive elements
- [ ] CSS !important audited and documented
- [ ] Hardcoded colors migrated to CSS variables
- [ ] All "Must Have" requirements present
- [ ] All "Must NOT Have" guardrails respected
