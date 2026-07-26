# R0 Packaging Reliability Design

## Context

The Windows unpacked build could be created even when `electron-vlc-player` failed to compile
`vlc_binding.node`. The dependency install script reports the native rebuild failure as a warning,
so packaging continued and produced an executable that failed during main-process startup.

The same build also omitted the bundled VLC and FFmpeg runtimes because it bypassed the project's
runtime preparation command. The existing packaged runtime verifier caught the missing runtimes,
but did not check the native binding.

## Goals

- Never publish or smoke-test a desktop package that is missing required native Media components.
- Keep LibrePresenter able to start and expose a clear Media capability error if a locally copied or
  otherwise damaged package is missing the VLC native binding.
- Verify the real packaged control and projection lifecycle before release.
- Preserve the existing `electron-vlc-player` integration and avoid an unrelated player rewrite.

## Design

### Build-time native gate

Add a focused verifier for the `electron-vlc-player` native binding. It checks the dependency tree
before packaging and gives an actionable failure message when the binding is absent. Desktop
packaging scripts run this gate before `electron-builder`.

The Windows build prerequisite remains Visual Studio Build Tools with the Desktop development with
C++ workload and a Windows SDK. CI and release documentation must make this prerequisite explicit.
The gate must fail rather than accept a warning from the dependency install script.

### Packaged runtime gate

Extend the existing packaged runtime verifier to require all of the following for each supported
desktop target:

- `electron-vlc-player/build/Release/vlc_binding.node` in the unpacked ASAR payload
- bundled VLC runtime for the target platform
- bundled FFmpeg poster runtime for the target platform
- existing third-party license notices

`build:unpack` and release packaging continue to prepare video-engine assets before invoking
`electron-builder`. Direct `electron-builder --dir` output is not considered a valid release
artifact unless it passes the verifier.

### Runtime fallback

Remove eager loading of `electron-vlc-player` from the main-process bootstrap path. The VLC adapter
loads the native dependency only when VLC capability is queried or used. A missing or unloadable
binding returns a structured unavailable/error result through the existing projection VLC IPC
surface.

This fallback prevents a damaged local package from crashing LibrePresenter at startup. It does not
make that package release-valid; the build-time and packaged gates still reject it.

### Packaged smoke gate

After packaging and runtime verification, launch the real desktop executable with an isolated user
data directory and verify:

1. the control window opens;
2. starting the timer opens the projection window;
3. the projection window receives and renders the timer payload;
4. waiting through another timer tick does not create another window or a recurring focus action;
5. the application exits cleanly.

Browser projection E2E remains a separate production-build gate.

## Error handling

- A missing source binding fails before packaging with the expected rebuild command and toolchain
  prerequisite.
- A missing packaged binding or video runtime fails packaged verification with the exact missing
  path.
- A runtime load failure is reported as VLC unavailable and must not prevent the main window from
  opening.
- Smoke-test cleanup must terminate only the process tree launched with the isolated test user-data
  directory.

## Testing

- Unit tests cover missing and present source native binding states.
- Existing packaged-runtime tests add missing and present packaged binding cases.
- Main-process tests prove that importing/registering projection handlers does not eagerly load the
  native binding and that load failure becomes a structured error.
- Windows packaged smoke runs only after the native and video runtime gates pass.
- Typecheck, focused Vitest suites, browser E2E, package verification, and packaged smoke are required
  before R0 is marked complete.

## Non-goals

- Replacing `electron-vlc-player`
- Publishing prebuilt native bindings from this repository
- Changing video playback UX or projection controls
- Adding YouVersion work to the Media/Presentation roadmap

## Acceptance criteria

- A missing `vlc_binding.node` cannot produce a release-valid package.
- A damaged package missing the binding can still open the main window and reports VLC unavailable.
- A correctly prepared Windows package passes native/runtime verification and the packaged smoke
  test.
- CI executes the relevant gates in the correct order.
