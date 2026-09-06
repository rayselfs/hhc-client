# Single Camera Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not delegate unless separately authorized.

**Goal:** 提供單一 Webcam／影像擷取卡來源，在固定 16:9 畫布上移動及等比例縮放，將相同構圖即時投影出去。

**Architecture:** 主視窗的 app-scoped capture service 只擷取一條 video track，供操作預覽及本機 WebRTC 投影視窗使用。預覽與投影共用 DOM video stage 及邏輯座標；既有 projection adapter 傳送 serializable transform/state 與 WebRTC signaling，延伸既有 owner/generation/replay 規則。

**Tech Stack:** TypeScript、React 19、Zustand、Electron、MediaDevices、RTCPeerConnection、CSS transform、Pointer Events；不引入 OBS、FFmpeg capture pipeline 或新的 UI／串流依賴。

**Spec:** 本文件「Confirmed scope and design」承載 2026-09-05 對話確認需求：一次一個來源、預設只有 cover、保留手動移動縮放。使用者於 2026-09-06 授權依本計劃實作；merge、release 與正式硬體驗收尚未完成。

## Product amendment — 2026-09-07

Approved correction supersedes previous capture lifecycle and workspace controls: the independent item is named Camera. Source selection lives in the common Header in the Bible selector position. Selecting a source starts capture; capture persists across navigation, projection stop and owner changes until source replacement, source failure or app shutdown. Only the Header controls projection. Remove page title, preview badge, enable/start/stop controls and inline keyboard hint. Reset precedes X/Y/width; frame border supports both themes. Eight presentation-style handles preserve aspect ratio and clip naturally with the source. Page-scoped camera shortcuts are registered and listed in the user menu.

## Product amendment — 2026-09-06

User correction supersedes the original media entry and non-persistence decisions below: camera is an independent top-level navigation item. Its page always shows the canvas. Persist only the last successfully selected device ID locally; on page entry, enumerate and preview that exact device if present. Missing devices leave the canvas empty; automatic preview does not claim projection ownership.

## Execution status — 2026-09-06

- Tasks 1–4: capture/peer, shared stage, workspace and projection integration implemented on `feat/single-camera-projection`, based on `origin/main` `3e523d35`.
- Task 1 transport gate: physical MacBook Air Camera passed in Electron dual-window probe (1920×1080, 30 fps, 120 received frames). Browser physical capture also passed; Windows and capture-card evidence remain pending. This macOS result permitted dependent UI work; it does not complete the cross-platform acceptance gate.
- Task 5: 3,124 unit/regression tests, two browser camera E2E tests, web/desktop builds and local macOS unpacked build passed. Packaged recovery smoke passed. Detailed evidence and remaining hardware gates: `docs/reports/2026-09-06-camera-projection-smoke.md`.
- Native `RTCRtpSender.degradationPreference = maintain-resolution` avoids the downscaling observed in the initial probe; constrained hardware may reduce frame rate instead.
- The final implementation uses existing projection regression files instead of a separate `camera-projection.test.ts`. Commits are consolidated for review. Unchecked compound steps below retain any unmet hardware, release or exact procedural gate.

## Global Constraints

- 同時只選一個來源；不做多來源、圖層清單或 scene 系統。
- 固定 16:9，加入時 cover 置中；不提供 contain、stretch 或 fit 模式切換。
- 可拖曳移動與等比例放大縮小；畫布外裁切。手動縮小後可以露出黑色底，不自動強制拉回 cover。
- 第一版只處理影像，不含音訊、錄影、RTMP、網路直播、NDI 或廠商專用 capture SDK。
- 僅支援 Chromium 能列為 videoinput 的裝置；不能宣稱任意擷取卡皆可使用。
- Electron macOS、Windows 與 browser 都驗證；硬體 smoke 不以 mock 或 dev server 通過替代。
- 導航本身不切換投影 owner；保留 Timer 導航回收 owner 的既有例外。不得新增 user-facing blank mode。
- MediaStream、RTCPeerConnection、DOM refs 留在 service/context；Zustand 只放 serializable data。資源以 effect 建立並正確處理 StrictMode cleanup。
- 實作時自最新 `origin/main` 建立隔離 worktree；保留既有使用者文件。實作僅限本功能。

## Confirmed scope and design

### Product flow

1. 多媒體頁提供「攝影機」入口，開啟 camera workspace；不自動改變目前投影。
2. 使用者按「選擇來源」觸發攝影機授權，列出 videoinput；來源選定後顯示預覽，新的來源重設為 cover 置中。
3. 在畫布上拖曳／四角等比例縮放，也可鍵盤移動與調整尺寸；「重設位置」回到 cover，沒有其他 fit 選項。
4. 「開始投影」明確取得 camera owner；投影只顯示画布內容，沒有邊框、控制點或來源名稱。投影中操作即時反映，不做另一個 preview/program 模式。
5. 離開 workspace 但 camera 仍為投影 owner 時，capture 繼續。其他內容取得 owner 後結束 camera peer；只有 workspace 仍在預覽時保留本機 capture。
6. 按「停止投影」走現有關閉投影流程；workspace 可繼續預覽。離開 workspace 且無 camera 投影使用者時停止所有 tracks。
7. 拔除／permission revoked／track ended 時投影輸出黑色無訊號底，操作端顯示中斷並提供重試；不凍結最後一幀當成 live，也不自動改用另一台設備。這是來源失效呈現，不新增 blank 控制。

工程預設：請求 ideal 1920×1080、30 fps，不要求 exact resolution；採裝置實際 settings 計算比例。來源 device ID 只保留本次 session，不跨電腦同步或持久保存自動開機擷取設定。

### Geometry contract

```ts
export const CAMERA_STAGE = { width: 1920, height: 1080 } as const
export type CameraTransform = { x: number; y: number; width: number; height: number }

export function createCameraCover(width: number, height: number): CameraTransform {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid camera dimensions')
  }
  const scale = Math.max(CAMERA_STAGE.width / width, CAMERA_STAGE.height / height)
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  return {
    x: (CAMERA_STAGE.width - scaledWidth) / 2,
    y: (CAMERA_STAGE.height - scaledHeight) / 2,
    width: scaledWidth,
    height: scaledHeight
  }
}
```

- 4:3 source 640×480 → `{ x: 0, y: -180, width: 1920, height: 1440 }`；只裁掉上下。
- 所有互動座標換算到 1920×1080 邏輯座標。stage 在不同容器等比例縮放；外層 `overflow: hidden`、黑底。來源 video 顯示完整比例後依 transform 裁切，不再疊加第二次 cover。
- 手動 resize 固定對角，保留 native aspect ratio；正數尺寸、有限值驗證。互動縮放範圍採初始 cover 的 0.05–8 倍；位置允許超出邊界但限制在畫布各方向 8 倍內，重設永遠可回復。
- 共用 `CameraStage` 渲染 video；選取框與 handles 只在 workspace 外掛，不傳到 projection。
- 初始計算等到 video dimensions 已知；frame dimension 改變時保持中心與相對 cover zoom 重新計算。明確換來源則重設 cover。

### Capture, transport and lifetime

- `CameraSessionContext` 掛在控制主視窗 Layout，持有 `camera-session.ts` service；workspace mount/unmount 只改 preview consumer，不直接 stop 正在投影的 track。
- 首次使用由 user gesture 請求 permission；拒絕後不迴圈重問。browser insecure context 清楚顯示不可使用；Electron 權限 handler 僅允許既有可信視窗與 video media request。
- 切換來源先停止舊 track 再開新來源，確保一次一個且相容獨占設備。成功後新 session ID、cover transform、replaceTrack 或重建 peer；失敗保持無訊號並提示重選，不偷偷改裝置。
- WebRTC 僅用同機兩視窗 peer，`iceServers: []`；主視窗唯一 offerer。Signal 透過現有 adapter，內容限 SDP offer/answer、ICE candidates；不得把 MediaStream、逐幀 base64 或影像 bytes 塞進 IPC/BroadcastChannel。
- 每個 signal 綁 projection generation + camera session ID；僅對目前主視窗／投影視窗接收。先到 ICE 排隊至 remote description 完成；stale signal 丟棄；失敗先關閉舊 peer 再重建，最多三次，之後顯示「重新連線」。
- 不用公網 STUN/TURN 或雲端 signaling。若同機 peer 在支援平台不成立，Task 1 判定 gate 失敗，先修訂方案，不悄悄加入服務。
- replay 只保存當前 session ID、transform、live/error state，不重放 SDP。投影視窗重新 ready 後重新建立連線；track 到達前不宣稱 live。
- WebRTC 加入編解碼延遲；必須在實機測量。不能以「同機」推論零延遲。

### Projection contract

```ts
export type CameraState = {
  sessionId: string
  transform: CameraTransform
  status: 'connecting' | 'live' | 'unavailable'
}
export type CameraSignal = {
  sessionId: string
} & ({ kind: 'offer' | 'answer'; sdp: string } | { kind: 'ice'; candidate: RTCIceCandidateInit })
```

新增 `'camera:state': CameraState`、`'camera:signal': CameraSignal`，generation 沿用 transport envelope。`ProjectionOwner` 加 `'camera'`；snapshot 加 camera state；signal 不屬於 content/replay channel。main IPC validator 驗證 finite transform、尺寸邊界、session ID、SDP/ICE 長度上限（64 KiB／8 KiB）及 sender direction；browser adapter 同樣驗證 payload，不能只依 TypeScript。

現有 `'__system:active-owner'`、blackout、recovery、owner switching 仍為唯一狀態來源。camera owner 切換時清掉舊 VLC surface；camera peer 的晚到 frame/state 不能蓋回 Bible、Timer 或 Media。既有 blackout 只遮蔽輸出，可保持 track；解除後仍依 active owner 顯示。

## File map

| Responsibility        | Existing files to modify                                                                                                                                                                                                                                                                         | New files                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Geometry/rendering    | reuse existing pointer/viewport patterns after inspecting callers                                                                                                                                                                                                                                | `src/renderer/src/lib/camera-transform.ts`, `components/Common/CameraStage.tsx`, `lib/__tests__/camera-transform.test.ts` |
| Capture/peer          | `components/Control/Layout.tsx`                                                                                                                                                                                                                                                                  | `lib/camera-session.ts`, `lib/camera-peer.ts`, `contexts/CameraSessionContext.tsx`, corresponding tests                   |
| Serializable state/UI | `pages/FilesPage.tsx`, `router.tsx`, `locales/{en,zh-TW,zh-CN}.json`                                                                                                                                                                                                                             | `stores/camera.ts`, `pages/CameraWorkspacePage.tsx`, `pages/__tests__/CameraWorkspacePage.test.tsx`                       |
| Projection            | `src/shared/projection-messages.ts`, `lib/projection-adapter.ts`, `lib/projection-session-coordinator.ts`, `lib/projection-render-state.ts`, `lib/projection-actions.ts`, `contexts/ProjectionContext.tsx`, `pages/ProjectionPage.tsx`, `src/main/ipc/projection.ts`, `src/main/ipc/validate.ts` | `components/Projection/CameraProjection.tsx`, `lib/__tests__/camera-projection.test.ts`                                   |
| Platform permissions  | `src/main/index.ts`, `src/main/windowManager.ts`, `electron-builder.yml`, `src/renderer/index.html`, existing entitlements file if configured                                                                                                                                                    | permission tests alongside existing main process tests                                                                    |
| Real browser checks   | `playwright.config.ts` only if per-project media flags needed                                                                                                                                                                                                                                    | `e2e/camera-projection.spec.ts`, `docs/reports/2026-09-05-camera-projection-smoke.md` at execution time                   |

不建立一般化 scene/layer 模型。`stores/camera.ts` 不持久化 runtime stream 或 connection；若日後持久化 preference 必須用 `hhcPersistStorage`、`createPersistName`、`partialize` 和 version migration。

## Task 1: Prove single capture across actual projection windows

**Files:** `camera-session.ts`, `camera-peer.ts`, corresponding tests; permission/build configuration and shared signal definitions.
**Interfaces:** `createCameraSession()` produces a service with `selectSource(deviceId): Promise<MediaStream>`, `getStream(): MediaStream | null`, `dispose(): void`. `createCameraPeer({ role, sessionId, sendSignal, onStream })` exposes `start(stream?)`, `acceptSignal(signal)`, `dispose()`; role is `'main' | 'projection'`, main requires a video stream, projection never opens camera.

- [x] Add minimal tests for denied permission, stale selectSource completion, only-one-active-track, dispose stopping track, ICE-before-SDP and stale session rejection. Use existing Vitest style and injected MediaDevices/peer constructor for tests.
- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/camera-session.test.ts src/renderer/src/lib/__tests__/camera-peer.test.ts` to establish failing behavior.
- [x] Implement capture with `{ audio: false, video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } }`; do not request microphone. Stop a late-resolving superseded stream immediately.
- [x] Implement single-offerer same-machine peer with session fencing and deterministic cleanup. Reuse adapter for signal transport, not a new socket server.
- [x] Configure macOS camera usage description and required signing entitlements; scope Electron media permissions to trusted app windows. Inspect current CSP and only add directives actually required; do not broaden origin allowlists.
- [ ] Run a focused actual dual-window probe with Webcam and available capture card on macOS/Windows, plus browser. Record resolution/fps, actual frame receipt, permission path, device identity and capture latency; clearly distinguish unavailable hardware from pass.
- [ ] Gate: no reliable same-machine peer or severe freeze/latency → stop dependent UI work and record failing evidence. Passing platform probe → commit `feat: add single camera capture transport`.

## Task 2: Cover-only transform and shared stage

**Files:** `camera-transform.ts`, `CameraStage.tsx`, transform tests.
**Interfaces:** Exports `CAMERA_STAGE`, `CameraTransform`, `createCameraCover` above; `CameraStage` receives `{ stream: MediaStream | null; transform: CameraTransform }` and manages video `srcObject` in effect without owning track disposal.

- [ ] Add exact geometry and invalid input tests:

```ts
expect(createCameraCover(640, 480)).toEqual({ x: 0, y: -180, width: 1920, height: 1440 })
expect(createCameraCover(1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
expect(() => createCameraCover(0, 480)).toThrow('Invalid camera dimensions')
```

- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/camera-transform.test.ts`; add portrait and ultrawide cases, container-size coordinate conversion and fixed-opposite-corner resize checks.
- [x] Implement supplied cover formula, normalized pointer deltas and DOM stage; use Pointer Events/pointer capture, finite bounds, `playsInline`, muted preview and rejected play handling.
- [ ] Re-run tests; visually compare identical transform in small preview and fullscreen stage. Commit `feat: render cover-only camera stage`.

## Task 3: Single-source workspace and app-scoped lifetime

**Files:** context, store, Layout, CameraWorkspacePage, FilesPage entry, router/locales and workspace tests.
**Interfaces:** Workspace consumes Task 1 service and Task 2 stage. Store tracks selected device, transform and serializable capture status; preview attachment is a service consumer count, not a persisted preference.

- [ ] Add UI tests for source selection, exactly one selected source, no fit-mode control, reset-to-cover, resize/move via mouse and keyboard, source error and route exit while projection owns camera.
- [ ] Run `npx vitest run src/renderer/src/pages/__tests__/CameraWorkspacePage.test.tsx` before implementation.
- [x] Add a camera entry in multimedia and source selector; do not introduce a separate global sidebar domain. Query labels after permission and refresh list on devicechange, with no automatic fallback capture.
- [x] Implement drag and corner resize; map displayed-stage coordinates to logical stage. Keyboard arrows move 1 logical pixel, Shift+arrow moves 10; accessible numeric position/width controls provide resize without pointer, deriving height from source aspect ratio.
- [x] Add reset/start/stop controls and clear permission/no-device/in-use/device-removed states. Stop all tracks when neither preview nor active projection needs the service; StrictMode cleanup/recreation remains safe.
- [ ] Re-run workspace/session tests, include mount/unmount and rapid source changes, commit `feat: add single camera projection workspace`.

## Task 4: Projection ownership, replay and recovery

**Files:** all projection map files plus CameraProjection and tests; extend existing reducer/coordinator/IPC validator tests.
**Interfaces:** Consumes CameraState/CameraSignal and service. Produces `camera` owner lifecycle and replay snapshot; signal remains transient, fenced by generation/session.

- [ ] Add tests for explicit start only, navigation not claiming owner, Timer exception, camera→Bible/media/VLC switch, blackout, late signal, invalid transform and projection reopen.
- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/camera-projection.test.ts src/renderer/src/lib/__tests__/projection-render-state.test.ts src/main/__tests__/ipc/projection.test.ts` before changes.
- [x] Reserve browser popup synchronously in start button user gesture using existing projection opening flow; then connect async capture/peer. Failure must not leave a false live indicator or steal another owner's content.
- [x] Extend owner union, coordinator snapshots, render reducer and IPC validation together. Audit every `ProjectionOwner` switch, content channel exclusion and replay handler for camera exhaustiveness.
- [x] Send transform changes at most once per animation frame and flush final pointer-up state; replay always contains latest transform. Receiving projection displays same stage and black/no-signal output until track arrives.
- [x] On projection ready/reopen, renegotiate current live track; do not replay old offers/candidates. On owner loss, close camera peer and clear pending reconnection work; keep capture only for mounted preview.
- [ ] Re-run projection regressions including packaged VLC surface handoff; commit `feat: integrate camera projection ownership and recovery`.

## Task 5: Automated and physical-device acceptance

**Files:** `e2e/camera-projection.spec.ts`, report path in map; existing test configuration only where necessary.

- [x] Add browser E2E using isolated fake-video-device launch flags, never production permission bypass. Assert source selection, cover crop, moved/scaled parity across two windows, projection reopen and stopping tracks after final consumer exit.
- [x] Run `npx playwright test e2e/camera-projection.spec.ts --project=chromium`; synthetic source proves geometry/lifecycle only, not capture-card compatibility.
- [ ] Run `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`, `npm run build:web` plus affected packaged tests. Check browser console/CSP and memory after repeated open/close/switch cycles.
- [ ] Physical matrix: macOS signed app, Windows installed app, HTTPS/localhost browser; built-in/USB Webcam and UVC capture card. Test permission denial then recovery, app restart, device busy, unplug/replug, 4:3/16:9 inputs and 30-minute continuous projection.
- [ ] Measure capture-to-projection delay with source-visible timer/frame counter and external observation, record sample count and median/p95. Initial engineering gate: 1080p30 p95 ≤250 ms over at least 30 measurements and no unexplained freezes >1 second during 30-minute run; do not infer latency from WebRTC connection success. If unmet, report measurements and fix or revise target before declaring acceptance.
- [ ] Check projected framing matches preview at different window sizes/display DPI; no controls leak to audience. Capture LED/track readyState must stop after all consumers end.
- [ ] After authorized PR/CI/merge, perform normal macOS/Windows release and web deployment, then repeat installed-device smoke. No camera release is blocked on personal-cloud backend delivery.
- [ ] Record commit, app version, hardware/driver/OS, input format, test evidence, failed/unavailable cases. Preserve task worktree if release or required hardware smoke remains incomplete.

## Acceptance checklist

- [x] Exactly one selected source; only video permission, no scene/layer/fit-mode UI.
- [ ] Initial cover is correct for all tested aspect ratios; manual movement/resize is preserved and clipped identically in projection.
- [ ] Camera projection survives workspace navigation and projection reopen; explicit owner switches and Timer exception remain correct.
- [x] Disconnect displays unavailable state without wrong-device fallback or frozen live frame.
- [ ] Permissions, browser transport and packaged macOS/Windows hardware smoke have separate evidence.
- [ ] Resource cleanup and latency gate pass; no claim of universal capture-card or zero-latency support.
