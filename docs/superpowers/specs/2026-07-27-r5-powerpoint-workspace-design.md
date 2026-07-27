# R5 PowerPoint-like Presentation Workspace Design

## Intent

Make the editable presentation workspace behave like a familiar desktop slide editor without
copying Microsoft PowerPoint branding or attempting OOXML parity. The operator must be able to
edit, organize, and present quickly while the R2 persistence contract and R3/R4 projection
session remain authoritative.

## Product direction

- Tone: dense, calm production console using the existing LibrePresenter theme tokens.
- Familiarity: PowerPoint information architecture and keyboard muscle memory come before
  decorative similarity.
- Trust: edit selection, slide selection, current projected slide, and next slide are independent
  states with independent visual treatment.
- Progressive disclosure: common commands stay in the quick bar and Ribbon; precision controls
  live in the contextual inspector.
- Responsive degradation: wide shows rail, stage, and inspector; medium turns the inspector into a
  drawer; compact shows one primary surface with mutually exclusive panels.

## Information architecture

### Document quick-access bar

Use a 44 px route-level bar containing:

- Back to Files.
- Undo and Redo with truthful disabled states.
- Open document tabs and save status.
- A presentation split action:
  - F5 / Present from Beginning.
  - Shift+F5 / Present from Current Slide.

The split action replaces live Media explicitly. It never doubles as projection-window close;
global projection session controls remain responsible for blackout, resume, retry, and close.

### Ribbon

- Home: clipboard, slide operations, font, paragraph, arrange, align, and distribute.
- Insert: text box, image, rectangle, ellipse, and line.
- Design: slide size and background.
- Picture Format: crop, appearance, and arrange when an image is selected.
- Text Format: typography and text-frame controls when text is selected.

Ribbon panels keep one stable height. At medium width, labels collapse before controls disappear.
At compact width, the selected tab becomes a horizontally scrollable command strip.

### Workspace body

- Navigator rail:
  - resizable from 184–360 px;
  - multi-select with Shift and Ctrl/Cmd;
  - insertion affordances;
  - native drag reorder for one or many selected slides;
  - projected slide marker independent from selection.
- Stage:
  - centered 16:9 canvas;
  - 25–200% zoom relative to fit;
  - marquee selection;
  - multi-object drag;
  - keyboard nudge;
  - snap guides for slide edges and centers.
- Inspector:
  - selected-object position and size;
  - align/distribute;
  - contextual image crop;
  - slide background when no object is selected.
- Notes:
  - collapsible per-slide pane;
  - one history transaction per completed edit, not per keystroke.
- Status bar:
  - slide index/count;
  - selected slide/object counts;
  - projection state;
  - zoom slider and reset-to-fit.

## State and commands

- `PresentationEditorSession` remains the only document/history/persistence writer.
- `activeSlideIdByItemId` remains the edit-slide source of truth.
- Ephemeral object/slide selection, marquee, drag, crop mode, open panels, and zoom stay outside
  document history.
- Pure presentation commands provide:
  - selected-slide reorder;
  - bounding-box selection;
  - object nudge;
  - align and distribute;
  - multi-object patches.
- Pointer and notes interactions use the R2 draft/commit contract so one visible operation creates
  one Undo entry.
- Projection slide state is read from the live Media session and never written back into editor
  selection.

## Interaction details

- Clicking an object selects only it. Ctrl/Cmd-click toggles; Shift-click extends selection.
- Dragging empty canvas creates a marquee. Intersecting unlocked objects become selected.
- Arrow nudges 1 document unit; Shift+Arrow nudges 10.
- Moving within the snap threshold aligns to slide edges or centers and shows temporary guides.
- Align applies to the selected objects against their collective bounds. Distribute requires at
  least three objects and keeps the outer objects fixed.
- Crop is an explicit mode with a visible exit action.
- Delete affects selected objects first, otherwise selected slides; the last slide cannot be
  deleted.
- Escape exits text edit, crop, marquee, or multi-selection in that order.

## Accessibility

- Every icon-only action has an accessible name and visible focus state.
- Slide and object selection exposes `aria-selected`.
- Drag reorder has keyboard move-before/move-after alternatives.
- Zoom and numeric controls have labels and bounded values.
- Status changes use polite live regions; save/projection failures use alerts.
- Theme tokens are used for states; color is never the sole signal.

## Testing

- Pure command unit tests cover reorder, selection bounds, nudge, align, distribute, and snapping.
- Component tests cover quick-bar presentation semantics, contextual tabs, rail reorder, Notes
  commit, zoom, projected-versus-selected states, shape/line insertion, crop entry, marquee, and
  keyboard nudge.
- Existing R2 session and R3/R4 projection tests remain green.
- Final gates: full Vitest, Node/Web typechecks, zero-warning ESLint, production build budgets,
  browser projection E2E, and packaged Electron lifecycle smoke.
