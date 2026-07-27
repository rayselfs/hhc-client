# Native Presentation Ribbon Design

## Goal

Make `presentation-ribbon-frame` read and behave like a native PowerPoint Ribbon: compact two-row
commands, stable group boundaries, predictable density, and no width-dependent wrapping.

## Root Cause

The current Home Ribbon places font controls, paragraph controls, four geometry fields, and eight
arrange actions in one flexible row. The final action area uses `flex-wrap`, so command position
changes with viewport width. Other tabs use unrelated one-row layouts. The frame therefore has no
stable visual grammar even though individual controls work.

## Reference Analysis

The supplied PowerPoint screenshot uses:

- two aligned command rows;
- compact icon buttons with restrained active states;
- font family and size fields as the dominant controls;
- thin vertical separators between Font and Paragraph;
- no card containers or oversized button labels;
- fixed command order rather than responsive wrapping.

## Options Considered

1. Copy every visible PowerPoint command. This would add dead controls or require a much larger
   document-model expansion, neither of which is part of a layout correction.
2. Keep one flex row and reduce button sizes. This delays wrapping but does not remove the unstable
   layout.
3. Build one reusable Ribbon group shell and arrange the existing working commands in fixed two-row
   grids. This reproduces the reference hierarchy without fake features and is selected.

## Design Direction

### Subject and audience

This is an operator-facing church presentation editor. Its single Ribbon job is to make frequent
text and slide adjustments fast while the operator keeps attention on the slide.

### Visual tokens

- Canvas: existing `bg-content1/95`
- Command hover: existing `bg-content2/80`
- Boundary: existing `border-divider`
- Active command: existing primary color
- Utility text: existing `text-default-400`
- Control height: 32px
- Ribbon height: 112px

No new font, palette, animation, or dependency is introduced. Native parity is more important than
inventing a decorative identity here.

### Signature

A deterministic two-tier command grid separated by full-height hairlines and quiet group captions.
This is the visual element that makes the editor immediately read as presentation software.

## Structure

```text
┌──────────────────────── Font ───────────────────────┬──── Paragraph ────┬── Position ─┬─ Arrange ─┐
│ [Font family                  ][Size][A+][A-][Clear]│ [Line spacing]    │ [X] [Y]     │ align...  │
│ [B][I][U][Font color]                              │ [L][C][R]         │ [W] [H]     │ distribute│
│                         Font                       │    Paragraph       │  Position    │ Arrange   │
└────────────────────────────────────────────────────┴────────────────────┴──────────────┴───────────┘
```

Each group is a semantic `section` with an accessible label. Commands never wrap between groups.
The complete Ribbon scrolls horizontally on narrow windows.

## Tab Layouts

### Home and Text

- Font: family, point size, grow, shrink, clear, bold, italic, underline, font color.
- Paragraph: line spacing, left, center, right.
- Position: X, Y, width, height in a fixed 2×2 grid.
- Arrange: element alignment and distribution actions in a fixed two-row grid.

The Text contextual tab intentionally uses the same working text commands as Home; no duplicate
implementation is introduced.

### Insert

One Insert group contains Text, Image, Rectangle, Ellipse, and Line as vertically oriented compact
commands.

### Design

One Background group contains Format Background.

### Picture

- Adjust: transparency, border color, border width, shadow.
- Arrange: bring forward and send backward.
- Size: crop.

## Responsive and Accessibility

- The Ribbon frame is `h-28`; collapsed state remains `h-0`.
- The command surface uses `overflow-x-auto overflow-y-hidden`.
- Groups use `role="group"` through semantic sections and `aria-label`.
- Existing button labels, disabled states, focus rings, and actions remain.
- No command is visually present unless its action is implemented.

## Verification

- Component tests prove the frame uses the 112px height, the command surface scrolls horizontally,
  and Home exposes Font, Paragraph, Position, and Arrange groups in order.
- Tests prove Insert, Design, and Picture use the same group shell.
- Existing behavioral tests continue to prove formatting, sizing, insertion, background, picture,
  position, alignment, and distribution actions.
- A browser screenshot is compared against the supplied reference for stable two-row density.
- Focused tests, typecheck, lint, full Vitest, and production build must pass.
