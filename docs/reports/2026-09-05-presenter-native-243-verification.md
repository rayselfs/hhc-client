# Presenter 2.4.3 optimization verification

## Scope

Execute the native editing/media plan after LINE Phase 1. Async upload Phase 2+ remains separate. Publish one combined 2.4.3 only after required checks and acceptance.

## E1 evidence

- Baseline browser regression reproduced caret reversal: `abcdef` became `fedcba`.
- Editable text now has one DOM owner; React renders a detached template and the non-editing preview.
- Ordinary input echoes do not replace the editable subtree. External formatting retains logical anchor/focus offsets.
- The user exercised Chinese input in the isolated Electron QA build and reported normal typing, but found re-entry after blur broken.
- Browser regression reproduced the re-entry failure: the new editable node became inactive after pointerdown replaced the preview. Preventing default focus on the detached pointer target fixes it.
- E1 commit: `612c82e5`.
- Updated isolated macOS package successfully. Native coordinate clicks on the original Chinese text after canvas blur restored editing; inserting and deleting a test character worked. Restored the user text `我是一個小朋友`. An AX-index click on the non-editing text field did not activate it; coordinate pointer input confirmed the actual click path.
- Focused surface/rich-text tests: 71 passed. Browser regressions: 3 passed (typing/deletion/newlines, styled-run deletion, three consecutive single-click re-entries).
- The exact removeChild error was not observed after the change. Existing browser error assertions remain in the regression.

## E2 formatting

- Commit `a6971fee`: shared scoped commands, live selection read before mutation, retained directional range and popup highlight, functional React Aria popup triggers, paragraph/list states and empty-list Enter exit.
- 75 focused tests and 9 browser tests passed, including separate formatting undo/redo. Additional font integration tests also cover these cases.

## E3 fonts and layout

- Commits `5840579d` and `6c3cc522`: searchable HeroUI Popover/ListBox using document, recent and local families, custom sizes, honest unavailable/retry states, font loading in preview/projection, rich-run measurement and derived layout history.
- 128 focused tests and 10 browser tests passed. Font search, 13 point size, selection preservation and undo covered.
- PWA precache stayed within the original 5 MiB limit by reusing Popover rather than adding ComboBox runtime code.
- Intermediate lint found synchronous derived-state effects; fixed with derived font input/fit zoom values and verified affected browser tests and lint.
- Native CUA on the 2.4.3 unpacked app found Microsoft Sans Serif through the actual local-font picker and applied it while preserving selected Chinese text. After blur and a single click, Bold and Center both read enabled. A custom 13 point size applied successfully.

## E4 text-box lifecycle and geometry

- New empty text creation remains a session draft. A true exit cancels it with no ghost undo entry; formatting popups do not discard it. First meaningful input establishes the box.
- Content-height boxes retain horizontal-only sizing, including rotated coordinates. Imported fixed-height frames retain manual height.
- Neutral outline, white square handles, pointer/keyboard rotation using the transform session.
- 79 focused tests and 13 browser tests passed. Lint/typecheck passed; the same geometry/rotation regression passed against packaged Electron. The existing imported fixed-height QA box correctly retained eight handles.

## E5 slide commands

- Selection ring surrounds the thumbnail only; the slide number retains its separate accessible option/focus state.
- Keyboard and standard DOM clipboard events route through the same interaction-scope handler. Native text/input clipboard behavior remains delegated to Chromium.
- Packaged macOS verification through the actual Edit menu: Copy/Paste changed two slides to three; Cut changed three to two; immediate Undo restored three. Native Cmd+C/V changed one slide to two exactly once. Restored the QA deck to one slide afterward.
- No additional main/preload IPC or clipboard service was necessary.
- 14 browser editing/clipboard regressions passed. An earlier run timed out before creating a deck; the unchanged build reran successfully in 25.6 seconds with one worker.

## E6 translations and integration regression

- Insert command now reads Text / 文字 / 文字. Added missing clipboard, shapes, notes, zoom, font, resize, sync-health and accessibility labels across all three dictionaries.
- Static literal t() audit across production renderer TypeScript reports zero missing keys; semantic dictionary parity and required-key tests pass.
- Updated integration tests to address the currently mounted contenteditable DOM and the searchable font picker instead of old select nodes. Retained coverage of pending input, composition, undo, projection, route exit, registry activation and save/close boundaries.
- Found and fixed an additional real boundary issue: starting another text insertion now finalizes pending text before empty-box cleanup. Composition blocks that transition.
- Full suite after E5/E6/M1: 259 files, 3,091 tests passed. The subsequent run passed 3,086 tests and exposed five stale DnD mock exports; those five tests passed after updating the mock.
- Imported only used HeroUI component styles, preserving the original 5 MiB precache gate. Latest measured precache 4.85 MiB; no budget increase.

## M1 media display

- Per-folder sort/group overrides use the existing persisted settings store, schema version 3. Missing overrides inherit LINE createdAt descending/date grouping through ancestors; explicit none remains none.
- Date groups use the configured application timezone; invalid dates are collected under Unknown date. Group headers are separate virtual list rows or full-width grid rows, excluded from selection IDs.
- Sort contains the HeroUI Group submenu; extra-large uses 256 px cards and the existing thumbnail pipeline.
- List folders have plain folder icons, retaining accessible provider information and sync-health status.
- Grouped reordering cannot cross dates; folder moves retain their separate command path and do not rewrite creation dates.
- Browser verification passed for two date groups, list/grid/extra-large transitions and persisted disabled grouping. Timezone boundary, inheritance and preference tests pass.

## M2 drag verification

- Combined node refs depend on the actual stable setter functions. List/grid use verticalListSortingStrategy/rectSortingStrategy respectively. Folder center is a move target; edges are sortable insertion targets. Cancel clears drag state.
- Reproducible benchmark: scripts/benchmark-media-drag.mjs, isolated packaged profiles, 30/300 image fixtures with loaded thumbnails, three drags per count, persisted order asserted.
- Initial pre-change sample: 30 items had 79 geometry reads per run; 300 had 619. Frame p50 was 16.7 ms. The 300-item p95 values were 17.5/17.4/17.6 ms and maxima 33.4/33.7/17.6 ms. The 30-item maxima were 116.7/50.3/50.0 ms, demonstrating scheduling variability.
- After the user unlocked the Mac, foreground grid comparison completed with exact persisted order checks. Before/after p95 stayed approximately 17.3–17.6 ms and geometry reads remained 79/619. The after sample had one 250 ms cold first-drag maximum; the 300-item maxima remained around 33 ms. This does not establish a repeatable speed gain. Additional list/group samples are recorded below; grid virtualization remains contingent on evidence.

## Latest local checks

- Lint, typecheck, desktop build, web build and macOS packaged-runtime checks passed before candidate version preparation.
- Browser editing/media checks: 15 passed; responsive/zoom/touch checks: 4 passed.
- Final editor boundary unit check: 122 passed. Final translation/grouping unit check: 13 passed.
- PR CI Quality Gates 33963896194 and preview deployment 33963896239 passed on b58f8d9a. Manual packaging validation 33963909309 passed on macOS and Windows, including packaged runtime and projection smoke; its release job was intentionally skipped.
- The latest local 2.4.3 unpacked macOS build passed runtime verification and all 15 editing regressions through a temporary Electron fixture using the same browser test bodies. Font enumeration in that regression remains mocked; actual installed font discovery is checked separately.
- Manual browser menus were checked in English, Traditional Chinese and Simplified Chinese: shapes, slide clipboard, grouping and all view sizes.
- A final source audit found untranslated sync health detail tooltips; added all six labels to every locale and the required-key check.

## Delivery status

Draft PR #47 has passed CI and both platform packaging checks. No merge or 2.4.3 release has been performed yet. Implementation and automated checks have progressed through M2, and unlocked native font/geometry/projection, offline reopen and the final drag comparison are now recorded below. Earlier intermediate packages retain version 2.4.2 and use isolated QA data. The source now prepares candidate version 2.4.3; no release tag is created. Async upload Phase 2+ remains outside this task.

## Unlocked native acceptance

- Reopened the existing isolated QA deck after app restart; original Chinese text persisted.
- Native font search returned Microsoft Sans Serif without a mock. Applied it, bold, center, and 13 point size; selection and toolbar states remained correct.
- Opened actual projection: control and projection window DOM both contained the same Chinese text, Microsoft Sans Serif, 26 px rendered run size (13 point model size) and weight 700.
- Emulated offline networking in the isolated app, reloaded, reopened the deck, and asserted original text plus bold/center enabled and font-size 13. Restored networking afterward.
- macOS and Windows CI packaged projection/recovery smoke passed in workflow 33963909309.

## Foreground drag matrix

All six samples per row (30/300 items, three runs each) asserted the exact full persisted order. The harness waits for menu/drop transitions between independent samples.

| Mode         | Count | Layout reads | p95 ms    | Max ms (three runs) |
| ------------ | ----: | ------------ | --------- | ------------------- |
| Grid before  |    30 | 79           | 17.5–17.6 | 17.7/49.0/17.6      |
| Grid before  |   300 | 619          | 17.5–17.6 | 33.4/33.3/17.8      |
| Grid after   |    30 | 79           | 17.5–17.6 | 250.0/17.7/33.3     |
| Grid after   |   300 | 619          | 17.3–17.6 | 32.8/33.4/33.4      |
| List before  |    30 | 75           | 18.5–18.6 | 18.7/33.9/18.8      |
| List before  |   300 | 75           | 18.3–18.6 | 33.4/18.6/18.7      |
| List after   |    30 | 75           | 17.3–17.6 | 133.4/17.7/17.7     |
| List after   |   300 | 75           | 17.5–17.6 | 33.3/33.3/17.7      |
| Grouped list |    30 | 71           | 18.3–18.6 | 48.2/50.0/18.6      |
| Grouped list |   300 | 73           | 18.4–18.6 | 18.6/18.6/33.3      |
| Grouped grid |    30 | 79           | 18.4–18.6 | 133.7/33.3/50.0     |
| Grouped grid |   300 | 619          | 18.5–18.6 | 34.0/18.6/33.3      |

The measured p50 remained about 16.7 ms. Neither the repeated 300-item grid samples nor geometry reads demonstrate a repeatable gain from the small DnD changes. Cold first-drag spikes also occurred on 30-item samples, so the data does not support diagnosing mounted grid size as the cause. No grid virtualizer or speculative animation change was added. M2 delivers correct insertion strategy, stable refs and explicit folder-center targets; this release makes no FPS improvement claim. Further performance work requires a reproducible slow interaction trace rather than increasing scope on noisy maxima.
