# LibrePresenter

LibrePresenter is open-source presentation software for churches and live
events. It focuses on reliable projection, quick media playback, Bible display,
timers, and local-first operation.

## Features

- Dual-window projection for a control screen and a dedicated output screen
- Media library with folders, thumbnails, trash, and offline-ready native files
- Image, PDF, and video presentation
- Web mode with browser-native video playback
- Bible display and timer tools
- Local-first storage using IndexedDB and Electron native file storage

## Desktop vs Web

| Capability                      | Desktop         | Web |
| ------------------------------- | --------------- | --- |
| Image projection                | Yes             | Yes |
| PDF projection                  | Yes             | Yes |
| Browser-native video formats    | Yes             | Yes |
| MKV / AVI / WMV playback        | Planned desktop | No  |
| Native filesystem media storage | Yes             | No  |
| IndexedDB media storage         | Legacy fallback | Yes |

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Desktop packages:

```bash
npm run build:mac
npm run build:win
```

## Architecture

LibrePresenter is an Electron + React + TypeScript app.

- `src/main/`: Electron main process, windows, IPC, native protocols
- `src/preload/`: typed renderer bridge
- `src/renderer/src/`: React UI, stores, media services, projection screens
- `src/shared/`: shared IPC contracts and domain types

Advanced desktop video playback is being evaluated through an embedded libVLC
proof of concept. Web mode keeps using browser-native media APIs.

## License

LibrePresenter is licensed under GPL-3.0-or-later.

Third-party notices are documented in `THIRD_PARTY_NOTICES.md`.

## Contributing

Keep changes small, typed, and easy to review. Run lint, typecheck, tests, and
build before opening a pull request.

## Security

Please report security issues privately before public disclosure.
