# Local Fonts and Preferences Visibility Design

## Goal

Let presentation authors use fonts installed on the current computer while keeping unfinished
Soundboard settings out of Preferences.

## Root Causes

- The presentation font menu is a four-item constant, so imported font families can disappear from
  the selector and installed fonts cannot be chosen.
- Local Font Access is permission-gated and requires a user interaction. It cannot be treated as an
  ordinary background data source.
- Preferences explicitly registers and renders the unfinished Soundboard category.

## Selected Approach

Use Chromium's native `window.queryLocalFonts()` API from a compact Ribbon button. The click is the
required user gesture; successful results are reduced to unique family names and merged with the
built-in fallback families and the selected element's current family.

Do not add an Electron native module, preload IPC bridge, font cache, or persistence. The browser
already owns permission handling, and CSS can use installed family names directly once selected.

Remove the Soundboard category, route, render branch, unused settings component, and its
Preferences-only locale strings. The Soundboard page, store, playback, and route remain unchanged.

## Interaction

- When Local Font Access is supported, the Font group shows a small refresh button beside the family
  selector.
- Activating it requests the browser permission and loads installed family names.
- While loading, the button is disabled and its icon spins.
- Unsupported environments omit the button and retain the existing fallback families.
- Permission denial or enumeration failure leaves the current menu intact and shows a warning.
- An imported or previously selected family remains visible even before local enumeration.

## Data Flow

```text
button click
  -> window.queryLocalFonts()
  -> trim family names
  -> remove blanks and duplicates
  -> locale-aware sort
  -> merge fallbacks + selected family + local families
  -> native font <select>
```

No font file contents or paths are read or persisted.

## Accessibility

- The load button has a translated accessible label and native disabled state.
- Existing native select keyboard behavior remains.
- Removing the Soundboard category also removes it from keyboard navigation.

## Verification

- Unit tests cover family cleanup, deduplication, sorting, and unsupported environments.
- Presentation workspace tests prove the button calls the API from a click, adds a returned family,
  and retains the selected imported family.
- Preferences tests prove Soundboard is absent and retain the existing single Storage Usage render.
- Focused tests, typecheck, lint, full Vitest, and production build must pass.
