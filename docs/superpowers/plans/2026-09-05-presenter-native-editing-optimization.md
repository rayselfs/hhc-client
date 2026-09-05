# Presenter Native Editing and Media Explorer Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch agents unless separately requested.

**Goal:** Make presentation editing predictable and close to desktop PowerPoint, fix typing/deletion first, and improve media browsing without increasing unnecessary background work.

**Architecture:** Retain the existing presentation model, session/history, shared rich-text helpers, Zustand persistence, HeroUI, dnd-kit, and media queues. Establish one owner for editable text DOM; derive toolbar state from the active scope. Date grouping is a view of existing creation timestamps, not a new storage hierarchy.

**Tech Stack:** React 19, TypeScript, Electron, IndexedDB, Zustand, HeroUI v3, Vitest, Playwright.

**Spec:** [Verified investigation](../../reports/2026-09-05-presentation-editor-investigation.md), the user's 2026-09-05 numbered requirements, and the accepted native-PowerPoint direction. [Meeting/LINE consolidated plan](/Users/rayselfs/Projects/hhc/website/docs/superpowers/plans/2026-09-05-async-file-upload-line-fast-sync-consolidated.md) is independently deliverable.

## Global constraints and precedence

- Initial document was planning-only. The user subsequently authorized implementation after LINE Phase 1, required CI, merge and one combined HHC Presenter 2.4.3 release. Do not publish the earlier sync-only release-preparation PR separately.
- Implement from fresh origin/main in a new isolated worktree. Preserve existing worktrees and the untracked 2026-09-04 plan.
- This plan supersedes the old plan's requirement that dragging north/south converts a new content-height text box to fixed height. Do not replay completed old tasks.
- New text boxes default to content-driven height and user-controlled width. Preserve imported PPTX fixed-height/AutoFit semantics; do not rewrite all imported geometry on load.
- No new editor framework, global event bus, clipboard service, font package, or DnD library by default.
- Character formatting, paragraph formatting, object transforms, and slide commands have different scopes. Runtime selection is not persisted. Toolbar state is derived, not separately stored for every button.
- Font/color popup focus remains inside the editing interaction. Leaving the text box for another object/slide/navigation is a real exit. IME composition cannot be interrupted by serialization or cleanup.
- Retain authorization, malware-clean gates, projection ownership, cancellation/account-switch fences, and persisted offline preferences.
- New persistent preferences use hhcPersistStorage/createPersistName, partialize, and a versioned migration.
- English code/comments; complete en/zh-TW/zh-CN UI, tooltip, menu, error, and accessibility messages.

## File ownership and deliverables

| Task | Principal files                                                                                                                                                                     | Outcome                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| E1   | components/Common/EditableSlideSurface.tsx; existing surface tests; e2e/presentation-text-editing.spec.ts (new)                                                                     | Stable typing, deletion, selection, IME lifecycle            |
| E2   | pages/PresentationWorkspacePage.tsx; lib/presentation-rich-text.ts; components/Control/Presentation/PresentationHomeRibbon.tsx; PresentationColorPalette.tsx                        | Scope-correct formatting and toolbar state                   |
| E3   | lib/local-fonts.ts; PresentationHomeRibbon.tsx; lib/font-loader.ts where needed                                                                                                     | Searchable font selection and honest availability            |
| E4   | EditableSlideSurface.tsx; PresentationWorkspacePage.tsx; lib/presentation-editor-commands.ts                                                                                        | Text geometry, abandoned-box cleanup, native-looking handles |
| E5   | PresentationWorkspacePage.tsx; main/index.ts; shared/ipc-channels.ts and preload only if native menu IPC is required                                                                | Consistent slide/object clipboard and thumbnail selection    |
| E6   | locales/en.json, zh-TW.json, zh-CN.json; i18n tests; affected components                                                                                                            | Complete translations and Text label                         |
| M1   | components/Control/FileExplorer/views/ListView.tsx, GridView.tsx; SortDropdown.tsx; FileBrowser.tsx; stores/file-explorer.ts; shared/types/folder.ts; existing header view selector | Folder icons, date grouping, LINE defaults, extra-large view |
| M2   | FileBrowser.tsx and views; e2e/media-explorer-drag.spec.ts (new)                                                                                                                    | Measured reduction in grid drag stalls                       |

Paths above are relative to src/renderer/src unless prefixed main, shared, preload, or e2e. Resolve those against src or repository root respectively. Keep normal existing page size; split only the editing DOM owner if a separate component is necessary to prevent reconciliation.

## E1 — Fix editable DOM ownership first

- [ ] Add a browser regression using a newly created deck via existing New/Create Presentation UI. Capture page errors and error-boundary text, not only input events.
- [ ] Assert the current reproduction before changing code:

```ts
await textBox.pressSequentially('abc', { delay: 40 })
await textBox.pressSequentially('def', { delay: 40 })
await expect(textBox).toHaveText('abcdef')
await textBox.press('Home')
await textBox.press('ArrowRight')
await textBox.pressSequentially('X', { delay: 40 })
await expect(textBox).toHaveText('aXbcdef')
```

- [ ] Add whole-text deletion, cross-run Backspace, Enter, and browser/installed-Electron reproduction of the exact removeChild failure. Define textBox from `.presentation-stage [data-text-content][contenteditable="true"]`; create the deck in the spec using e2e/helpers.ts onboarding and the existing creation flow.
- [ ] Give the editable subtree a single owner. Render initial content on editing entry; input updates the draft model without React reconciling that same subtree. Non-editing preview/projection remains declarative.
- [ ] For external changes (format, undo/redo), preserve a logical selection with element ID, anchor/focus offsets, direction, and revision validity; restore after the deliberate DOM update. Do not hold stale DOM nodes across replacements.
- [ ] Preserve plain-text/rich-run normalization and existing paste serialization. Do not insert arbitrary clipboard HTML without the current allowed-style projection.
- [ ] Run focused surface/rich-text tests and the browser regression. Manually exercise a real Chinese IME in Electron; synthetic composition events alone are insufficient. Commit only E1 when these pass.

## E2 — One formatting command path with derived state

**Consumes:** E1 selection lifecycle, normalizeTextParagraphs/applyCharacterStyle/mapSelectedParagraphs/resolveTypingStyle, existing session draft/history.

- [ ] Add tests for five selected characters, collapsed caret at both sides of a bold run, mixed runs, paragraph boundaries, and whole-box selection.
- [ ] Make getCharacterStyleValue resolve collapsed-caret style explicitly (including pending typing style), instead of falling back to the last whole-box patch.
- [ ] Route toolbar and Cmd/Ctrl+B/I/U to the same character/paragraph command functions. Flush pending DOM input before computing the mutation against the latest draft; formatting must not call the ordinary finish-edit path.
- [ ] Derive font family/size/color/highlight/baseline/spacing and all toggles from the range or caret. Derive alignment/list/indent/line spacing from touched paragraphs. Whole-box selection summarizes all paragraphs/runs; mixed selection is not falsely shown as off or as the first value.
- [ ] Keep a formatting action as a distinct undoable change; ordinary typing keeps current coalescing. Do not persist every selectionchange.
- [ ] Preserve the selection while popups are open and restore it on apply/cancel; if native selection paint disappears while focus is in a popup, render only the retained selection highlight necessary for continuity. Maintain keyboard access to popup inputs.

```ts
await expect(page.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute(
  'aria-pressed',
  'true'
)
expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('abcde')
```

- [ ] Verify the same assertions after reopening the box and after Undo/Redo. Test center alignment, bullets, numbering, Enter continuation/empty-list exit, Tab/Shift+Tab, and selection ending exactly at the next paragraph start. Commit E2.

## E3 — Font picker with available/document/recent fonts

- [ ] Replace the long select with an existing HeroUI searchable combobox/popover; use installed v3 APIs and existing local-font discovery. Keep exact family values separate from display labels.
- [ ] Include families from document paragraph runs, not only the selected element's default. Display document fonts, recent choices, and local fonts without duplicates; show missing fonts/substitution honestly.
- [ ] Show font-name previews; support keyboard navigation, type-to-search, arbitrary valid font size, and mixed values. Reject non-finite/non-positive sizes at the command boundary and retain model bounds.
- [ ] Keep permission failure retryable; show loading/unsupported/unavailable states. Do not extract or redistribute Office-private fonts as a shortcut.
- [ ] Load the chosen font before final text measurement; ensure projection uses the same loaded family/fallback. Re-measure content-height boxes when actual font availability changes.
- [ ] Verify selection survives choosing a font and an entered size (for example 13 pt, absent from the current fixed list):

```ts
expect(Number.isFinite(requestedPoints) && requestedPoints > 0).toBe(true)
expect(selectedTextBefore).toBe(selectedTextAfter)
```

- [ ] Run local-font and ribbon tests plus browser/Electron UI checks; include Microsoft Sans Serif and an unavailable document family. Commit E3.

## E4 — Text-box lifecycle and selection chrome

- [ ] Track the ID of a just-created, not-yet-populated box only in the editor session. On real exit, remove it if semantically empty (browser BR/zero-width placeholders excluded); do not delete imported placeholders or a pre-existing intentionally empty box.
- [ ] Treat Enter/Escape, navigation, pointer transforms, and toolbar focus consistently. A popup opened to choose font before typing must not delete the new box. Coalesce abandoned creation/removal so undo does not leave ghost objects.
- [ ] Keep content height derived from rendered text, padding, wrapping, font sizes and paragraph spacing. Width drag and keyboard resize must not switch a new content-height box to fixed height.
- [ ] Preserve imported fixed-height text; define visible handle behavior per AutoFit mode. Avoid active-looking vertical resize handles where the mode does not permit manual height.
- [ ] Change outline to a thin neutral line, white square handles with gray border/subtle shadow, and scale-invariant visible size; retain usable transparent hit targets. Add a functional rotation handle using the existing rotation field and transform session; pointer/keyboard undo is one transform.

```ts
expect(resized.autoSize).toBe('content')
expect(resized.width).not.toBe(original.width)
expect(await countElementsAfterAbandon()).toBe(countBeforeInsert)
```

The last assertion is a UI-test readback of slide element count, not a new production helper. Test narrow/wide boxes, multi-line text, rotated boxes, dark/light backgrounds, and zoom. Commit E4.

## E5 — Slide selection and native command routing

- [ ] Remove selected ring/background from the outer slide row containing the number; keep selection on the thumbnail. Keep accessible option selection and a separate keyboard focus indicator.
- [ ] Use active interaction scope (text/object/slides) when resolving commands. Preserve existing cross-tab slide snapshots/assets and insertion indices; do not overwrite the user's OS clipboard merely to support internal slide copy.
- [ ] Handle Electron native Edit-menu commands in addition to keydown. Choose one authoritative dispatch per event/command and prevent duplicates. Native text copy/cut/paste must continue inside editable text and inputs.
- [ ] Test Cmd and Ctrl paths; native menu Copy/Cut/Paste; focused slide, divider, canvas, object, popup; cross-tab paste; source-tab close; immediate cut+undo; right-click of selected/unselected slide.

```ts
expect(slideCountAfterCopyPaste).toBe(slideCountBefore + selectedSlideCount)
expect(slideCountAfterNativeMenuPaste).toBe(slideCountAfterCopyPaste + selectedSlideCount)
```

- [ ] Verify on actual macOS accelerator input as well as Playwright/CDP; the investigation proved a native-menu gap, not every physical-key failure. Commit E5.

## E6 — Translation completeness

- [ ] Change the insertion command to `Text` / `文字` / `文字`; keep the domain term text box where it describes an object.
- [ ] Fix missing common.copy/cut/paste and rectangle/ellipse/line keys. Audit static and dynamic t() calls, fallbacks, hardcoded JSX, tooltips, notifications, shape/color menus, accessibility names, notes and zoom.
- [ ] Include the mixed-language `menu` suffix and hardcoded slide-divider labels observed in the live editor. Reuse existing matching translations where their meaning is identical.
- [ ] Extend existing i18n tests to cover required keys in all three dictionaries; compare semantic key sets rather than failing on intentional identical symbols/font names.

```ts
for (const locale of [en, zhTW, zhCN]) {
  expect(locale.common.copy).toBeTruthy()
  expect(locale.common.cut).toBeTruthy()
  expect(locale.common.paste).toBeTruthy()
}
```

- [ ] Run i18n tests and inspect all three languages in the presentation and media menus. Commit E6.

## M1 — Media grouping, defaults and view size

- [ ] Remove provider overlays only from list folder icons; retain required sync-health indicators and accessible source information.
- [ ] Add `GroupMode = 'none' | 'date'` and a per-folder display override to the existing settings store, with versioned migration and only preferences in partialize. An absent override inherits provider defaults; an explicit none must stay none.
- [ ] LINE sync roots and descendants default to createdAt descending plus date grouping. Ordinary/OneDrive/local-sync folders keep current defaults; do not reset saved choices on every navigation.
- [ ] Put Group at the bottom of Sort after a separator; use the existing HeroUI submenu pattern, keyboard navigation and viewport flipping. Include None and Date.
- [ ] Group by local calendar day of existing createdAt in the app's configured timezone, label YYYY/MM/DD, add date header and separator. Missing/invalid dates go to a translated Unknown date group. Each group retains deterministic item order and folder/file policy.
- [ ] Represent group headers in the existing list virtualizer row model; grid headers span columns. Keep Shift-selection/navigation based on item IDs, excluding headers.
- [ ] Add `extra-large-icon` to FileExplorerViewMode and all exhaustive view switches, using the existing grid/thumbnail pipeline; initial card width 256px, then verify real thumbnails/viewport fit.
- [ ] With grouping active, reorder only within a date group; moving into a folder remains distinct. Cross-date drag must not mutate timestamps. Group mode itself does not create folders.

```ts
expect(explicitUngroupedPreference.groupMode).toBe('none')
expect(lineFolderWithoutOverride).toMatchObject({
  groupMode: 'date',
  sortField: 'createdAt',
  sortDir: 'desc'
})
```

- [ ] Test midnight/timezone boundaries, migration, provider descendants, new incoming LINE items, list/grid/extra-large view, and synced read-only-folder rules. Commit M1.

## M2 — Reduce measured drag stalls

- [ ] Repeat the report's 30/300-item benchmark in installed Electron with comparable hardware/window size; include real image thumbnails and grouped/list views. Record frame p50/p95/max, layout reads, and effective order; do not claim foreground FPS from throttled background automation.
- [ ] Stabilize combined refs around the actual setNodeRef functions, not the full sortable/droppable objects. Give list/grid the appropriate installed dnd-kit sorting strategy; verify virtualized list behavior.
- [ ] Separate folder center drop-to-move from edge insertion-to-reorder so target intent does not oscillate. Retain DragOverlay and commit order only at drop.
- [ ] Re-measure before adding further work. If the mounted 300-item grid still dominates, apply the already-installed virtualizer to grid rows, including group headers and drag overscan; do not add a dependency.
- [ ] Preserve multi-select, scroll drag, keyboard operations, cancellation, read-only folders, and native OS file drop. Validate the final stored order, not just the animation.

```ts
expect(actualOrder).toEqual(expectedOrder)
expect(await readCreatedAt(itemId)).toBe(originalCreatedAt)
```

- [x] Compare at least three runs against the 300-item baseline and record small-list results. The unlocked comparison did not demonstrate a repeatable FPS gain; record that limitation instead of claiming the original reduction target was achieved. Keep grid virtualization conditional: the current evidence does not show mounted grid size dominating. See the verification report for all before/after and grouped/list samples.

## Integration and delivery gates

- [ ] E1 -> E2 -> E3/E4/E5 -> E6. M1 -> M2; do not tune drag against a layout that will immediately be replaced by grouping.
- [ ] Run `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`, `npm run build:web`, affected browser tests, and Electron editing/IME/native-command smoke. Follow repository CI requirements before merge.
- [ ] Verify projection parity, offline availability, autosave recovery and source imports after editing changes. Media view work must not block or duplicate sync/download jobs.
- [ ] Keep release/package/installed-device evidence separate. Release and installation occur only within later explicit execution scope via GitHub Actions.

## Requirement coverage

Presentation 1 -> E5; 2 -> E1/E2; 3 -> E3; 4 -> E4; 5 -> E1; 6/7 -> E4; 8/9 -> E6; 10 -> E5; 11 -> E2/E4/E5 and integration gates.

Media 1 -> M1; 2/3/4 -> M1; 5 -> M2. The original upstream creation-time normalization already landed in #44 and is reused, not reimplemented.

## Execution evidence

Implementation and acceptance results are recorded in [2.4.3 verification](../../reports/2026-09-05-presenter-native-243-verification.md). M2 performance acceptance was narrowed based on measured evidence: correct deterministic ordering is verified, while a repeatable FPS gain is not claimed. No speculative virtualization or animation change is included.
