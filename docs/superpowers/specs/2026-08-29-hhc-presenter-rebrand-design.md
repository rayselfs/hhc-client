# HHC Presenter Rebrand Design

## Decision

Rename the existing LibrePresenter product and GitHub repository to HHC Presenter as a clean
application identity. Existing installations, updater behavior, user data, credentials, and saved
content are not migrated or supported by the new application.

## Product Identity

| Field | Value |
| --- | --- |
| English name | `HHC Presenter` |
| Traditional Chinese name | `HHC 投影系統` |
| Simplified Chinese name | `HHC 投影系统` |
| Positioning | Church projection system |
| English description | `A projection system designed for church services.` |
| Traditional Chinese description | `專為教會聚會設計的投影系統。` |
| Simplified Chinese description | `专为教会聚会设计的投影系统。` |
| npm/package name | `hhc-presenter` |
| GitHub repository | `rayselfs/hhc-presenter` |
| Application ID | `tw.org.alive.presenter` |
| Executable name | `hhc-presenter` |
| URL protocol | `hhc-presenter://` |
| Updater cache | `hhc-presenter-updater` |
| Presentation MIME type | `application/vnd.hhc.presenter+json` |
| Release version | `2.4.0` |

## User-Visible Naming

The React UI uses the existing `en`, `zh-TW`, and `zh-CN` i18next bundles. Product names and
descriptions follow the selected application language. This includes Welcome, About, loading,
OneDrive copy, and the empty projection fallback in the center of the projection window.

Operating-system packaging, installer names, browser titles, executable names, and release assets
use the canonical English name `HHC Presenter` or slug `hhc-presenter`.

## Clean Identity Boundary

There is no compatibility layer for the former application:

- Do not migrate the old Electron `userData` directory.
- Do not read old IndexedDB databases or localStorage keys.
- Do not accept the old URL protocol or presentation MIME type.
- Do not preserve the old app ID, updater cache, executable, package name, or LAN header.
- Do not add fallback aliases, one-time importers, or bridge releases.

Existing dated plans and release records may retain the former name when it is historical evidence.
Active source, configuration, tests, README, current product documentation, package artifacts, and
release automation use only the new identity.

## Repository And Release

Rename the existing GitHub repository from `rayselfs/libre-presenter` to
`rayselfs/hhc-presenter` after the rename PR merges and before tagging `v2.4.0`. Update the local
remote and every active repository URL/configuration before release.

The new release uses the normal GitHub `latest` updater metadata. Compatibility behavior of old
installations is explicitly outside scope.

## Platform Update Flow

The packaged app checks GitHub once after startup and every 60 minutes while it remains open. The
main process owns the schedule so renderer navigation and window state do not affect update checks.

### Windows

Windows uses `electron-updater` with automatic download enabled and automatic installation
disabled. When a newer version is detected, download begins without another user action. After the
download completes, the UI reports that installation is ready. Choosing **Install update** asks
whether to close HHC Presenter and install it; declining leaves the verified update ready for a
later install action.

If the next scheduled check finds an even newer version before installation, `electron-updater`
validates the pending package against the new update metadata and checksum, clears the stale cached
package, and downloads the newer package. Do not add a second application-managed Windows update
cache. A check already in progress or an active download is not started again; the next hourly check
handles the newer release.

### macOS

macOS uses `electron-updater` only to detect the latest version because this release is not signed
or notarized with an Apple Developer identity. Detection never starts an automatic macOS update.
The user explicitly chooses **Download update**, after which the main process downloads this exact
release asset into an HHC Presenter-owned temporary directory:

```text
https://github.com/rayselfs/hhc-presenter/releases/download/v{version}/hhc-presenter-{version}.dmg
```

Before each download, remove only older DMG files inside that managed directory. Download the same
release's `SHA256SUMS`, require an exact entry for the DMG filename, and verify it with Node's
built-in SHA-256 implementation. A missing or mismatched checksum deletes the DMG and reports an
error. Only a verified DMG may be opened with Electron `shell.openPath()`.

After the DMG opens, show installation guidance in the current app language. The primary path is
**System Settings → Privacy & Security → Open Anyway**. Also provide this copyable fallback command
with a warning that it bypasses Gatekeeper for the installed app:

```bash
xattr -dr com.apple.quarantine "/Applications/HHC Presenter.app"
```

HHC Presenter must never execute that command automatically. No new download, checksum, or update
dependency is required: use Electron's native download APIs, `net.fetch`, and Node `crypto`.

Release acceptance requires green CI, macOS arm64 and Windows x64 packages, correct updater
manifests, checksums, release assets, and fresh-install smoke on both platforms. Automated checks
must cover the Windows automatic-download/manual-install state change and the macOS
download/checksum/open flow. Because `v2.4.0` cannot update to itself, the first live cross-version
installed-device proof happens with the next normal release that already contains product fixes;
do not create a test-only release or claim this as a `v2.4.0` result.
OAuth redirects for Account and OneDrive must accept `hhc-presenter://` before the release is
published.
