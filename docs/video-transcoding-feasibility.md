# Desktop Video Engine Decision

Date: 2026-06-16
Updated: 2026-06-19

## Decision

LibrePresenter no longer uses user-selected FFmpeg, background MP4 transcode
jobs, or live transcode presentation.

The accepted strategy is:

- Desktop playback uses bundled VLC/libVLC through the embedded projection
  player.
- Desktop video posters use bundled FFmpeg only for still poster generation.
- Web playback stays browser-native and does not gain desktop codec support.
- Unsupported Web videos may be uploaded for consistency, but they are marked
  unsupported and excluded from presentation.

## Why VLC For Desktop Playback

Church and live-event projection software needs predictable playback for common
user-provided files: MP4, MOV, MKV, AVI, and other containers that Chromium may
not support. Requiring users to manually install FFmpeg and wait for background
transcodes does not match a professional desktop product.

VLC/libVLC keeps playback immediate and lets the desktop app support broader
containers without inventing a media pipeline. The app still owns projection
state, controls, storage, and cleanup.

## Why FFmpeg Poster-Only

VLC 3.x background snapshots are not reliable enough for deterministic poster
generation. Bundled FFmpeg is therefore kept as an internal poster generator
only.

FFmpeg is not exposed in Preferences and is not used for:

- background MP4 transcode jobs
- live transcode presentation
- user-selected executable paths
- runtime playback decisions

## Desktop Vs Web

| Capability              | Desktop                   | Web                    |
| ----------------------- | ------------------------- | ---------------------- |
| MP4 / MOV playback      | VLC or browser-native     | browser-native         |
| MKV / AVI / WMV         | VLC/libVLC                | unsupported            |
| Video posters           | bundled FFmpeg poster job | browser canvas when OK |
| User FFmpeg setting     | no                        | no                     |
| Background transcode    | no                        | no                     |
| Live transcode          | no                        | no                     |

## Runtime Packaging

Runtime binaries stay out of git and are prepared from `.local-runtimes/` into
`resources/video-engine/` before desktop packaging.

`npm run build` does not require runtime binaries. Desktop package commands run
`prepare:video-engine:strict` and fail when the current platform runtime is
missing.

Expected local runtime layout:

```text
.local-runtimes/
  vlc/darwin-arm64/
  vlc/darwin-x64/
  vlc/win32-x64/
  ffmpeg/darwin-arm64/ffmpeg
  ffmpeg/darwin-x64/ffmpeg
  ffmpeg/win32-x64/ffmpeg.exe
```

## License Notes

LibrePresenter is GPL-3.0-or-later. Bundled VLC/libVLC and FFmpeg notices live
under `resources/licenses/` and are surfaced from the About dialog.

This document is not legal advice. Before public release, verify the exact VLC
and FFmpeg binary sources, build flags, and license notice requirements.

## Rejected Approach

The earlier plan used user-selected FFmpeg plus Electron-only MP4 derivatives.
That approach was rejected because it added product friction and a large amount
of state management: validation, cancellation, recovery, partial outputs,
cleanup, profile tuning, and user-facing configuration.

Web transcoding was also rejected because ffmpeg.wasm size, memory behavior,
browser quota, and cross-origin isolation requirements are poor fits for the
current Web mode.

Reference material:

- FFmpeg pipeline and CLI docs: https://ffmpeg.org/ffmpeg.html
- FFmpeg legal notes: https://www.ffmpeg.org/legal.html
- ffmpeg.wasm usage and runtime size notes:
  https://ffmpegwasm.netlify.app/docs/getting-started/usage
- SharedArrayBuffer cross-origin isolation requirements:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
