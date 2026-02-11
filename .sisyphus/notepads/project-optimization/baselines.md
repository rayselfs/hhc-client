# Project Optimization — Baselines (Wave 0)

Timestamp: 2026-02-11 10:37:00 (local)

This file records Wave 0 baselines for tests, build time, bundle size, and large-file counts.

## 1) Test count

Command: `npm run test:unit 2>&1 | tail -10`

Output (last lines):

```
Test Files  5 passed (5)
     Tests  83 passed (83)
  Start at  10:26:11
  Duration  731ms (transform 189ms, setup 57ms, collect 712ms, tests 59ms, environment 1.62s, prepare 258ms)
```

Recorded: 83 tests passed

## 2) Renderer build time

Command: `time npm run build-only 2>&1 | tail -5`

Output (last lines):

```
✓ built in 4ms
npm run build-only 2>&1  8.80s user 1.23s system 184% cpu 5.440 total
```

Recorded: 5.440s wall-clock (time output)

## 3) Bundle size (renderer)

Command: `du -sh dist-electron/renderer/`

Output:

```
16M    dist-electron/renderer/
```

Recorded: 16M

## 4) Large Vue files (>300 lines)

Command: `find src/ -name "*.vue" -exec wc -l {} \; | awk '$1>300' | wc -l`

Output:

```
15
```

Recorded: 15 Vue files >300 lines

## 5) Large TS files (>200 lines)

Command: `find src/ -name "*.ts" -exec wc -l {} \; | awk '$1>200' | wc -l`

Output:

```
32
```

Recorded: 32 TS files >200 lines

## 6) Import pattern baseline

Command: `grep -r "from '@/components/" src/ | wc -l`

Output:

```
49
```

Recorded: 49 imports from "@/components/"

---

Notes:

- All commands run from project root: `/Users/rayselfs/Projects/hhc/hhc-client`
- Per instructions, used `npm run build-only` (vite build) for renderer timing
