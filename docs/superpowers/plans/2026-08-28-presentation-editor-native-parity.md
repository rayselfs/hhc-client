# Presentation Editor Native-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editable Presentation workspace behave predictably like PowerPoint for the supported text-box, viewport, ribbon, local-font, shortcut, notes, zoom, and account-avatar capabilities.

**Architecture:** Preserve the existing editable-presentation document model and distinguish content-sized freeform text from fixed imported PPTX frames using the existing `autoSize` and `autoWidth` fields. Keep viewport geometry in one small pure helper, keep editor commands in the existing workspace/session, and reuse Chromium Local Font Access rather than adding a native font dependency. Fix shared workspace sizing and CSP at their existing common boundaries.

**Tech Stack:** Electron 41, Chromium renderer, React 19, TypeScript, Zustand/session history, HeroUI v3, Tailwind CSS v4, Vitest/Testing Library, Playwright, electron-vite

**Spec:** `docs/superpowers/plans/2026-08-28-presentation-editor-native-parity.md` — the Requirements and Decisions section below is the approved conversation-derived specification.

## Requirements and Decisions

| Area | Required outcome |
| --- | --- |
| Text-frame movement | Hovering a selected text-frame edge shows a move cursor; dragging the edge moves the complete frame. The editable interior remains a text cursor and never starts a move. |
| Text sizing | Newly created freeform text has content-driven height. Click insertion uses auto-width plus auto-height; drag insertion and later horizontal resize use fixed-width plus auto-height. Imported fixed PPTX frames remain fixed. |
| Resize handles | Content-height text frames expose six handles: top/middle/bottom on the left and right. No top-center or bottom-center handle appears. Fixed imported frames retain eight handles. |
| IME and typing | Chinese IME composition commits only after the composed DOM value settles. English and Chinese input must not visibly wrap to a temporary second line before width catches up. |
| Text insets | New/freeform text uses 8 canvas px left/right and 4 canvas px top/bottom internal padding. Measurement includes those insets. |
| Notes and zoom | Notes and zoom remain visible in a newly created editable deck at 1470×726 and smaller supported viewports. Fit mode reacts to viewport and Notes height. Custom zoom scrolls when the canvas exceeds the viewport. |
| Ribbon | Home follows the supported subset of native PowerPoint ordering and density. Visual group captions are removed while accessible group names remain. Raw X/Y/W/H controls leave Home. The duplicate Text tab is removed. |
| Fonts | The font picker enumerates installed families with `queryLocalFonts()` after a user gesture, caches a successful result for the current app lifetime, and never claims unavailable fonts. `PMingLiU`, `MingLiU`, and `DFKai-SB` appear only when actually installed. |
| Shortcuts | Supported editor commands use PowerPoint-familiar Windows/macOS bindings. macOS and Windows both accept Ctrl+wheel for zoom; macOS additionally accepts Command+wheel. |
| Avatar CSP | Google account avatars from `https://lh3.googleusercontent.com` load in web and Electron builds without broadening `img-src` to arbitrary HTTPS origins. |

## Explicit Non-Goals

- Do not implement full PowerPoint parity, themes, transitions, animations, tables, SmartArt, add-ins, Designer, or sections.
- Do not add fake or disabled ribbon commands for unsupported features such as Layout, Reset, bullets, numbering, or vertical text alignment.
- Do not introduce per-character rich-text editing in this change. Existing imported `runs` rendering remains supported; editing a mixed-run frame continues to flatten it and must be documented in the manual QA notes.
- Do not add a native font-enumeration package, copy font files, persist font metadata, or expose filesystem font paths to the renderer.
- Do not add a custom resizable Notes splitter; the existing fixed-height Notes pane is sufficient once it participates correctly in viewport measurement.
- Do not push, open a PR, merge, version-bump, tag, release, or deploy without separate authorization.

## Global Constraints

- At execution time, create an isolated worktree and a `fix/` branch from the latest `origin/main`; never implement directly on `main`.
- Preserve browser/Electron dual-mode behavior and existing presentation session/history boundaries.
- Keep changes surgical: reuse `autoSize`, `autoWidth`, `useKeyboardShortcuts`, `SHORTCUTS`, `ResponsivePanelGroup`, and `queryLocalFontFamilies`.
- Do not add dependencies or persistence migrations.
- Keep imported `autoSize: 'fixed'` text geometry unchanged.
- Keep selection chrome and pointer targets visually stable across zoom levels.
- Follow RED-GREEN-REFACTOR for each task and commit only after its focused checks pass.

## File Map

| File | Responsibility in this plan |
| --- | --- |
| `src/renderer/src/components/Common/WorkspacePrimitives.tsx` | Make the shared grid stage slot constrain its `StageViewport` child. |
| `src/renderer/src/assets/main.css` | Shared stage-slot sizing rule and compact ribbon styling only where CSS is already shared. |
| `src/renderer/src/components/Common/EditableSlideSurface.tsx` | Frame-edge interaction, handles, content sizing, padding, IME timing, and screen-stable selection chrome. |
| `src/renderer/src/lib/editable-presentation.ts` | Define click/drag text insertion semantics without a schema migration. |
| `src/renderer/src/lib/presentation-viewport.ts` | New pure fit-zoom and anchored-scroll calculations. |
| `src/renderer/src/pages/PresentationWorkspacePage.tsx` | Notes/zoom state, Ribbon composition, local-font trigger, and supported editor actions. |
| `src/renderer/src/lib/local-fonts.ts` | Cache successful installed-family enumeration for the app lifetime. |
| `src/renderer/src/config/shortcuts.ts` | Platform-specific Presentation editor shortcut definitions. |
| `src/renderer/index.html` | Narrow Google avatar CSP allowlist. |
| Existing adjacent `__tests__` and `e2e/responsive-workspaces.spec.ts` | Behavioral and visual regression coverage. |

---

### Task 1: Constrain the Shared Presentation Stage and Restore the Bottom Bar

**Files:**

- Modify: `src/renderer/src/components/Common/WorkspacePrimitives.tsx:151-160`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`
- Modify/Test: `e2e/responsive-workspaces.spec.ts`

**Interfaces:**

- Consumes: `ResponsivePanelGroup({ stage })`
- Produces: `.workspace-stage-slot` as a flex containing block whose `StageViewport` child cannot exceed the grid row
- Preserves: navigator and inspector breakpoint behavior

- [ ] **Step 1: Add a failing structural unit assertion**

  Extend the existing shared-shell test to require the stage slot to be a flex containing block:

  ```tsx
  const stageSlot = group!.querySelector('.workspace-stage-slot')
  expect(stageSlot).toHaveClass('flex')
  expect(stageSlot?.querySelector('.presentation-stage')).toHaveClass('min-h-0', 'flex-1')
  ```

- [ ] **Step 2: Run the focused unit test and confirm RED**

  ```bash
  npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  ```

  Expected: FAIL because `.workspace-stage-slot` is currently `display:block`.

- [ ] **Step 3: Apply the one-boundary layout fix**

  Change the slot in `ResponsivePanelGroup` to:

  ```tsx
  <div className="workspace-stage-slot flex min-h-0 min-w-0">{stage}</div>
  ```

  Do not add absolute positioning or Presentation-specific height calculations.

- [ ] **Step 4: Add the real-viewport regression**

  In `responsive-workspaces.spec.ts`, after creating the editable presentation, test the reproduced 1470×726 viewport:

  ```ts
  await page.setViewportSize({ width: 1470, height: 726 })
  const stageSlot = page.locator('.workspace-stage-slot')
  const stage = page.locator('.presentation-stage')
  const notes = page.getByRole('button', { name: /Toggle Notes|切換備忘稿/ })
  const zoom = page.getByRole('button', { name: /Reset zoom|重設縮放/ })

  await expect(notes).toBeVisible()
  await expect(zoom).toBeVisible()

  const [slotBox, stageBox] = await Promise.all([stageSlot.boundingBox(), stage.boundingBox()])
  expect(stageBox!.height).toBeLessThanOrEqual(slotBox!.height)
  expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(726)
  ```

- [ ] **Step 5: Verify and commit**

  ```bash
  npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  npx playwright test e2e/responsive-workspaces.spec.ts --grep "editable presentation"
  git add src/renderer/src/components/Common/WorkspacePrimitives.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx e2e/responsive-workspaces.spec.ts
  git commit -m "fix: constrain presentation stage height"
  ```

### Task 2: Model Freeform Text as Fixed-or-Auto Width with Content Height

**Files:**

- Modify: `src/renderer/src/lib/editable-presentation.ts:47-53,74-88,382-411`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`
- Modify: `src/renderer/src/components/Common/EditableSlideSurface.tsx:72-83,172-205,559-593,742-807`
- Test: `src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx`
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx:820-853`

**Interfaces:**

- Consumes: existing `EditableTextElement.autoSize?: 'content' | 'fixed'` and `autoWidth?: boolean`
- Produces: `EditableTextInsertFrame.autoWidth: boolean`
- Semantics: `autoSize === 'content'` means content-driven height; `autoWidth === true` independently means content-driven width
- Preserves: imported `autoSize === 'fixed'` frames and serialized document compatibility

- [ ] **Step 1: Add failing insertion-semantics tests**

  Update click and drag expectations:

  ```ts
  expect(clickFrame).toEqual({
    x: 200,
    y: 100,
    width: 24,
    height: 32,
    autoSize: 'content',
    autoWidth: true
  })

  expect(dragFrame).toEqual({
    x: 200,
    y: 100,
    width: 80,
    height: 40,
    autoSize: 'content',
    autoWidth: false
  })
  ```

  Add a model test proving that `createTextElement({ autoSize: 'content', autoWidth: false })` preserves fixed width while remaining content-height.

- [ ] **Step 2: Verify RED**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/editable-presentation.test.ts \
    src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
  ```

  Expected: drag insertion currently returns `autoSize: 'fixed'`, and the insert frame has no `autoWidth` field.

- [ ] **Step 3: Separate width and height semantics without a migration**

  Extend the existing insert-frame type:

  ```ts
  export interface EditableTextInsertFrame {
    x: number
    y: number
    width: number
    height: number
    autoSize: EditableTextAutoSize
    autoWidth: boolean
  }
  ```

  Click insertion returns `autoSize: 'content', autoWidth: true`; drag insertion returns `autoSize: 'content', autoWidth: false`. Pass both values through `addTextElement()` to `createTextElement()`.

- [ ] **Step 4: Make content-height resize horizontal-only**

  Use separate handle sets:

  ```ts
  const CONTENT_TEXT_HANDLES: ResizeHandle[] = ['nw', 'w', 'sw', 'ne', 'e', 'se']
  const FIXED_TEXT_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  ```

  For `autoSize === 'content'`, `calculateTextResize()` changes only `x` and `width`; it never changes `y` or `height`. A horizontal resize sets `autoWidth: false` and preserves `autoSize: 'content'`. Fixed imported frames retain the current two-axis resize behavior.

- [ ] **Step 5: Replace conflicting handle tests**

  Replace the current eight-handle/free-height assertions with:

  ```tsx
  expect(screen.getAllByLabelText(/Resize text box/)).toHaveLength(6)
  expect(screen.queryByLabelText('Resize text box top')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Resize text box bottom')).not.toBeInTheDocument()
  ```

  Drag the right-middle handle and assert width changes, height does not appear in updates, `autoWidth` becomes false, and `autoSize` remains `content`. Add a fixed imported-frame case that still renders eight handles.

- [ ] **Step 6: Verify and commit**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/editable-presentation.test.ts \
    src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  git add src/renderer/src/lib/editable-presentation.ts src/renderer/src/lib/__tests__/editable-presentation.test.ts src/renderer/src/components/Common/EditableSlideSurface.tsx src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  git commit -m "fix: keep freeform text height content-driven"
  ```

### Task 3: Give Text Frames a Dedicated Move Edge and Screen-Stable Selection Chrome

**Files:**

- Modify: `src/renderer/src/components/Common/EditableSlideSurface.tsx:84-170,395-445,460-632,828-841,933-980`
- Test: `src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx`

**Interfaces:**

- Consumes: current `surfaceScale`, `startDrag(event, element, 'move')`, and resize pointer handlers
- Produces: four `data-text-frame-edge` pointer targets and screen-stable handle geometry
- Preserves: contentEditable interior pointer and caret behavior

- [ ] **Step 1: Add failing interaction tests**

  Assert that selected text exposes four edge targets, the edge uses `cursor-move`, and the content interior uses `cursor-text`:

  ```tsx
  const leftEdge = screen.getByTestId('text-frame-edge-left')
  expect(leftEdge).toHaveClass('cursor-move')
  expect(screen.getByRole('textbox')).toHaveClass('cursor-text')
  ```

  Drag the edge and require one pointer transform transaction. Pointer-down in the interior must not call `onTransformStart`.

- [ ] **Step 2: Verify RED**

  ```bash
  npx vitest run src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
  ```

  Expected: movement currently depends on a 6 px bubbling hit test inside the text content and does not expose an edge with a move cursor.

- [ ] **Step 3: Render four edge-only pointer targets**

  Pass `surfaceScale` into `SlideElement` and `ElementHandles`. For selected editable text, render four absolute edge strips above the text content but below resize handles. Convert the desired 6 screen px hit target into canvas coordinates:

  ```ts
  const edgeSize = TEXT_FRAME_HIT_AREA / surfaceScale
  ```

  Each strip sets `cursor-move` and calls the existing move pointer handler. Do not render a full-cover overlay because it would block caret placement.

- [ ] **Step 4: Remove the implicit text-border bubbling contract**

  Delete `isTextFramePointer()` from the editable-content pointer path. The content always stops propagation and starts/continues text editing; only the dedicated edges initiate movement.

- [ ] **Step 5: Keep selection chrome constant in screen pixels**

  Replace fixed canvas-size `size-4` handles with inline dimensions derived from `surfaceScale`:

  ```ts
  const handleSize = 12 / surfaceScale
  const borderWidth = 1.5 / surfaceScale
  ```

  Apply the same inverse-scale principle to the visible selection frame width. Add tests at scales `0.5`, `1`, and `2` asserting the computed canvas size multiplied by scale remains 12 screen px.

- [ ] **Step 6: Verify and commit**

  ```bash
  npx vitest run src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
  git add src/renderer/src/components/Common/EditableSlideSurface.tsx src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
  git commit -m "fix: separate text editing from frame movement"
  ```

### Task 4: Make Auto-Sizing IME-Safe and Add Text Insets

**Files:**

- Modify: `src/renderer/src/components/Common/EditableSlideSurface.tsx:74-80,764-807,843-980`
- Test: `src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx`
- Modify/Test: `e2e/responsive-workspaces.spec.ts`

**Interfaces:**

- Produces: `TEXT_PADDING_X = 8`, `TEXT_PADDING_Y = 4`
- Produces: one scheduled text measurement per animation frame
- Consumes: `autoSize === 'content'` for height and `autoWidth === true` for width
- Preserves: 750 ms session history grouping in `previewTextElement()`

- [ ] **Step 1: Add failing padding and width/height measurement tests**

  Update the mock measurement so the expected geometry includes 16 px horizontal and 8 px vertical insets. Assert the content uses border-box sizing and explicit padding:

  ```tsx
  expect(screen.getByRole('textbox')).toHaveStyle({
    boxSizing: 'border-box',
    padding: '4px 8px'
  })
  ```

  Add a fixed-width/content-height case: width is omitted from the update while height tracks `scrollHeight + 8`.

- [ ] **Step 2: Add a failing deferred-composition test**

  Mock `requestAnimationFrame`, fire `compositionend`, and assert no commit occurs until the scheduled frame runs:

  ```ts
  fireEvent.compositionEnd(textBox)
  expect(handleUpdate).not.toHaveBeenCalled()
  act(() => flushAnimationFrame())
  expect(handleUpdate).toHaveBeenCalledWith(
    slideId,
    text.id,
    expect.objectContaining({ text: '中' })
  )
  ```

- [ ] **Step 3: Verify RED**

  ```bash
  npx vitest run src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
  ```

- [ ] **Step 4: Schedule DOM readback and measurement once per frame**

  Store the pending animation-frame id in a ref. `input` schedules a commit unless composition is active. `compositionend` clears the composition flag and schedules the same commit path; the callback reads `contentRef.current.textContent` at execution time rather than capturing the event's earlier value.

  ```ts
  const scheduleTextCommit = (): void => {
    if (textFrameRef.current !== null) cancelAnimationFrame(textFrameRef.current)
    textFrameRef.current = requestAnimationFrame(() => {
      textFrameRef.current = null
      const content = contentRef.current
      if (content) commitText(content.textContent ?? '')
    })
  }
  ```

  Cancel the frame on unmount and when editing ends.

- [ ] **Step 5: Prevent temporary English wrapping**

  While editing an auto-width frame, give the live content `width: max-content`, `minWidth: 100%`, `whiteSpace: pre`, and `overflowWrap: normal`. Fixed-width/content-height frames retain `whiteSpace: pre-wrap` and `overflowWrap: break-word`. This lets Chromium expand the live editing box before React persists the measured geometry.

- [ ] **Step 6: Stop refocusing on every geometry update**

  Keep only the layout effect that focuses when editing begins or the editing element changes. Remove width and height from the refocus effect so IME/caret state is not disturbed by auto-size updates.

- [ ] **Step 7: Add a browser IME/typing smoke assertion**

  In the existing editable-presentation E2E setup, insert a text box and type a long English token. Assert the editable node remains one visual line while `autoWidth` is active:

  ```ts
  expect(
    await textBox.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)
  ).toBe(true)
  ```

  Manual Electron verification must additionally use macOS Chinese Zhuyin or Pinyin composition because Playwright cannot reproduce the native candidate window reliably.

- [ ] **Step 8: Verify and commit**

  ```bash
  npx vitest run src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
  npx playwright test e2e/responsive-workspaces.spec.ts --grep "editable presentation"
  git add src/renderer/src/components/Common/EditableSlideSurface.tsx src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx e2e/responsive-workspaces.spec.ts
  git commit -m "fix: stabilize presentation text auto sizing"
  ```

### Task 5: Add Fit Zoom, Anchored Wheel Zoom, and Reliable Notes State

**Files:**

- Create: `src/renderer/src/lib/presentation-viewport.ts`
- Create: `src/renderer/src/lib/__tests__/presentation-viewport.test.ts`
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx:619-621,670-705,1150-1160,1960-2150`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`
- Modify/Test: `e2e/responsive-workspaces.spec.ts`

**Interfaces:**

- Produces: `calculateFitZoomPercent(viewportWidth, viewportHeight, canvasWidth, canvasHeight, padding): number`
- Produces: `calculateAnchoredScroll(currentOffset, anchor, previousZoom, nextZoom): number`
- Produces: local `zoomMode: 'fit' | 'custom'`
- Preserves: 25–200% limits and the existing Notes storage in `EditablePresentationSlide.notes`

- [ ] **Step 1: Write failing pure geometry tests**

  ```ts
  expect(calculateFitZoomPercent(1050, 486, 1024, 576, 64)).toBe(73)
  expect(calculateFitZoomPercent(500, 300, 1024, 576, 64)).toBe(40)
  expect(calculateAnchoredScroll(200, 300, 100, 150)).toBe(450)
  ```

  Round fit zoom down to an integer and clamp it to 25–200.

- [ ] **Step 2: Verify RED**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/presentation-viewport.test.ts
  ```

- [ ] **Step 3: Implement the two pure calculations**

  Fit uses the smaller of available-width and available-height ratios after subtracting total padding. Pass the existing 1024 CSS px base canvas width and derive its height from the document aspect ratio; do not reinterpret document canvas coordinates as CSS pixels. Anchored scroll keeps the same logical slide coordinate under the pointer:

  ```ts
  export function calculateAnchoredScroll(
    currentOffset: number,
    anchor: number,
    previousZoom: number,
    nextZoom: number
  ): number {
    return Math.max(0, (currentOffset + anchor) * (nextZoom / previousZoom) - anchor)
  }
  ```

- [ ] **Step 4: Measure the actual canvas viewport**

  Add a ref to the scroll container and a `ResizeObserver` that stores its content-box width and height. Default `zoomMode` to `fit`. Recalculate fit when the window, side rail, Ribbon, or Notes pane changes the available size.

- [ ] **Step 5: Wire custom and fit zoom controls**

  Slider, `+`, `-`, and percentage selection switch to custom mode. Add a Fit button beside the percentage and mark it pressed while fit mode is active. Remove the artificial `Math.max(320, ...)` width floor so 25% and fit percentages are geometrically accurate.

- [ ] **Step 6: Implement anchored modifier-wheel zoom locally on the viewport**

  Handle wheel only when `event.ctrlKey || event.metaKey`; otherwise leave ordinary scrolling untouched. Prevent default, change zoom in 5% increments, then update `scrollLeft` and `scrollTop` with `calculateAnchoredScroll()` using the pointer position inside the viewport.

- [ ] **Step 7: Flush Notes at every state boundary**

  Call `commitNotes()` before changing slides, closing Notes, changing active documents, and unmounting the editable session view. Do not create undo entries when the draft equals the stored note.

- [ ] **Step 8: Add component and E2E regressions**

  Assert:

  - Fit is the initial mode.
  - Opening Notes reduces fit zoom but keeps the Notes and zoom controls visible.
  - Closing and reopening Notes preserves text.
  - Ctrl+wheel changes zoom on both platforms; a mocked macOS environment also accepts Meta+wheel.
  - At custom zoom above fit, the stage scroll container reports overflow rather than clipping the status bar.

- [ ] **Step 9: Verify and commit**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/presentation-viewport.test.ts \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  npx playwright test e2e/responsive-workspaces.spec.ts --grep "editable presentation"
  git add src/renderer/src/lib/presentation-viewport.ts src/renderer/src/lib/__tests__/presentation-viewport.test.ts src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx e2e/responsive-workspaces.spec.ts
  git commit -m "feat: add presentation fit and wheel zoom"
  ```

### Task 6: Load Installed Fonts from Chromium with Clear Permission UX

**Files:**

- Modify: `src/renderer/src/lib/local-fonts.ts`
- Test: `src/renderer/src/lib/__tests__/local-fonts.test.ts`
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx:615-616,1070-1105,1413-1450`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`

**Interfaces:**

- Consumes: `window.queryLocalFonts(): Promise<Array<{ family: string }>>`
- Produces: `queryLocalFontFamiliesOnce(): Promise<string[]>`
- Preserves: `queryLocalFontFamilies(access?)` as the directly testable enumerator
- Security: exposes names only; no font file blobs or filesystem paths

- [ ] **Step 1: Verify the Electron Local Font Access capability before changing UI code**

  In current `npm run dev` and the existing unpacked Electron build, record:

  ```js
  ({
    secureContext: window.isSecureContext,
    queryLocalFontsType: typeof window.queryLocalFonts
  })
  ```

  Click the current Load Local Fonts control and record the returned family count or exact exception name. Both environments must expose `queryLocalFonts` as a function before continuing this task. If the packaged runtime does not, stop this task and revise the approved architecture; do not silently hardcode font names.

- [ ] **Step 2: Add failing cache and retry tests**

  ```ts
  const access = { queryLocalFonts: vi.fn().mockResolvedValue([{ family: 'DFKai-SB' }]) }
  await queryLocalFontFamiliesOnce(access)
  await queryLocalFontFamiliesOnce(access)
  expect(access.queryLocalFonts).toHaveBeenCalledOnce()
  ```

  Add a rejection case proving failure is not cached and a later retry calls the API again.

- [ ] **Step 3: Verify RED**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/local-fonts.test.ts
  ```

- [ ] **Step 4: Add the minimum successful-result cache**

  Keep a module-local `Promise<string[]> | null`. Set it before awaiting, but reset it to `null` in `catch` so denied or transient failures can be retried. Isolate cache tests with `vi.resetModules()` and dynamic imports; do not export a production cache-reset API or add persistence.

- [ ] **Step 5: Trigger enumeration from the font control's first user gesture**

  Call `loadLocalFonts()` on the font-family control's first `pointerdown` or focus, and keep the existing explicit refresh button for retry. Use `queryLocalFontFamiliesOnce()` so repeated opens do not re-enumerate. Keep a visible loading state and the existing warning toast for permission denial.

- [ ] **Step 6: Preserve installed-only truth**

  Keep bundled fallback families plus the selected imported family. Add enumerated `PMingLiU`, `MingLiU`, `DFKai-SB`, `BiauKaiTC`, `Songti TC`, or any other family only when returned by the API. Do not hardcode these as available options.

- [ ] **Step 7: Add UI tests**

  Mock the enumerator with duplicates and the three Traditional Chinese families. Focus the font selector, wait for loading to finish, and assert each installed family appears once. Mock a rejection, assert the warning, retry, and assert the later successful result appears.

- [ ] **Step 8: Verify the selected installed font in Electron and projection**

  Grant the font permission, confirm the returned family count is non-zero, select one installed system family, and verify its computed `font-family` in both editor and projection.

- [ ] **Step 9: Verify and commit**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/local-fonts.test.ts \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  git add src/renderer/src/lib/local-fonts.ts src/renderer/src/lib/__tests__/local-fonts.test.ts src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  git commit -m "feat: load installed presentation fonts"
  ```

### Task 7: Recompose the Ribbon Around the Supported Home Workflow

**Files:**

- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx:117-152,1185-1685,1760-1810,2615-2706`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`
- Modify/Test: `e2e/responsive-workspaces.spec.ts`

**Interfaces:**

- Produces: `RibbonTab = 'home' | 'insert' | 'design' | 'picture'`
- Produces: compact `RibbonGroup` with `aria-label` but no visible caption
- Preserves: existing insert, background, picture-format, font, paragraph, arrange, copy/paste, and session actions

- [ ] **Step 1: Add failing information-architecture tests**

  Assert the Home ribbon's accessible groups occur in this order:

  ```ts
  expect(homeGroups.map((group) => group.getAttribute('aria-label'))).toEqual([
    'Clipboard',
    'Slides',
    'Font',
    'Paragraph',
    'Insert',
    'Arrange'
  ])
  ```

  Assert Home has Paste, New Slide, Picture, Shapes, and Text Box actions; no visible group-caption paragraphs; and no X/Y/W/H spinbuttons. Select a text frame and assert no Text tab appears.

- [ ] **Step 2: Verify RED**

  ```bash
  npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  ```

- [ ] **Step 3: Remove the duplicate Text contextual tab**

  Delete `'text'` from `RibbonTab`, stop appending it in `ribbonTabs`, and remove its label. Text selection continues using Home font and paragraph controls.

- [ ] **Step 4: Make Ribbon groups dense without losing accessibility**

  Keep `<section role="group" aria-label={label}>`, delete the visual `<p>{label}</p>`, reduce padding to `px-2 py-1`, change native controls from `rounded-lg h-9` to `rounded-md h-7`, and reduce the open Ribbon frame from `h-28` to `h-24`.

- [ ] **Step 5: Reorder Home around supported commands**

  Build these groups using existing handlers:

  1. Clipboard: internal Paste; disabled when neither copied elements nor slides exist.
  2. Slides: New Slide.
  3. Font: family, size, grow/shrink, bold, italic, underline, color, clear formatting.
  4. Paragraph: line spacing and horizontal alignment.
  5. Insert: Picture, Shapes, Text Box.
  6. Arrange: forward/backward, align, distribute.

  Do not render unsupported Layout, Reset, Section, bullets, numbering, SmartArt, Add-ins, or Designer controls.

- [ ] **Step 6: Remove raw geometry from Home**

  Delete the Position group and its X/Y/W/H inputs. Geometry remains editable by direct manipulation; picture-specific border/crop/size controls remain in Picture Format. Do not create a new inspector in this task.

- [ ] **Step 7: Apply the same density rules to Insert, Design, and Picture Format**

  Retain their existing behaviors and accessible names, remove bottom captions, use separators between groups, and keep horizontal scrolling only when the viewport cannot contain the supported commands.

- [ ] **Step 8: Add responsive browser assertions**

  At 1470×726 and 1200×800, require `scrollWidth <= clientWidth` for Home. At 900×800, allow intentional horizontal scrolling while ensuring the stage and status bar remain visible.

- [ ] **Step 9: Verify and commit**

  ```bash
  npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  npx playwright test e2e/responsive-workspaces.spec.ts --grep "editable presentation"
  git add src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx e2e/responsive-workspaces.spec.ts
  git commit -m "fix: align presentation ribbon hierarchy"
  ```

### Task 8: Add Supported PowerPoint-Familiar Editor Shortcuts

**Files:**

- Modify: `src/renderer/src/config/shortcuts.ts`
- Create: `src/renderer/src/config/__tests__/shortcuts.test.ts`
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx:1685-1760,1960-1966`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`

**Interfaces:**

- Consumes: `SHORTCUTS.PRESENTATION`, `useKeyboardShortcuts`, current selected slide/element state, and Task 5 zoom commands
- Produces: explicit configs for `NEW_SLIDE`, `DUPLICATE`, `ZOOM_IN`, `ZOOM_OUT`, `ZOOM_FIT`, `BOLD`, `ITALIC`, and `UNDERLINE`
- Preserves: existing F5/Command+Return presentation shortcuts and undo/redo

- [ ] **Step 1: Add failing platform-config tests**

  Require these resolved bindings:

  | Action | Windows/Linux | macOS |
  | --- | --- | --- |
  | New slide | Ctrl+M | Command+Shift+N |
  | Duplicate selected object | Ctrl+D | Command+D |
  | Zoom in | Ctrl++ | Command++ |
  | Zoom out | Ctrl+- | Command+- |
  | Fit | Ctrl+Alt+O | Command+Option+O |
  | Bold/Italic/Underline | Ctrl+B/I/U | Command+B/I/U |

- [ ] **Step 2: Verify RED**

  ```bash
  npx vitest run src/renderer/src/config/__tests__/shortcuts.test.ts
  ```

- [ ] **Step 3: Define the shortcuts centrally**

  Add exact `ShortcutConfig` entries under `SHORTCUTS.PRESENTATION`; do not embed platform detection inside `PresentationWorkspacePage`.

- [ ] **Step 4: Route supported actions through existing commands**

  Register new slide, duplicate, zoom, fit, and whole-frame B/I/U while no text caret is active. Keep the existing raw selection handler only for contextual copy/paste/delete/nudge behavior that depends on the event target. Do not use deprecated `document.execCommand()`.

- [ ] **Step 5: Add keyboard navigation consistent with current capabilities**

  Add PageUp/PageDown slide navigation, Enter to begin editing a selected text frame, and Esc state progression: end text edit first, then clear element selection, then exit text-insert mode. Do not steal these keys from an active `contentEditable` target.

- [ ] **Step 6: Add behavior tests**

  Verify Windows and macOS modifier variants, disabled behavior with no selection, and that shortcuts do not fire while a menu/dialog or text caret is active. Test Ctrl+wheel and Meta+wheel through the viewport handler from Task 5.

- [ ] **Step 7: Verify and commit**

  ```bash
  npx vitest run \
    src/renderer/src/config/__tests__/shortcuts.test.ts \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  git add src/renderer/src/config/shortcuts.ts src/renderer/src/config/__tests__/shortcuts.test.ts src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx
  git commit -m "feat: add presentation editor shortcuts"
  ```

### Task 9: Allow Google Account Avatars Through the Existing CSP

**Files:**

- Modify: `src/renderer/index.html:8-11`
- Test: `src/renderer/src/__tests__/hhc-auth-entry-config.test.ts`
- Test: `src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx`

**Interfaces:**

- Consumes: `HhcAuthSession.avatarUrl`
- Produces: `img-src` permission for exactly `https://lh3.googleusercontent.com`
- Preserves: Avatar fallback and all other CSP directives

- [ ] **Step 1: Add a failing CSP source test**

  ```ts
  const html = read('src/renderer/index.html')
  const imgSrc = html.match(/img-src ([^;]+);/)?.[1]
  expect(imgSrc).toContain('https://lh3.googleusercontent.com')
  expect(imgSrc?.split(/\s+/)).not.toContain('https:')
  ```

- [ ] **Step 2: Verify RED**

  ```bash
  npx vitest run src/renderer/src/__tests__/hhc-auth-entry-config.test.ts
  ```

- [ ] **Step 3: Add the narrow host allowlist**

  Change only `img-src`:

  ```html
  img-src 'self' data: blob: hhc-media: __HHC_ASSET_ORIGIN__ https://lh3.googleusercontent.com;
  ```

  Do not add the host to `script-src`, `connect-src`, or `default-src`.

- [ ] **Step 4: Keep the existing UI fallback covered**

  Run the existing authenticated-avatar test, which requires `Avatar.Image` when `session.avatarUrl` exists and `Avatar.Fallback` otherwise. Do not modify `UserMenu.tsx`; the observed failure is CSP enforcement, not session mapping or fallback rendering.

- [ ] **Step 5: Verify and commit**

  ```bash
  npx vitest run \
    src/renderer/src/__tests__/hhc-auth-entry-config.test.ts \
    src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx
  git add src/renderer/index.html src/renderer/src/__tests__/hhc-auth-entry-config.test.ts src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx
  git commit -m "fix: allow Google account avatars"
  ```

### Task 10: Run Cross-Cutting Verification and Record Known Limits

**Files:**

- Verification only; no planned source files
- No release files, version fields, changelog, or tags

**Interfaces:**

- Consumes: all prior task outputs
- Produces: one verified branch ready for review, without push/PR/merge/release

- [ ] **Step 1: Run formatting checks without bulk rewriting unrelated files**

  ```bash
  npx prettier --check \
    src/renderer/src/components/Common/WorkspacePrimitives.tsx \
    src/renderer/src/components/Common/EditableSlideSurface.tsx \
    src/renderer/src/lib/editable-presentation.ts \
    src/renderer/src/lib/presentation-viewport.ts \
    src/renderer/src/lib/local-fonts.ts \
    src/renderer/src/config/shortcuts.ts \
    src/renderer/src/pages/PresentationWorkspacePage.tsx \
    src/renderer/index.html
  npm run lint
  ```

- [ ] **Step 2: Run type and unit gates**

  ```bash
  npm run typecheck
  npx vitest run
  ```

- [ ] **Step 3: Run build and browser regressions**

  ```bash
  npm run build
  npx playwright test e2e/responsive-workspaces.spec.ts
  ```

- [ ] **Step 4: Perform the Electron text and viewport smoke**

  On macOS in `npm run dev`:

  1. Create a presentation at 1470×726 and confirm Notes/zoom are visible.
  2. Insert empty text and confirm six handles with no top/bottom center handle.
  3. Hover and drag all four frame edges; confirm move cursor and frame movement.
  4. Type English continuously; confirm no transient second line while auto-width is active.
  5. Enter Traditional Chinese through the native IME; confirm the final text expands the frame.
  6. Drag the right handle; confirm width becomes fixed while height still follows text.
  7. Open Notes; confirm Fit recalculates and the status bar remains visible.
  8. Exercise Ctrl+wheel, Command+wheel, Command++, Command+-, and Command+Option+O.

- [ ] **Step 5: Perform the font and avatar smoke**

  1. Sign in with Google and confirm the `lh3.googleusercontent.com` avatar loads with no CSP violation.
  2. Open the font picker, grant local-font permission, and confirm a non-zero installed-family list.
  3. Verify `PMingLiU`/`DFKai-SB` only if this Mac actually has them; otherwise verify an installed `BiauKaiTC` or `Songti TC` and retain the bundled Noto fallback.
  4. Project the slide and confirm the chosen installed font resolves in the projection window.

- [ ] **Step 6: Record the intentional limitation in the review summary**

  State explicitly: editing an imported mixed-run text frame still flattens its runs because selection-level rich-text editing is outside this plan. Do not claim full PowerPoint compatibility.

- [ ] **Step 7: Confirm branch integrity**

  ```bash
  git status --short
  git log --oneline origin/main..HEAD
  git diff --check origin/main...HEAD
  ```

  Expected: only the planned files are changed, every task commit is present, and no release mutation exists. If a gate fails, return to the task that owns the failing behavior instead of patching it in this verification task.
