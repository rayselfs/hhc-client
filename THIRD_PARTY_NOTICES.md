# Third-Party Notices

LibrePresenter includes and depends on open-source software. This file is a
summary; bundled license texts and source/build metadata live under
`resources/licenses/`.

## Desktop Video Engine

### VLC / libVLC

Desktop video playback is powered by VLC/libVLC. VLC is developed by the
VideoLAN project. VLC and libVLC components are distributed under GPL and LGPL
licenses depending on the component.

Bundled notices:

- `resources/licenses/vlc/LICENSE.GPL-2.0`
- `resources/licenses/vlc/LICENSE.LGPL-2.1`
- `resources/licenses/vlc/source-url.txt`
- `resources/licenses/vlc/build-info.json`

### FFmpeg

Desktop video poster generation uses FFmpeg. LibrePresenter uses FFmpeg only to
extract still-image posters; it is not exposed as a user-configurable transcoder.

Bundled notices:

- `resources/licenses/ffmpeg/LICENSE.LGPL-2.1`
- `resources/licenses/ffmpeg/source-url.txt`
- `resources/licenses/ffmpeg/build-info.json`

### electron-vlc-player

LibrePresenter embeds libVLC through `electron-vlc-player`.

Bundled notices:

- `resources/licenses/electron-vlc-player/LICENSE.MIT`
- `resources/licenses/electron-vlc-player/source-url.txt`
- `resources/licenses/electron-vlc-player/build-info.json`

## Runtime Dependencies

The app also uses Electron, React, Vite, pdfjs-dist, HeroUI, i18next, Zustand,
and other npm dependencies. Their exact package versions are tracked in
`package-lock.json`.

VLC/libVLC and FFmpeg binaries are supplied to release packaging through
verified runtime archives, not committed to git. Exact binary source, version,
and checksum details should be recorded with each published release.

Before publishing a release, run the package license check and ensure this file
and bundled binary notices are included in the packaged app.
