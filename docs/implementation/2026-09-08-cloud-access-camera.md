# Cloud document access and camera follow-up

Cloud documents use `/cloud-files`, the shared file catalog, and the existing personal-sync runtime. The local Files route excludes personal roots and searches only local records; the cloud route scopes navigation, search, and creation to the permitted owner's root. Routine sync status and manual retry controls are removed; conflict backup/discard actions remain available.

`presenter_cloud_access` comes from existing Account session and `/me` responses, derived from `presenter:cloud:use` through existing RBAC. It is independent of `admin_access`. Unknown or denied access disables the sidebar entry and personal sync. An offline restart retains only a previously confirmed permitted account. Upgrading from the old unpermissioned cache requires one successful account check; existing unsent data is preserved. Token refresh re-evaluates permissions; previously issued JWTs retain their normal expiry boundary.

LINE add-sync availability uses the existing ACL-filtered folder listing, excluding imported folders. It refreshes on focus, reconnect, after import, and every 30 seconds while Files is open. Existing imported-folder synchronization is unchanged.

Camera layouts persist per local `deviceId` as canvas center and cover-relative zoom. Entering Camera restores a still-present device; leaving disposes tracks and camera-owned projection. Late acquisition results are disposed. A changed device ID uses the default cover layout. Layouts are local and do not identify hardware across computers or browser-storage resets.

## Delivery

1. Deploy Account API #67 (permission registration, derived session access, first-party token compatibility).
2. Deploy Asset API #59 and Gateway #82 (permission checks on all personal-space routes).
3. Release Presenter 2.5.1 after CI passes.

No role or user receives a new direct grant automatically. Existing wildcard administrators qualify through effective RBAC. The background plan automation remains paused.

## Validation

Presenter: 277 test files / 3210 tests, lint, desktop build, and web build passed. Regression coverage includes per-device transforms, late camera acquisition after navigation, active-track disposal, camera-owned projection shutdown, cloud search boundaries, revoked offline access, and empty LINE ACL recovery. Browser UI and native Electron smoke verify visible/disabled cloud navigation and the camera canvas; cloud-page UI was checked with an isolated offline fixture. Real webcam/capture-card and authenticated cross-computer acceptance are separate device checks.

Account: full race tests with disposable Redis/PostgreSQL, migration rollback/reapply and custom-grant preservation, vet, migration policy, OpenAPI lint.

Asset: all Go tests with disposable PostgreSQL, all eight permission-denial routes, owner-scoped HTTP uploads/downloads, vet, OpenAPI lint.

Gateway: Go tests, vet, OpenAPI lint, Docker build and container route/body-limit smoke.
