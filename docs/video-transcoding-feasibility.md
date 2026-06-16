# Video Transcoding Feasibility Spike

Date: 2026-06-16

## Decision

Use **Electron-only background transcoding** with a user-selected FFmpeg executable. Web mode should
keep its current import/playback limits and show a clear unsupported-file message for formats that
require transcoding.

Do not add `@ffmpeg/ffmpeg`, do not bundle FFmpeg, and do not download FFmpeg from the app.

## Why

- HHC already has a dual Electron/Web architecture, but transcoding is not just codec detection. It
  needs long-running jobs, cancellation, restart recovery, temporary files, disk/quota checks, and
  stable derivative cleanup.
- Electron can run a native executable without sending whole media files through renderer IPC.
- Web transcoding would add a large optional runtime, extra deployment headers, and quota/memory
  risks that conflict with the current Web 2GB IndexedDB limit.
- FFmpeg licensing and build options vary by executable. User-managed FFmpeg keeps HHC out of
  redistribution and auto-update responsibility.

## Sources Checked

- FFmpeg docs describe the demuxer -> decoder -> filter -> encoder -> muxer pipeline and confirm
  that transcoding is required when output stream properties need to change:
  https://ffmpeg.org/ffmpeg.html
- FFmpeg legal docs state FFmpeg is LGPL by default, while optional GPL parts change the effective
  license when enabled:
  https://www.ffmpeg.org/legal.html
- FFmpeg format examples document MP4-compatible examples using `libx264` and `aac`:
  https://ffmpeg.org/ffmpeg-formats.html
- ffmpeg.wasm documents an approximately 31 MB core load for the single-thread example and notes
  that the multi-thread version requires `SharedArrayBuffer` security requirements:
  https://ffmpegwasm.netlify.app/docs/getting-started/usage
- MDN documents that `SharedArrayBuffer` requires a secure context and cross-origin isolation:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- MDN documents that cross-origin isolation requires COOP and COEP headers:
  https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated

## Input Matrix

The production test corpus should include:

| Container   | Video codecs               | Audio codecs   | Notes                                                         |
| ----------- | -------------------------- | -------------- | ------------------------------------------------------------- |
| AVI         | H.264, MPEG-4 Part 2       | MP3, AAC, PCM  | Common legacy camera/export files                             |
| MKV         | H.264, HEVC, MPEG-4 Part 2 | AAC, MP3, AC-3 | Often playable only after remux/transcode                     |
| WMV/ASF     | WMV video                  | WMA/PCM        | Highest chance of requiring full transcode                    |
| MP4 control | H.264                      | AAC            | Should pass through without transcode when already compatible |

Each row needs short, long, low-resolution, and high-resolution samples. This repository currently
does not include those samples, so no real throughput numbers are claimed in this spike.

## Local Probe

One local executable was probed only as evidence that the planned validation approach is practical:

```text
/opt/homebrew/bin/ffmpeg
ffmpeg version 8.1
```

Detected capabilities:

- Encoders: `libx264`, `libx264rgb`, `h264_videotoolbox`, `aac`, `aac_at`
- Demuxers: `avi`, `matroska,webm`, `asf`, `asf_o`

This does not prove Windows or Intel macOS support. The app must validate the selected executable on
the user machine at startup and before each job.

## Electron Design Constraint

Minimum accepted output profile:

```text
container: mp4
video: h264
audio: aac
pixel format: yuv420p
flags: +faststart
```

Validation must require:

- absolute, resolved regular executable file
- no shell invocation
- short `ffmpeg -version` timeout
- required demuxers for accepted input containers
- required decoder for the source stream
- H.264 encoder capability, preferring `libx264`
- AAC encoder capability
- MP4 muxer
- deterministic temporary file followed by atomic rename

The renderer must never accept or store arbitrary executable paths. Preferences can display basename,
status, detected version, and capability summary only.

## Web Decision

Do not implement Web transcoding in this plan.

Reasons:

- `@ffmpeg/ffmpeg` adds a large runtime even before processing user media.
- Multi-thread ffmpeg.wasm requires `SharedArrayBuffer`, which requires cross-origin isolation.
- Cross-origin isolation affects deployment headers and can break third-party embedded resources.
- Browser quota and memory behavior for hundreds of MB files is unpredictable enough that a fixed
  500 MB threshold would be misleading.

Web should instead classify unsupported formats and show a clear message explaining that transcoding
is currently available only in the Electron app after FFmpeg is configured.

## Follow-Up Phases

Phase 2B should implement the derivative/job model without assuming FFmpeg exists.

Phase 2C should implement Electron native transcoding with:

- Preferences > Media > Video Transcoding
- Select FFmpeg, Validate again, Remove configuration
- blocked job state when FFmpeg is missing or invalid
- one concurrent transcode by default
- startup and pre-job revalidation
- no raw path exposure to renderer state, logs, LAN snapshots, or diagnostics

## Acceptance Notes

- No production dependency is added by this spike.
- No automatic FFmpeg download is planned.
- No bundled FFmpeg is planned.
- No Web transcoding implementation is approved.
