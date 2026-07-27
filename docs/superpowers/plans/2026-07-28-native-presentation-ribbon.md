# Native Presentation Ribbon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace width-dependent Ribbon wrapping with a stable PowerPoint-style two-row command
layout across all editable presentation tabs.

**Architecture:** Add one local `RibbonGroup` shell inside `PresentationWorkspacePage.tsx`, then
compose existing working controls into fixed-width two-row groups. Keep command handlers and
document behavior unchanged; narrow viewports scroll horizontally.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4, HeroUI v3, Vitest

## Global Constraints

- Ribbon open height is exactly `h-28`; collapsed height remains `h-0`.
- The command surface scrolls horizontally and never wraps groups.
- No visible command may be added without a working action.
- Existing text, picture, insert, design, geometry, alignment, and distribution behavior remains.
- No new dependency or document-model field.

---

### Task 1: Ribbon Group Shell and Locale Labels

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`

**Interfaces:**
- Produces: local `RibbonGroup({ label, children, className? }): React.JSX.Element`
- Produces: semantic groups with `role="group"` and translated `aria-label`
- Produces: locale keys under `presentationWorkspace.ribbonGroups`

- [x] Add a failing height test:

```ts
const frame = await screen.findByTestId('presentation-ribbon-frame')
expect(frame).toHaveClass('h-28')
```

- [x] Add a failing Home structure test that expects `Font`, `Paragraph`, `Position`, and
      `Arrange` groups in document order.
- [x] Run the focused tests and verify the current `h-24` and ungrouped markup fail.
- [x] Add the minimal local group shell:

```tsx
function RibbonGroup({ label, children, className = '' }: RibbonGroupProps) {
  return (
    <section role="group" aria-label={label} className={`... ${className}`}>
      <div className="min-h-0 flex-1">{children}</div>
      <p className="...">{label}</p>
    </section>
  )
}
```

- [x] Add localized labels for Font, Paragraph, Position, Arrange, Insert, Background, Adjust,
      and Size.
- [x] Change the frame height to `h-28`; leave collapse behavior unchanged.
- [x] Run focused tests and commit.

### Task 2: Deterministic Home and Text Layout

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`

**Interfaces:**
- Consumes: existing text and object command handlers
- Produces: fixed Font, Paragraph, Position, and Arrange group layouts

- [x] Add failing assertions that the Home command surface has
      `overflow-x-auto overflow-y-hidden` and each group has a fixed `shrink-0` boundary.
- [x] Add a failing assertion that no Home arrange container uses `flex-wrap`.
- [x] Run focused tests and verify the current flexible row fails.
- [x] Recompose Home/Text as:

```tsx
<div data-ribbon-surface className="flex h-full min-w-max overflow-x-auto overflow-y-hidden ...">
  <RibbonGroup label={fontLabel}>...</RibbonGroup>
  <RibbonGroup label={paragraphLabel}>...</RibbonGroup>
  <RibbonGroup label={positionLabel}>...</RibbonGroup>
  <RibbonGroup label={arrangeLabel}>...</RibbonGroup>
</div>
```

- [x] Place font controls and paragraph controls in two explicit rows.
- [x] Place X/Y/width/height in a fixed 2×2 grid.
- [x] Place alignment and distribution actions in a fixed 4-column grid without wrapping.
- [x] Run the font-size and numeric-control behavioral tests plus the new structure tests.
- [x] Commit.

### Task 3: Consistent Insert, Design, and Picture Tabs

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`

**Interfaces:**
- Consumes: the Task 1 `RibbonGroup`
- Produces: semantic Insert, Background, Adjust, Arrange, and Size groups

- [x] Add failing tab tests that click Insert and Design and expect their named groups.
- [x] Add a selected-image test that opens Picture Format and expects Adjust, Arrange, and Size
      groups.
- [x] Run the focused tests and verify current one-row panels fail.
- [x] Wrap existing controls in the shared surface and group shell; keep all existing handlers.
- [x] Use compact vertical icon commands for Insert and fixed rows for Picture controls.
- [x] Run the complete presentation workspace page tests and commit.

### Task 4: Visual and Full Verification

- [x] Start the browser renderer and open an editable presentation with a selected text element.
- [x] Capture a screenshot of `presentation-ribbon-frame` and compare two-row density, group
      separators, field prominence, and command order against the supplied PowerPoint reference.
- [x] Review visual accents and keep only controls that support the native command hierarchy.
- [x] Run all presentation workspace tests.
- [x] Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [x] Run `npx vitest run` and `npm run build`.
- [x] Mark this plan complete and inspect repository state.
