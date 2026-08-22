# M9 Release / License / Distribution Plan

## Goal

Prepare LibrePresenter for public unsigned GitHub releases without paying for platform signing at this stage.

## Key Changes

- Keep app license as `GPL-3.0-or-later` unless a later legal review requires change.
- Keep VLC/FFmpeg/electron-vlc-player notices complete and packaged.
- Add release documentation for unsigned macOS and Windows builds.
- Keep Apple notarization and Windows code signing as optional future phases.
- Verify packaged runtime assets before release.
- Download release runtime archives from verified repository variables instead of committing binaries.
- Verify unpacked app resources with `npm run check:packaged-runtime`.
- Keep README professional and accurate; do not promise store distribution.

## Acceptance Criteria

- `LICENSE` and third-party notices are present and packaged.
- GitHub release artifacts can be built without signing credentials.
- Docs explain OS warnings for unsigned builds.
- Build fails if required bundled runtime assets are missing.
- CI quality gates run before release publishing.
- Release workflow does not require Apple or Windows signing secrets.
- Runtime archive checksums are validated before packaging.

## Verification

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
npm run build:unpack
```
