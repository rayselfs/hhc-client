# Presentation Performance Hot Paths

## Goal

Keep presentation editing responsive as slide and element counts grow without changing editor
behavior.

## Design

- Render editable slide-rail previews only after they approach the viewport. Keep mounted previews
  alive after first visibility so scrolling does not repeatedly rebuild them.
- Memoize each preview against the slide, document dimensions, and asset references it actually
  renders. Edits to one slide must not rebuild unrelated previews.
- Treat document reference identity as the history no-op contract. Editor mutation helpers already
  preserve the original document on no-op; history must not deep-serialize every document to prove
  equality again.

## Non-goals

- Replacing the editor renderer.
- Persisting pre-rendered slide thumbnails.
- Changing undo/redo semantics or the 30-entry history limit.

## Acceptance

- Off-screen slide-rail previews do not mount `EditableSlideSurface`.
- Unchanged slide previews do not rerender when another slide changes.
- Committing the same document reference is a no-op; a distinct document is a history entry.
- Focused presentation tests, typecheck, and build pass.
