# LibrePresenter Product Roadmap

LibrePresenter is open-source presentation software for churches and live events. The goal is not to clone ProPresenter feature-for-feature; the goal is to build the core operator workflows that make a presentation app dependable in a live room.

## Product Direction

- Desktop is the professional target. Web mode stays useful, but does not need desktop-level media engine parity.
- Projection reliability comes first. Every feature eventually depends on predictable output-window behavior.
- File Explorer is the media library, not the live service rundown.
- Service playlists/cues are the live workflow surface.
- Roadmap source of truth lives under `docs/roadmap/**`.

## Milestones

| Milestone | Status | Plan | Outcome |
| --- | --- | --- | --- |
| M1 | Implemented | `milestones/M1-projection-core.md` | Projection window/session lifecycle is reliable, lazy-opened, and fast enough for live use. |
| M2 | Implemented | `milestones/M2-media-library-sync.md` | Media library and sync status are understandable and recoverable. |
| M3 | Implemented | `milestones/M3-service-playlist-cue-workflow.md` | Operators can build and run a service rundown instead of presenting directly from folders. |
| M4 | Implemented | `milestones/M4-slide-ppt-template-system.md` | LibrePresenter can create and present native slides and import PPTX into that model. |
| M5 | Implemented | `milestones/M5-bible-professional-workflow.md` | Existing Bible tools become a live scripture workflow integrated with cues and templates. |
| M6 | Implemented | `milestones/M6-professional-media-playback.md` | Image, PDF, and video playback are production-grade and reusable across features. |
| M7 | Implemented | `milestones/M7-soundboard-midi.md` | Soundboard with mouse-first operation and optional MIDI support. |
| M8A | Implemented | `milestones/M8A-recovery-center.md` | Recovery Center derives actionable issues from existing media, sync, storage, and projection state. |
| M8B | Implemented | `milestones/M8B-lan-remote.md` | LAN-only mobile remote for live controls without cloud relay. |
| M9 | Implemented | `milestones/M9-release-license-distribution.md` | Public release path, license, notices, packaging, and unsigned distribution. |

## Execution Order

1. M1 Projection Core.
2. M3 Service Playlist / Cue Workflow.
3. M4 Slide / PPT / Template System.
4. M2 Media Library & Sync Reliability.
5. M6 Professional Media Playback.
6. M5 Bible Professional Workflow.
7. M7 Soundboard & MIDI.
8. M8A Recovery Center and M8B LAN Remote.
9. M9 Release / License / Distribution.

## Existing Plan Consolidation

The previous plans under `docs/superpowers/plans/2026-06-17-*.md` were consolidated into this roadmap:

- Soundboard -> `milestones/M7-soundboard-midi.md`
- Recovery Center -> `milestones/M8A-recovery-center.md`
- LAN Mobile Remote Control -> `milestones/M8B-lan-remote.md`

Future roadmap changes should update `docs/roadmap/**` only.
