# Dependency Security Review

Date: 2026-08-22  
Scope: media-projection merge-readiness closure  
Command: `npm audit --omit=dev`

## Result

The compatible update pass reduced the production-scope audit result from 30 packages
(2 critical, 25 high, 2 moderate, 1 low) to 14 packages (2 critical, 12 high).
No force update, Electron major update, dependency replacement, or new dependency was used.

Updated direct dependencies:

| Root | Before | After | Disposition |
| --- | --- | --- | --- |
| `axios` | 1.15.0 | 1.19.0 | Cleared |
| `electron-updater` | 6.8.3 | 6.8.9 | Cleared, including `builder-util-runtime` |
| `microsoft-cognitiveservices-speech-sdk` | 1.49.0 | 1.51.0 | Cleared |
| `react-router-dom` | 7.14.0 | 7.18.2 | Cleared, including `react-router` |
| `uuid` | 13.0.0 | 13.0.2 | Cleared; Speech SDK's nested copy is 11.1.1 |
| `vite` | 7.3.2 | 7.3.6 | Cleared |
| `electron` | 39.8.6 | 39.8.10 | Latest compatible 39.x; residual major-only advisories remain |
| `electron-builder` | 26.8.1 | 26.15.3 | Build-tool update; clears its compatible transitive paths |

Compatible transitive updates also cleared the reported `brace-expansion`, `esbuild`,
`ip-address`, `js-yaml`, `nanoid`, and `postcss` paths.

## Remaining dispositions

| Package/path | Reachability and affected feature | Fixed version / compatible update | Mitigation and disposition | Owner / trigger |
| --- | --- | --- | --- | --- |
| `@xenova/transformers` -> `onnxruntime-web` -> `onnx-proto` -> `protobufjs` (critical/high), plus `sharp` (high) | Runtime, isolated Whisper Web Worker. Models come from an operator-selected local model directory. The protobuf code-execution advisory requires attacker-controlled schema/descriptor loading; the app does not expose such an input. A malicious or untrusted model directory remains outside the supported trust boundary. | No compatible fix in Transformers.js 2.17.2. Audit's suggested downgrade to 1.4.2 is not a valid security upgrade. Patched `protobufjs` starts at 7.5.5, but the chain pins 6.x. `sharp` is fixed at 0.35+. | Accept for this closure. Only use HHC-approved Whisper model bundles; keep processing inside the Worker. Do not accept arbitrary model packages. | Client maintainers: qualify a supported Transformers/ONNX upgrade when upstream exposes patched transitive versions, or before remote/user-shared model installation is added. |
| `electron-vlc-player` -> `@electron/rebuild` -> `@electron/node-gyp` -> `make-fetch-happen` / `cacache` / `tar` (critical/high) | Install/rebuild toolchain for the VLC native binding. These packages are not invoked by normal media playback. The vulnerable `tar` 6.2.1 paths process build inputs, not user media. | No compatible upstream release of `electron-vlc-player`; audit reports no fix for the root and current `tar` advisory set. | Accept for this closure. Keep the lockfile pinned, require registry integrity in CI, and never feed untrusted archives to rebuild scripts. Packaged artifacts are checked on both target OSes before release. | Client maintainers: upgrade or replace the binding when upstream moves off rebuild 3.x, or immediately if the build begins consuming operator-supplied archives. |
| `electron` -> `extract-zip` (high) | Electron is shipped at runtime; `extract-zip` is used to obtain the Electron binary during dependency installation. | Current 39.x has no non-breaking fix; audit recommends Electron 43.4.1. `extract-zip` has no standalone patched version reported. | Defer the major upgrade. Renderer windows use `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; navigation and popup targets are restricted. Dependency installation remains lockfile/integrity controlled. | Client maintainers: qualify Electron 43+ with VLC native ABI and macOS/Windows packaged tests before the next desktop release line. |
| `pdfjs-dist` 5.7.284 (high) | Runtime PDF rendering of operator-selected files. The advisory requires PDF.js viewer scripting enabled and an execution-permitting CSP. This app uses the core `getDocument`/canvas API, not `PDFViewer`, and its CSP does not allow inline scripts or JavaScript eval. | Patched only in 6.2.108, a major update outside this closure. | Not exploitable through the implemented rendering path under the current CSP. Keep PDF viewer scripting unimplemented and preserve CSP. | Client maintainers: upgrade to PDF.js 6.2.108+ before adding PDF annotations/viewer scripting or relaxing `script-src`. |

## Baseline roots explicitly checked

The baseline direct roots were `@xenova/transformers`, `axios`, `electron`,
`electron-updater`, `electron-vlc-player`, `microsoft-cognitiveservices-speech-sdk`,
`pdfjs-dist`, `react-router-dom`, `uuid`, and `vite`. The transitive `tar` paths were
reviewed separately above. Every root is either cleared by the lockfile update or has a
disposition in this document.

## Release gate

Re-run `npm audit --omit=dev` from a clean install. The accepted snapshot is exactly:

- 14 vulnerable packages total
- 2 critical: `protobufjs`, `tar`
- 12 high: the remaining Transformers, VLC build-chain, Electron, and PDF.js groups above
- 0 moderate, 0 low

Any new package, severity increase, changed dependency path, or loss of a stated mitigation
requires a new review. A clean audit is not claimed.
