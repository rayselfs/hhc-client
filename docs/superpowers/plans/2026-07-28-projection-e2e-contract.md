# Projection E2E Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale Now Projecting selectors and verify the current Header projection contract.

**Architecture:** Update only the two E2E specs. Use accessible button names already exposed by the
production Header.

**Tech Stack:** Playwright, TypeScript

### Task 1: Browser Projection E2E

- [x] Update the popup URL assertion for generation plus session ID.
- [x] Replace obsolete blackout/resume/close selectors with `Stop projection`.
- [x] Keep media persistence and explicit close assertions.

### Task 2: Packaged Electron E2E

- [x] Replace obsolete status-bar controls with the Header `Stop projection` action.
- [x] Keep timer persistence across Files navigation and explicit window-close assertions.

### Task 3: Verification

- [x] Confirm no E2E file references `now-projecting-*`.
- [x] Run the browser projection Playwright suite.
- [x] Run typecheck, lint, and diff check.
- [x] Mark this plan complete and commit.
