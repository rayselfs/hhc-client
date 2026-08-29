# M4 PPTX Presentation Workspace Plan

## Goal

Treat PPTX as a first-class media item that can be opened, previewed, organized,
and projected without leaving HHC Presenter. V1 prioritizes projection accuracy,
multi-document operation, and page-level workflows over full PowerPoint element
editing.

## Product Direction

- PPTX does not get a top-level nav item.
- PPTX files live in the media library and open into a Presentation Workspace.
- Multiple PPTX files are managed with workspace document tabs, not separate OS
  windows.
- Web and Electron both render raw `.pptx` through the browser runtime.
- Legacy Slides prototype is removed. Future native slide editing is a new
  feature, not a continuation of the old prototype.

## Implemented

- Removed `/slides`, legacy Slides workspace/store/projection, and `slide:show`.
- Added `.pptx` to media import policy as `presentation`.
- Kept legacy `.ppt` unsupported for V1.
- Added browser-native PPTX rendering through `@aiden0z/pptx-renderer`.
- Added first-slide thumbnail generation for PPTX media items.
- Added Presentation Workspace layout:
  - top ribbon/toolbar
  - document tabs
  - slide thumbnails
  - active slide surface
  - inspector
  - bottom slide status and controls
- Added page-level presentation document derived asset keyed by source item/blob.
- Added page-copy service semantics without converting full PowerPoint elements.
- Integrated PPTX projection into existing media presenter and `file:show`.
- Added slide-aware media navigation for PPTX.
- Added license notices for `@aiden0z/pptx-renderer`.

## V1 Acceptance Criteria

- `.pptx` uploads as a media item.
- `.ppt` is unsupported.
- File Explorer displays a presentation icon and thumbnail.
- Double-click opens Presentation Workspace.
- Workspace can keep multiple PPTX files open in tabs.
- Active slide can be changed from the thumbnail rail.
- PPTX can be projected through the same media presenter lifecycle as images,
  videos, and PDFs.
- Previous/next controls advance PPTX slides before moving to the next media
  item.
- Projection uses `file:show`; no `slide:show` path remains.
- Page-level documents can represent copied pages without editing every
  PowerPoint element.

## Future Work

- Full editable deck model for text, image, shape, and layout editing.
- Native HHC Presenter slide creation.
- PPTX export, only if a real workflow needs it.
- Presenter notes editing and service cue integration.
- More detailed render warning UI for unsupported PowerPoint features.

## Verification

```bash
npx vitest run
npm run typecheck
npm run lint
npm run build
```
