# Presentation Rendering Fidelity Design

## Goal

Match PowerPoint's visible text scale and preserve slide geometry across editor, preview,
thumbnail, persistence, and projection without rewriting existing documents.

## Root Causes

- Text elements store canvas pixels, while Ribbon values are labeled and interpreted as points.
  Assigning `72` directly therefore renders 72 canvas pixels instead of 72pt.
- Projection passes both full width and full height to the slide surface, overriding its aspect
  ratio on displays that do not match the deck.
- Slide Size changes only document bounds, leaving every element at its previous coordinates.
- Deserialization omits `defaultSlideBackground`.
- Imported fixed text frames are enlarged from estimated line count even though OOXML provides an
  explicit frame.
- PPTX import flattens all runs into one style, and SVG thumbnails use a second simplified text
  representation.

## Decisions

### Keep canvas pixels; convert Ribbon point values at the boundary

The document format remains canvas-based. A standard PowerPoint slide is 960 points wide, so:

```ts
canvasPx = points * documentWidth / 960
points = canvasPx * 960 / documentWidth
```

This yields 144 canvas px for 72pt in a 1920-wide document and 96 canvas px in a 1280-wide PPTX
document. Existing documents are not migrated or guessed. Imported OOXML font sizes continue using
the correct `96 / 72` conversion because imported geometry is also 96-DPI CSS pixels.

### Projection uses an explicit contain box

Compute a wrapper bounded by both viewport dimensions:

```css
width: min(100vw, calc(100vh * slideRatio));
height: min(100vh, calc(100vw / slideRatio));
```

The slide surface fills that box. Letterboxing remains black; no crop or stretch is allowed.

### Remove non-functional Slide Size control

Changing document dimensions without transforming all slide content corrupts layout. The current
selector will be removed. A future page-setup feature must offer native-style scale/content-fit
choices and transform all coordinates atomically.

### Preserve persisted default background

Deserialization normalizes and returns `defaultSlideBackground`, falling back to white only when
legacy data lacks it.

### Trust imported frame geometry

Imported text elements keep the exact resolved OOXML frame height and `autoSize: 'fixed'`. Content
is clipped by the frame instead of silently changing layout.

### Preserve imported run styling with an optional run model

`EditableTextElement.runs` is optional. Imported text stores ordered runs, including paragraph
breaks, with resolved font family, size, weight, style, underline, and color. Non-editing surfaces
render spans. The first plain-text edit intentionally clears `runs`, after which the element uses
the selected uniform Ribbon formatting. This avoids a speculative rich-text editor while keeping
imported appearance.

### Use the same run model in thumbnails

SVG thumbnail text emits `tspan` content from `runs` when present. It remains a lightweight
renderer but no longer discards imported per-run font styling.

## Compatibility

- Document schema remains backward compatible because `runs` and `defaultSlideBackground` are
  optional.
- Browser and Electron use the same renderer and conversion helpers.
- Existing 1920-wide documents immediately receive correct Ribbon point behavior.
- PPTX conversion and direct PPTX rendering remain separate; this batch changes editable copies.

## Verification

- Unit tests prove 72pt equals 144 canvas px at width 1920 and round-trips to 72.
- Component tests prove Ribbon uses point conversion and projection creates the contain box.
- Persistence tests prove default background survives reload.
- Import tests prove fixed height and mixed run styles survive conversion.
- Surface and thumbnail tests prove styled runs render and are cleared on plain-text edit.
- Focused tests, typecheck, lint, full Vitest, and production build must pass.
