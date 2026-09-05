# Presentation editor investigation — 2026-09-05

Scope: investigation only. No application source changes, release, or deployment.

## Environments and verification

- Checkout: `b7d7bef8` (`feat: improve multimedia metadata and presentation editing (#44)`).
- Fresh `npm run build:web`: passed typechecks, build, web-build checks, and bundle budgets.
- Browser: ego Chromium, fresh build on localhost; service-worker bypass enabled after discovering cached older assets.
- Installed application: `/Applications/HHC Presenter.app`, version 2.4.2. Electron probes used independent temporary `--user-data-dir` directories and closed their own application processes afterward.
- Installed PowerPoint: 16.112.3. Its current UI was inspected without modifying the user's presentation; native gesture parity was not exhaustively tested.
- The prior turn's 82 focused unit tests passed, but do not establish real editing correctness.

## Confirmed text-input and deletion defects

Browser reproduction:

1. Create a presentation and a text box.
2. Insert `abc` with real browser text input. Immediately afterward the caret offset is 3.
3. After the scheduled render, the caret offset is 0 at a DIV.
4. Insert `def`; actual content becomes `defabc` and the caret returns to offset 0.
5. Select the text contents and send a real Backspace key event.
6. The application error boundary displays: `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`

A MutationObserver recorded the browser removing a SPAN and inserting BR nodes before the error. Installed Electron independently reproduced misordered text (`fedbca` when typing `abcdef` across renders) and the same deletion error.

The source path is `EditableSlideSurface.tsx`: `onInput` schedules `commitText`, updates paragraphs/runs, and React reconciles children inside the same contentEditable that the browser edits. The first plain-text input also changes the React child structure into rich paragraphs/spans. `suppressContentEditableWarning` does not establish DOM ownership.

Required correction: single ownership of the editable subtree; synchronize the document without reconciling browser-owned text on every keystroke. Preserve selection through deliberate formatting/undo DOM updates. IME composition still needs a real IME regression gate.

## Confirmed formatting lifecycle defects

`updateSelectedTextElement -> updateSelectedElement -> commitDocument -> finalizeDocumentMutation -> finalizeTextEditor` ends text editing, including for buttons that prevent mouse focus changes. Ending editing clears `textSelection`.

Collapsed selections produce no overlap in `getCharacterStyleValue`, so the toolbar falls back to the box's default style. Font family, font size, color, baseline, and alignment also read box-level values rather than a consistent selection-derived snapshot.

Use character-range/caret, paragraph, object, and slide scopes. Toolbar formatting must not finish the text-edit session. Empty-new-box cleanup must only run on a real editing exit, not on font/color popup focus. Do not persist DOM Range objects or duplicate button booleans.

## Clipboard: confirmed routing gap, original physical-key report not fully reproduced

- Browser Cmd+C then Cmd+V on a focused slide thumbnail: 1 slide became 2.
- Installed Electron Playwright keyboard Cmd+C/V: 1 slide became 2.
- Installed Electron `webContents.sendInputEvent` with meta+C/V: 1 slide became 2.
- Installed Electron native `webContents.copy()` / `paste()`: 1 slide remained 1; captured `copy` and `paste` events, with no `keydown`.
- Electron's default Edit menu includes native Copy/Cut/Paste roles with CommandOrControl accelerators.

The editor handles keydown but does not unify native clipboard-command events with slide/element commands. This is a proven gap in native menu behavior, not proof that every reported physical keyboard failure used that path. Physical macOS accelerator routing, alternate focus targets, and overlay states remain acceptance cases. Do not intercept native text clipboard behavior while editing text.

## Local fonts: verified source difference

Installed Electron `queryLocalFonts()` returned 252 unique families, including `Microsoft Sans Serif`; Calibri, Cambria, and Aptos were not in that result. macOS `system_profiler SPFontsDataType` likewise had Microsoft Sans Serif and did not list PowerPoint's DFonts directory.

PowerPoint's own `Contents/Resources/DFonts` contains Calibri.ttf and Cambria variants, among many others. Therefore the Office-versus-system font difference is present on this machine. A font-family name does not necessarily contain the vendor name. Do not promise that improving the picker automatically makes Office-private fonts available to Electron.

A searchable picker should distinguish document fonts, available fonts, and unavailable fonts with substitution. Automatic extraction/distribution of Office font files is not part of this investigation.

## Dragging: installed-app controlled measurements

Synthetic text-file records were inserted only in independent temporary application profiles. Medium-icon grid, real pointer drag over 60 steps, same viewport, three repetitions at each size. Geometry-call counting instrumentation was identical between cases. Frame intervals are requestAnimationFrame samples, not an isolated CPU attribution.

| Items | Geometry reads, runs 1–3 | Median frame, each run | p95 frame, runs 1–3 | Max frame, runs 1–3 |
| --- | --- | --- | --- | --- |
| 30 | 79 / 79 / 79 | 16.7 ms | 16.8 / 17.3 / 16.8 ms | 17.4 / 17.4 / 17.4 ms |
| 300 | 619 / 621 / 619 | 16.7 ms | 17.5 / 17.0 / 16.8 ms | 50.1 / 33.3 / 50.0 ms |

An initial separate 300-item run had a 116.6 ms maximum frame, 619 geometry reads, and 1,509 style mutations. The repeated comparison shows item-count-dependent intermittent stalls rather than sustained low frame rate. An ego-browser timing sample had large scheduling delays and was excluded from these timing conclusions.

The current grid mounts all items. Source inspection also found a combined ref depending on the complete sortable/droppable objects, overlapping reorder and folder-drop targets, and no explicit list/grid-specific sorting strategy. These are intervention candidates; the measurements do not isolate one of them as the sole cause. Evaluate a small change with this same comparison before claiming a performance fix. Large image thumbnails, synced folders, list-mode virtualization, and physical dragging remain additional cases.

## Compatibility decisions

- Default new text boxes to content-driven height, but preserve imported fixed-height/AutoFit behavior. PowerPoint itself supports multiple AutoFit modes; globally removing fixed height is not native parity.
- Keep selection while using formatting controls; clear abandoned empty new boxes only on a real exit.
- Keep character and paragraph formatting scoped independently, including mixed states and caret typing style.
- Unify native menu, keyboard, and context-menu command routing without executing a command twice.
- Grouping by date must not rewrite creation timestamps during a drag. Explicit folder sorting/grouping preferences override provider defaults.
- Re-measure text after font availability, font size, wrapping, or paragraph metrics change; do not use a single-line height approximation for mixed runs.

## References

- React contentEditable/children warning: https://react.dev/reference/react-dom/components/common
- PowerPoint for Mac text sizing: https://support.microsoft.com/en-us/office/graphics-visuals/set-text-direction-and-position-in-a-text-box-or-shape-in-office-for-mac
- Office cloud fonts: https://support.microsoft.com/en-us/office/cloud-fonts-in-office-f7b009fe-037f-45ed-a556-b5fe6ede6adb

No claim of a completed fix, complete native parity, or full installed-device acceptance is made.
