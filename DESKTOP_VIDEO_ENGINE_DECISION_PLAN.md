# LibrePresenter 計畫拆分與 Desktop Video Engine 決策

## 目的

原本計畫把 rename、license、README、media service refactor、desktop video engine 全部綁在一起。現在已確認 `spawn mpv executable` 會開外部 mpv window，不符合「影片仍在 LibrePresenter projection window」的產品需求。

因此 `spawn mpv executable` 版本不進產品 runtime。接下來改以 libVLC embedded POC 驗證正式 desktop video engine。

## Track A：Branding / License / README

這組可以先獨立完成，不依賴 video engine 決策。

- 專案名稱改為 `LibrePresenter`
- `package.json`：
  - `name`: `libre-presenter`
  - `license`: `GPL-3.0-or-later`
- `electron-builder.yml`：
  - `productName`: `LibrePresenter`
  - `executableName`: `libre-presenter`
  - `appId`: `org.librepresenter.app`
- UI user-facing `HHC Client` 改為 `LibrePresenter`
- 新增 root `LICENSE`
- 新增 `THIRD_PARTY_NOTICES.md`
- README 改成專業開源產品入口

建議 commit：

```text
chore: rename project to librepresenter
docs: professionalize readme and license notices
```

## Track B：Page-Agnostic Media Services

這組也可以獨立做，但要避免綁定具體 video engine。

- Blob identity resolver
- metadata service
- thumbnail / poster service
- media URL resolver
- cleanup service
- File Explorer、Presenter、未來 Soundboard 都透過 service 取得 media data

原則：

- service 以 `blobId` / `item.url` / storage identity 為入口
- 不吃 File Explorer 或 Presenter component state
- 不預先做 plugin system 或大 media framework
- video engine adapter 只定義最小 port，不綁定具體 engine

建議 commit：

```text
refactor: extract reusable media services
```

## Track C：已遺棄的 mpv executable spike

`spawn mpv executable` 結論：

- 優點：
  - 可快速驗證 MKV/AVI 等格式能播放
  - metadata / poster 可透過 mpv command 取得
- 問題：
  - present video 時會開 mpv 自己的 native window
  - projection BrowserWindow 不再是實際 video surface
  - 產品體驗不像 LibrePresenter 內建播放

結論：

- 不把 `spawn mpv executable` 作為正式方案
- 不保留產品 runtime code
- 正式 desktop video engine 需要 embedded library 方案

## Track D：libVLC Embedded POC

目標：

- Electron desktop 支援 MKV / AVI / MOV / MP4 等常見格式
- 影片仍顯示在 LibrePresenter projection window 或其受控 projection surface
- Control window 可控制 play / pause / seek / volume / status
- Web 維持 browser-native video whitelist

目前優先 POC libVLC embedded。

- 格式支援成熟
- embedded use case 較明確
- 比 external player process 更符合產品體驗
- 官方 API 支援將 video output 指到 macOS `NSView` 與 Windows `HWND`
- 仍需處理 native dependency、packaging、codesign、crash cleanup

參考：

- libVLC media player API：`libvlc_media_player_set_nsobject()`、`libvlc_media_player_set_hwnd()`
- npm 初步候選：`electron-vlc-player`
- electron-vite + VLC 配置參考：https://docs.ffffee.com/electron/electron-vlc/electron-vite-vlc-player.html

POC 採用順序：

1. 先評估 `electron-vlc-player`
   - 只接受它能在 projection window 內嵌播放，而不是開外部 VLC 視窗
   - 必須支援 macOS / Windows
   - 必須能從 main/control IPC 做 play / pause / seek / stop
2. 如果 package 不符合需求，改做最小 native bridge
   - macOS：建立受控 `NSView`，用 `libvlc_media_player_set_nsobject`
   - Windows：建立受控 child window，使用 `libvlc_media_player_set_hwnd`
   - JS 層只暴露最小 IPC，不直接碰 native handles

electron-vite / native loading 驗證點：

- dev 與 packaged 都要能載入 native addon / VLC dynamic libraries
- Windows 需要驗證 `libVLC.dll` 所在資料夾加入 `process.env.PATH`
- macOS 需要驗證 VLC framework / dylib lookup path、codesign、notarization
- 若使用多入口 renderer，必須確認不破壞現有 `/projection` route；優先沿用現有 projection window，而不是新增平行投影架構
- `.node` addon 若納入正式實作，需走 `electron-rebuild` 或 prebuild pipeline

POC 範圍：

- projection window 中嵌入 libVLC video surface 或由 LibrePresenter 管理的 native child surface
- 播放一支 MKV
- play / pause / seek
- 關閉 projection cleanup
- macOS 和 Windows 各確認一條可行路徑
- electron-vite dev / build path 都能找到 native library

不在 POC 範圍：

- 不做完整 media service refactor
- 不做 packaged binary release
- 不做字幕、音軌切換、播放清單
- 不移除 Web browser-native video path

## Track E：備選方案

### Option 1：libmpv embedded

- 播放能力強
- 但 Electron 內嵌成本高
- GPL 路線較重

除非 libVLC POC 不可行，否則不優先。

### Option 2：Chromium video + background transcode

- UI 最一致
- 但回到等待轉檔、轉檔失敗、live transcode 等複雜度

除非 embedded library 不可行，否則不回到這條。

## Track F：目前 diff 處理

在正式 commit 前，應拆分目前 diff：

- 保留 Track A changes
- 保留不綁定 engine 的 Track B changes
- revert `spawn mpv executable` 產品 runtime 變更
- README / notices 不承諾 mpv
- libVLC POC 另開乾淨實作

## 驗收順序

1. 先完成 Track A 並 commit
2. 清掉 mpv executable runtime diff
3. 再清 Track B，確保不綁定具體 engine
4. POC 通過後才替換正式 desktop video engine
