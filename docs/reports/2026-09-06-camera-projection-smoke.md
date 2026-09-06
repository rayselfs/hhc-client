# Single-camera projection implementation and smoke

Date: 2026-09-06. Base: `3e523d35` (`2.4.3`). Branch: `feat/single-camera-projection`.

## Delivered

One videoinput source, video-only capture, centered cover on a 1920×1080 logical stage, pointer movement, proportional corner resizing, keyboard movement and numeric position/width. Preview and projection share stage geometry. Camera ownership survives workspace navigation; other explicit content actions retain their ownership behavior. Source loss clears projection video; reconnect/reload uses fresh peer sessions and bounded retries. Tracks stop when neither preview nor projection consumes them.

The existing IPC/BroadcastChannel adapters carry validated signaling and state. Media tracks remain local to renderer services. No dependency or cloud backend was added. Electron media permission is restricted to the main window's top-level document; existing speech audio permission remains supported. Passive timer ticks now update cached state without taking over a non-timer projection.

## Verified locally

| Check                                                                  | Result                                                                                                                                                                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                         | Passed                                                                                                                                                                             |
| `npx vitest run`                                                       | 265 files, 3,124 tests passed                                                                                                                                                      |
| `npm run build`                                                        | Passed, including TypeScript and bundle budget                                                                                                                                     |
| `npm run build:web`                                                    | Passed, including web and PWA checks                                                                                                                                               |
| `npx playwright test e2e/camera-projection.spec.ts --project=chromium` | 2 passed: pointer/keyboard movement, proportional resize/reset, transform parity, navigation, receiver reload, simulated track end/retry, capture cleanup, permission denial/retry |
| `npm run build:unpack`                                                 | Passed on macOS arm64; packaged VLC/FFmpeg runtime ready                                                                                                                           |
| Packaged recovery lifecycle test                                       | 1 passed; separate control/projection windows, reload and navigation                                                                                                               |
| Packaged VLC production matrix                                         | 1 passed; existing packaged media regression suite                                                                                                                                 |
| Browser visual QA                                                      | 16:9 stage, controls and numeric fields fit in tested desktop viewport; no duplicate global projection button                                                                      |

The E2E fake device and simulated `ended` event test application handling, not physical unplug compatibility. Packaging reused the primary checkout's existing runtime source through a symlink and copied runtime files into this worktree. The primary checkout and installed app were not replaced.

## Physical transport evidence

- Device: MacBook Air Camera, macOS arm64; Electron 41.10.6.
- Final Electron diagnostic: sender 1920×1080 at 30 fps; receiver 1920×1080 at 30 fps; 120 frames received; connected; no captured JavaScript errors; source track ended after cleanup.
- Browser physical diagnostic also received camera frames and stopped capture. That earlier run predated the sender resolution preference and received a downscaled stream; do not treat it as final browser 1080p proof.
- Initial WebRTC tests downscaled to 480×270 / 640×360. Setting native sender `degradationPreference: maintain-resolution` preserved 1080p in the final physical Electron run. This setting can trade frame rate under resource pressure.
- Diagnostic harness uses the actual capture/peer modules and Electron IPC/permission code, but is distinct from the full installed application.
- Reproduce with `node scripts/camera-probe.mjs --electron` (physical camera), or add `--synthetic` for a generated video device. Omit `--electron` to exercise browser transport.

## Remaining acceptance gates

Windows installed application, external UVC capture card, signed macOS camera access, physical unplug/replug and busy-device handling, multiple display DPI, and 30-minute continuous operation require hardware smoke. Capture-to-projection median/p95 latency has not been measured externally; the planned 30-sample p95 ≤250 ms target is not yet accepted. A successful peer connection or reported frame rate does not establish latency.

Remote CI, PR, merge, release and web deployment have not been performed. Retain the task worktree until integration and required hardware checks are complete. Personal cloud sync remains a separate future task.
