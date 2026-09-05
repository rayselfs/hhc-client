# HHC Presenter UI and Editor Follow-up Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute sequentially by default; this plan does not request parallel agents.

**Goal:** 修正 2.4.3 實機回報的共用 UI、多媒體分組、簡報操作與儲存效率問題，讓狀態可見、操作範圍一致，並保留資料安全。

**Architecture:** 沿用 HeroUI v3、既有 ContextMenu、presentation document/session/history/save coordinator、IndexedDB 與 projection session。優先修正既有元件及共用入口，不新增狀態管理框架、UI library 或第二套儲存服務。先消除重複工作，再以固定 benchmark 驗證改善；本輪不改寫文件儲存格式。

**Tech Stack:** Electron、React 19、TypeScript、HeroUI v3 / React Aria、Tailwind CSS v4、Zustand、IndexedDB、Vitest、Playwright。

**Spec:** 本文件的「已確認需求與範圍」是本次對話的自足規格。先前 `2026-09-05-presenter-native-editing-optimization.md` 僅作歷史背景；本文件不重新開啟舊計劃全部範圍，衝突處以本文件及使用者後續指示為準。

## Execution status — 2026-09-06

- [x] Task 0: latest origin/main baseline and dedicated worktree established.
- [x] Tasks 1–7: shared UI, grouped projection, editor states, deletion, end-screen exit, and image geometry implemented.
- [x] Task 8: bounded/coalesced saves, selective cover invalidation, reduced text measurement and continuous-input/IME safety implemented; 10/100-slide benchmarks completed before/after, five runs each.
- [x] Task 9: global/deck defaults and three-language labels implemented.
- [x] Task 10 local gates: 3,107 unit tests, build/typecheck, browser UI and responsive/resize smoke, Electron actual projection-window close.
- [ ] Remote CI, signed packages, Windows physical-device smoke, merge/release/installation: not part of the completed local-delivery evidence.

The detailed lists below retain the original acceptance checklist. The [implementation and verification report](../../reports/2026-09-06-presenter-ui-editor-follow-up.md) records completed local evidence, benchmark instrumentation limits and remaining platform/delivery checks. In particular, the benchmark measures DOM text-layout passes rather than React commit count; it does not claim INP or population-level p95. Source persistence remains full-document JSON.

## Global Constraints

- 使用者已授權開始實作；目前為 isolated worktree 的本機實作與驗證。PR、merge、release 與安裝新版仍是後續交付 gate。
- 實作前讀取現行 AGENTS.md、fetch 最新 origin/main，建立該任務專用 isolated worktree / branch；不能從舊 main 或分析快照直接開工。
- 保留所有既有 worktree、未追蹤計劃與報告；不修改不相關檔案，不直接 commit main。
- 同時支援 Electron 與 browser；影響投影的項目必須驗證兩種 adapter，並核對 browser CSP / DevTools。
- 保留 projection owner rule、IME composition、Undo/Redo、鎖定物件、檔案來源權限、儲存錯誤與關閉防護。
- 使用 HeroUI v3 有效的 theme tokens；不新增 primary/content 等舊版 token alias 來掩蓋局部錯誤。
- English code、identifiers、comments；使用者可見文案、tooltip、aria-label 完整提供 en / zh-TW / zh-CN。
- 若新增持久化 preference，使用 hhcPersistStorage、createPersistName、partialize 與 versioned migration；不得直接呼叫 localStorage。
- 優先沿用現有 helpers、fixtures 與 tests；純樣式修改以真實瀏覽器 computed style / UI smoke 驗證，不增加只檢查 class 字串的測試。
- PR/CI、merge、release、部署與 installed-device smoke 是不同證據。依後續授權完成相應 gate，不把本計劃視為發版授權。

## Baseline and evidence

- 分析時 primary checkout 為 `b7d7bef8`，package version 2.4.2；Mac `/Applications/HHC Presenter.app` 的 package version 為 **2.4.3**。最終原因分析改以本機 `v2.4.3` tag 與 installed app bundle 交叉核對。
- 已安裝 CSS 存在 accent 規則，但未找到 bg-primary / ring-primary；toolbar 與圖片控制點仍引用 primary。
- v2.4.3 的相關既有 Vitest：6 files / 94 tests passed。此證據不等於下面 bug 已修復，也不覆蓋實機 layout、控制點可見性與右鍵互動。
- 原因可信度：avatar、primary 樣式、刪除 event guard、結束投影、背景 default、六點文字框、分組 playlist、固定寬度及非對稱座標限制均有 source evidence。
- Dialog 跳動：空 Modal.Trigger 在 UserMenu 內形成佔位是待 DOM 座標驗證的假說；不能僅憑 source 宣稱實機原因已證實。
- 圖片已有 IMAGE_HANDLES 與 image resize branch；bg-primary 失效是可見性原因之一。執行時仍須檢查 selection、asset load、clip、scale 與 z-index，不直接重寫控制柄。

## 已確認需求與範圍

| ID  | 需求與決議                                                                            | Task |
| --- | ------------------------------------------------------------------------------------- | ---- |
| U1  | 登入者沒有 avatar 時，姓名取字與 website 一致；訪客保留人像                           | 1    |
| U2  | 開快捷鍵／關於 dialog 時，帳號位置不跳動；偏好設定也回歸驗證                          | 2    |
| U3  | FAB 顯示三組：資料夾；建立簡報＋上傳；同步                                            | 2    |
| U4  | 所有相關 Dropdown / Popover 外部右鍵能取消現有 menu                                   | 2    |
| M1  | 分組開啟時，組內排序不改日期組序，投影不跨組                                          | 3    |
| E1  | Toolbar selected / mixed / disabled 狀態可辨識                                        | 4    |
| E2  | 縮圖有常駐深淺對比邊框，selected 使用橘色外框                                         | 4    |
| E3  | 補投影片右鍵刪除及 Delete / Backspace，支援多選                                       | 5    |
| E4  | 投影結束畫面再按下一頁，關閉投影並結束 session                                        | 6    |
| E5  | **取消恢復八點文字框**；自動高度文字框維持六點                                        | 7    |
| E6  | 字型 picker、字級 input 有明確 disabled 外觀                                          | 4    |
| E7  | 縮圖間分隔線不顯示 hover；點擊後才顯示並加快閃爍                                      | 4    |
| E8  | 提高方向鍵移動步長，保留精細移動方式                                                  | 7    |
| E9  | 本輪直接優化儲存，建立固定 benchmark，不能推到使用者遇到大型檔案才處理                | 8    |
| E10 | 移除文字工具區固定 720px 留白；十個排列功能收進「排列」選單                           | 4    |
| E11 | 背景分 global initial default / deck default；Reset 回 global，Apply to All 更新 deck | 9    |
| E12 | Home outline、位置對齊計時器／聖經 settings；Undo/Redo button group                   | 4    |
| E13 | 圖片選取時可見八點縮放控制柄，與文字框共享視覺語言                                    | 7    |
| E14 | 圖片／文字框可往四個方向超出畫布；投影只顯示畫布範圍                                  | 7    |

### Avatar contract

Website 依據：`/Users/rayselfs/Projects/hhc/website/frontend-platform/packages/ui/src/controls.tsx` 的 Avatar，以及 `account-fe/src/components/AccountAvatar.tsx` / `lib/account-display.ts` 的名字來源。實作時重新核對現行版本，不能誤用旁邊另一個未被該元件使用的 accountInitials helper。

```ts
function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  )
}
```

相同名字必須產生相同結果：Alice Chen → AC、王小明 → 王、小明 王 → 小王。姓名來源維持 first_name + last_name；沒有姓名使用 email 帳號部分。優先從現有 session displayName 局部導出 avatar name，不為此擴大 auth API 或改掉其他登入 UI 的顯示名稱。avatar 圖片失敗也回到姓名 fallback。

### Background contract

| 範圍／操作             | 語意                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| Global initial default | 建立全新簡報的初始背景，現為白色；不是本輪新增的可設定全域偏好            |
| Deck default           | 本份簡報新增投影片時使用的背景，沿用 document.defaultSlideBackground      |
| Apply to All           | 更新本簡報所有既有投影片背景，並更新 deck default；不修改 global default  |
| Reset                  | 僅將目前投影片還原為 global initial default；不修改 deck default 或其他張 |

例：全部套用藍底 → Reset 目前張為白底 → 新增張仍為藍底。Reset 後再 Apply to All → 全部與之後新增張都是白底。複製投影片保留來源背景，不視為一般新增。

| Key                                   | en           | zh-TW      | zh-CN      |
| ------------------------------------- | ------------ | ---------- | ---------- |
| presentationWorkspace.applyToAll      | Apply to All | 套用至全部 | 应用到全部 |
| presentationWorkspace.resetBackground | Reset        | 重設       | 重置       |

## File map

下列路徑以 repository root 為基準；renderer prefix 為 `src/renderer/src/`。先讀現行檔案再編輯，行號可能隨 origin/main 改變。

| Task | Files and responsibility                                                                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | components/Control/UserMenu/UserMenu.tsx；其 \_\_tests\_\_/UserMenu.test.tsx；必要時 lib/avatar-initials.ts 與單一對應測試（只有確有多個 caller 才抽 helper）                                                                                                                                                        |
| 2    | UserMenu.tsx、AboutDialog.tsx、KeyboardShortcutsDialog.tsx、PreferencesDialog.tsx；components/Control/Sidebar.tsx；components/Control/FileExplorer/FileExplorerFAB.tsx；contexts/ContextMenuContext.tsx；lib/use-menu-dismiss.ts（僅共用右鍵 dismiss 必要時新增）                                                    |
| 3    | components/Control/FileExplorer/FileBrowser.tsx、useFileContextMenu.ts、SortDropdown.tsx；pages/FilesPage.tsx；lib/file-explorer-grouping.ts、presentability.ts；stores/file-explorer.ts                                                                                                                             |
| 4    | components/Control/Presentation/PresentationHomeRibbon.tsx；pages/PresentationWorkspacePage.tsx；components/Control/Header/PresentationWorkspaceHeader.tsx；assets/main.css                                                                                                                                          |
| 5    | PresentationWorkspacePage.tsx；lib/presentation-editor-commands.ts、presentation-slide-clipboard.ts；pages/\_\_tests\_\_/PresentationWorkspacePage.session.test.tsx                                                                                                                                                  |
| 6    | components/Control/FileExplorer/Presenter/MediaPresenter.tsx、PresenterNavigation.tsx；pages/MediaWorkspacePage.tsx；stores/media-projection.ts；lib/projection-actions.ts；相關 tests                                                                                                                               |
| 7    | components/Common/EditableSlideSurface.tsx 與 \_\_tests\_\_/EditableSlideSurface.test.tsx；PresentationWorkspacePage.tsx；lib/presentation-editor-commands.ts；geometry / normalization callers 實際追查後僅修改必要位置                                                                                             |
| 8    | lib/presentation-editor-session.ts、presentation-save-coordinator.ts、editable-presentation-persistence.ts、presentation-history.ts；EditableSlideSurface.tsx；PresentationWorkspacePage.tsx；contexts/PresentationSessionRegistryContext.tsx；既有相關 lib tests；e2e/presentation-save-performance.spec.ts（新增） |
| 9    | lib/editable-presentation.ts；PresentationWorkspacePage.tsx；locales/en.json、zh-TW.json、zh-CN.json；既有 editable-presentation tests                                                                                                                                                                               |
| 10   | 各 affected tests；e2e/presenter-ui-follow-up.spec.ts（新增真實 UI 回歸）；本文件驗收記錄                                                                                                                                                                                                                            |

## Task 0 — Establish the execution baseline

- [ ] 讀 AGENTS.md、最新 code 與本規格；記錄 origin/main SHA、installed app version、目前 projection/window 狀態。
- [ ] fetch 後建立新的 isolated worktree / task branch。若既有 main 不乾淨，不更新它；只有乾淨時可用 git pull --ff-only。
- [ ] 將本計劃帶入新 worktree，不能遺失此 checkout 尚未追蹤的規格，也不能移動原檔。
- [ ] 逐項重現：light/dark、滑鼠／鍵盤、editor／projection，錄下 baseline screenshot 與相關座標；登入 smoke 使用既有授權 session。
- [ ] 列出所有 Dropdown / Popover、getProjectionPlaylist、next、nudgeElements、resize 與 persistence callers。源碼已修復的項目改做回歸，不重複實作。
- [ ] 在任何效能修改前先跑 Task 8 的相同 fixture / workload，保存 baseline；不以舊 run 的效能數字作比較。

## Task 1 — Website-consistent avatar fallback

**Consumes:** current HhcSession displayName/avatarUrl。**Produces:** UserMenu 姓名 fallback，不改 auth contract。

- [ ] 在既有 UserMenu test 補 authenticated without image、image failure、guest、英文／中文／空白名字案例；先確認現行 CircleUser 行為使預期失敗。
- [ ] 將上方 initials contract 接到 Avatar.Fallback；沒有姓名的 email fallback 使用 @ 前段。不得將訪客文案當作登入者姓名生成字母。
- [ ] 以網站相同輸入對照結果；維持 avatar 尺寸、姓名與 aria-label，不更改登入或登出流程。
- [ ] Run `npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx`；預期新舊案例全部通過。
- [ ] Commit `fix: align account avatar fallback with website`。

## Task 2 — Stable dialogs and consistent menu dismissal

**Consumes:** HeroUI overlay state、既有 ContextMenu dismissal。**Produces:** 無 layout jump；menu 外部右鍵先關閉目前 menu。

- [ ] 新增 UI 回歸：量測 avatar trigger 開關 About / Shortcuts / Preferences 前後 bounding box；預期 x/y/width/height 不變（允許 1 CSS px rounding）。
- [ ] 檢查空 Modal.Trigger 是否產生正常 document flow；確認後移除無需互動的 trigger 或使用既有 controlled overlay 組合，保留 focus return，不用 margin 補償。
- [ ] FAB 沿用三個既有 Section，加入現有可見 Separator / GlassDivider pattern；只讀資料夾与來源 action 缺省時不得留下空分隔線。
- [ ] 列出所有 app menu 使用點；共用右鍵 dismiss 綁到各 menu 的 controlled open state。僅在 menu open 時啟用 capture listener，檢查外部事件，不攔截 menu 內部正常操作。
- [ ] 第一個外部右鍵關閉既有 menu，消耗該次 contextmenu，避免下層立即重開另一個 menu；下一個右鍵才按下層正常規則開啟。nested popover 避免同次事件誤關整串；Escape / 左鍵 / focus return 保留。
- [ ] 不改 node_modules，不全域禁止右鍵，不攔截文字編輯器原生文字選單。若新增 use-menu-dismiss，hook 清理 pointer/contextmenu listener，StrictMode mount/unmount 不殘留。
- [ ] 在 e2e/presenter-ui-follow-up.spec.ts 驗證 UserMenu、FAB、排序、字型／排列選單及自製右鍵選單；同時回歸各既有 UserMenu / FAB / ContextMenu tests。
- [ ] Commit `fix: stabilize dialogs and dismiss menus on outside right click`。

## Task 3 — Group-local sorting and projection

**Consumes:** existing dateGroup / timezone / folder display preferences。**Produces:** 組序與組內排序分離；所有投影入口使用同組候選資料。

- [ ] 在 lib/\_\_tests\_\_/file-explorer-grouping.test.ts 加兩日期組、每組反向名稱順序、Unknown date 案例；切 name asc/desc 只改變組內次序，日期組序固定。
- [ ] 維持「同一個排序設定分別套用每組」，不新增每組 toolbar。日期組序與 item sortDir 分開；若現行 store 尚無獨立日期組序，使用 folder display 的 groupSortDir: 'asc' | 'desc' 並補 migration，既有 grouped preference 取舊 sortDir 的日期方向，none 預設 desc。未分組行為不變。
- [ ] 投影前以目標 item 的 dateGroup 篩候選，再交給既有 getProjectionPlaylist / readiness pipeline；不要複製 projection preflight。groupMode=none 時保留原清單。
- [ ] 檢查 double click、item context menu、keyboard present、page actions；無明確目標時沿用既有第一個可投影項目的選取規則，以該項目所在組為範圍。不能無目標就播放所有組。
- [ ] 多選跨組時，投影仍以實際啟動目標所在組為界；選取、複製與移動不額外被此規則限制。拖曳保持不能跨日期組重新排序，移入資料夾仍是獨立動作。
- [ ] 測試資料：[A1,A2] 屬 date A、[B1,B2] 屬 date B；從 A2 啟動的 playlist 只能包含 A 組可投影項目。驗證 Unknown date、時區跨日、唯讀同步資料夾與無可投影項目。
- [ ] Run grouping、FileBrowser、useFileContextMenu、FilesPage presentation-actions 相關 tests，及 grouped list/grid UI smoke。
- [ ] Commit `fix: scope grouped media sorting and projection`。

## Task 4 — Visible editor state and compact controls

**Consumes:** existing selected/mixed/disabled model state。**Produces:** 不變更格式語意的狀態視覺與排列選單。

- [ ] UI regression 以 computed background/border/opacity 驗證 bold、italic、underline、對齊及 mixed；不能只測 aria-pressed=true 或 class 含 primary。
- [ ] 將本輪受影響的舊 color classes 改用有效 v3 tokens。selected 用 accent / accent-foreground；mixed 使用可辨識的中間樣式並保留 aria-pressed='mixed'；disabled 與 selected 不混淆。
- [ ] FontFamilyPicker / FontSizeInput 補 disabled opacity、foreground、cursor 及 hover 規則；保留現行輸入功能禁用條件，選取文字框但未打字時是否可格式化依既有 scope contract。
- [ ] 縮圖常駐 1px 對比框，外側 selected 2px 橘色（預設 #f59e0b）；選取框不得改縮圖尺寸。純色使用 resolved background luminance；透明背景先合成 global background，漸層使用邊緣代表色。混合色／圖片邊緣無單一可靠判斷時用細雙色框，不在每次 render 讀 canvas pixels。
- [ ] 建立 light/dark × white/black/gradient/imported background smoke；非 selected 也要有常駐框，active slide / multi-selected / projected marker 各自可辨識。
- [ ] 移除 divider group-hover。點擊後使用 600ms step blink，失去插入位置時消失；drag insertion 保持明確提示，prefers-reduced-motion 顯示靜態線，鍵盤 focus indicator 保留。
- [ ] 移除 w-[720px]，改以內容自然寬度排列；狹窄視窗沿用既有 horizontal overflow，不新增 responsive framework。
- [ ] 將十個物件排列 action 移入一個「排列」menu：前後一層 2 個、對齊 6 個、等距 2 個，三組分隔；無選取／少於 2／少於 3 的 disabled 條件保留。提供三語標籤及 tooltip。
- [ ] Home 使用 outline，跟現有 Timer/Bible settings 比對實際尺寸與左側定位；Undo/Redo 使用現有 ButtonGroup，仍分別依歷史狀態 enable。
- [ ] Run PresentationHomeRibbon / PresentationWorkspaceHeader tests，加執行 e2e/presenter-ui-follow-up.spec.ts；確認沒有水平多餘留白及操作失焦。
- [ ] Commit `fix: clarify presentation editor states and controls`。

## Task 5 — Slide deletion from menu and keyboard

**Consumes:** existing slide selection/delete/history。**Produces:** 單一路徑的單選／多選刪除。

- [ ] 在既有 session tests 讓焦點落在 data-slide-option button，按 Delete / Backspace，確認目前 action-control guard 阻擋的失敗案例。
- [ ] 為 slide sidebar 的 delete 明確放行，不能放寬所有 button 的 global key handling；typing、IME、input、menu、dialog 與非 slide UI 不刪除投影片。
- [ ] 右鍵選單加入 translated Delete 與既有 danger 樣式，呼叫相同 deleteSlide/selection command；右鍵未選取 slide 先按既有 selection 規則定義刪除目標。
- [ ] 保持至少一張投影片的既有 invariant；all-selected 時 action 應呈現一致的禁止狀態，不能 menu 可按但鍵盤無反應。刪除後選取鄰近有效 slide；Undo 一次恢復同批刪除。
- [ ] Run `npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx src/renderer/src/lib/__tests__/presentation-editor-commands.test.ts`，再驗證 native macOS keyboard 與 Windows Delete/Backspace。
- [ ] Commit `fix: enable slide deletion in sidebar interactions`。

## Task 6 — Exit projection after the end screen

**Consumes:** media isEnded、MediaPresenter onExit、existing closeProjectionAndMediaSession / stopProjectionSession。**Produces:** 所有下一頁入口在 end screen 結束實際 session。

- [ ] 在 MediaPresenterKeyboard / MediaWorkspacePage tests 建立 end screen，按 next；預期呼叫既有 exit path，而非只得到 false。
- [ ] 統一 next button、keyboard 與其他現有 next caller 的 end-screen 處理；不要在 Zustand store 直接呼叫 window.close，也不要引入 blank projection mode。
- [ ] normal slide next 與最後一張→end screen 維持原行為；end screen→next 才退出。重複按鍵不能產生多次互相競爭的 close；關閉失敗沿用錯誤與狀態保留邏輯。
- [ ] Run media-projection store、MediaPresenterKeyboard、MediaWorkspacePage、projection-actions 相關 tests。
- [ ] Electron 實際 projection window 關閉；browser 驗證既有關閉／blocked close fallback，不能以 renderer 顯示消失當成視窗關閉證據。
- [ ] Commit `fix: close projection when advancing past end screen`。

## Task 7 — Image handles and symmetric object movement

**Consumes:** SelectionChrome、IMAGE_HANDLES、CONTENT_TEXT_HANDLES、resize/nudge helpers。**Produces:** 圖片八點、content text 六點、四向自由移動。

- [ ] 先選取真實插入圖片，檢查八個 DOM control points、computed fill/border、asset readiness、clip 和 z-index；截圖 white/black slide 對照文字框。
- [ ] 沿用 IMAGE_HANDLES 八個點，修復 bg-primary 與對比、邊框、hit targets。一般 resize 與 crop mode 視覺和 semantics 分開；不得為修外觀新增第二套 geometry。
- [ ] content-height text 固定維持 ['nw','w','sw','ne','e','se'] 六點，不補 n/s。既有 imported fixed-height text 不強制轉 content 或改變高度模型。
- [ ] 移除物件 move 的單向 clamp，沿共用 callers 追到 command、normalization、save/load、projection；不要移除新增文字框起始位置或 image width/height 的合法範圍驗證。

```ts
// Object movement allows negative slide coordinates.
const updates = {
  x: drag.original.x + dx,
  y: drag.original.y + dy
}
```

- [ ] 方向鍵預設步長設 5 canvas units，Shift=10、Alt=1 fine movement；文字 caret 不攔截，slide sidebar Alt reorder 不受影響。這是可在本次 smoke 微調的操作預設，不新增設定面板。
- [ ] 以同一共用 nudge command 處理選取物件；檢查方向鍵負座標、拖曳負座標、Undo/Redo、儲存重開均一致。
- [ ] Verify image handles n/ne/e/se/s/sw/w/nw 都能操作，四角與邊中點遵守原先比例／修飾鍵規則；旋轉、裁切、鎖定、縮放時的可點範圍不回歸。
- [ ] 測試物件 x=-20/y=-20、右下部分出界，儲存與重開不截斷座標；投影／縮圖只顯示 slide bounds 內內容。編輯時物件部分出界仍可重新選取，不新增無限畫布功能。
- [ ] Run EditableSlideSurface、presentation-editor-commands、editable-presentation persistence tests，加 Electron/browser UI smoke。
- [ ] Commit `fix: restore image handles and symmetric object movement`。

## Task 8 — Reduce autosave work now

**Consumes:** session history/draft、coordinator revision、persistEditablePresentationRevision、thumbnail generator。**Produces:** bounded/coalesced writes、精準縮圖失效與固定 benchmark 證據；保存同一 source blob contract。

### Decisions

- 不以「等大型簡報」作為停止條件。本輪必須有固定 small/large fixtures 與修改前後量測。
- Undo history 與 durable save cadence 分離；不藉減少 Undo 能力來降低寫入。
- 目前整份 JSON 含 image dataUrl 的 O(document size) 成本仍存在。資產外置／per-slide canonical persistence 屬格式、遷移、export、projection reader 共同改造，**不是本輪默默附加的實作範圍**。
- 不只增加 debounce，也不僅將重複 stringify 移入 worker；先消除不必要 revision/thumbnail/layout work。

### Steps

- [ ] Benchmark fixtures：10 / 100 slides，各含 3 個文字框；各引用同一組固定 5 張總計約 5 MiB 的本機圖片（同一來源資產不能每張重複建立副本）。固定 seed、viewport、zoom、device、production build 與 foreground app。不能依測試環境網路取得圖片。
- [ ] 工作序列：持續打字 10 秒、方向鍵長按 3 秒、改非第一張備註 20 次、改第一張文字、移動物件、縮放、Undo/Redo、關閉重開；每組至少 5 次，報 median / p95。記錄 stringify time、serialized bytes、source writes、thumbnail writes、layout commits、long tasks、最後修改至 durable revision 延遲。
- [ ] 實作前保存 baseline，之後使用完全相同 workload。e2e/presentation-save-performance.spec.ts 採既有 fixture helpers，計時 instrumentation 僅測試使用，不新增 production analytics。
- [ ] coordinator 尾端 debounce 從 250ms 調整至 1000ms；新增 5000ms max-wait（從第一次尚未持久化修改開始，不因後續 edit 重置）。保留一筆 in-flight，pending 只保留最新 revision。

```ts
const SAVE_DEBOUNCE_MS = 1000
const SAVE_MAX_WAIT_MS = 5000
// The deadline remains anchored to the first pending change.
const nextDelay = Math.min(SAVE_DEBOUNCE_MS, Math.max(0, deadline - now))
```

- [ ] 同時調整 text draft：保留停止輸入 750ms commit，另在連續輸入滿 4 秒時，於非 composing 的安全更新點 commit 目前 draft，再讓後續輸入開始下一段。沿用現有 Undo grouping，不另建未提交草稿的持久化通道；加上 1 秒儲存 debounce，使一般持續輸入約 5 秒內排程 durable write。IME composing 時延至 compositionend，不強行讀取或 flush DOM；5 秒是排程目標，不是 I/O 或長時間 IME 的硬完成保證。
- [ ] save in-flight 期間的新修改合併，完成後依 deadline 排程，避免不經節流連續重寫；flush 立即排空最新 revision，保留 error/retry/discard/generation fences。
- [ ] 穩定 onTextLayoutChange callback，縮小 measure effect 依賴到影響布局的文字/字型/寬度；字型 load / IME 結束仍重測。尺寸採一致精度比較，忽略 subpixel noise，真實尺寸變更合入同次 revision；不讓 zoom、選取、menu、theme toggle 造成內容 dirty。
- [ ] thumbnail invalidation 只依賴：第一個 slide id、其 visible elements/order/background、引用 assets、document dimensions。非第一張修改、備註、名稱等不重算；不能用每次完整 JSON hash 來做判斷。
- [ ] 源檔 durable write 完成後才產生新縮圖；縮圖使用最新已保存資料且合併任務，過期任務不能覆蓋新縮圖。來源未變則不更新縮圖；縮圖錯誤不得偽裝為源文件儲存失敗。
- [ ] fake timers 測試 burst 合併、continuous-edit max-wait、in-flight coalescing、flush、retry、dispose/discard；session 測試 IME、draft cancel、Undo/Redo、連續輸入後重開。

```ts
// Acceptance examples, implemented with existing coordinator/session fixtures:
// 20 edits inside one idle window -> one write containing the newest document.
// Editing slide 2 or notes -> zero cover thumbnail writes.
// Changing slide 1 background -> one coalesced cover thumbnail write.
// A no-op layout pass -> no new scheduled revision.
// flush -> persistedRevision equals scheduledRevision, or an explicit error.
```

- [ ] Run presentation-save-coordinator、presentation-editor-session、editable-presentation-persistence、presentation-history tests 及新 benchmark。
- [ ] 驗收：上述 deterministic write-count 條件通過；同 workload serialized bytes / thumbnail writes 減少；input latency/long tasks 不惡化；關閉後重開內容完全一致。若 performance 結果反而惡化，該 Task 未完成，分析本次改動而非以測試通過結案。
- [ ] 報告剩餘整份序列化的成本及實測值，不宣稱達到未證實的全域最佳效能；本輪不自動升級成 storage-format migration。
- [ ] Commit `perf: coalesce presentation saves and thumbnail updates`。

## Task 9 — Separate background defaults and complete translations

**Consumes:** document.defaultSlideBackground、createDefaultSlideBackground、existing background commands。**Produces:** 明確兩種 scope，不新增 schema。

- [ ] 在 editable-presentation tests 建立三張簡報：套用藍色到全部、Reset 第二張、新增第四張；預期第二張白色，其餘與第四張藍色，deck default 仍藍色。
- [ ] resetSlideBackground 改用 createDefaultSlideBackground()，不讀 deck default；applySlideBackgroundToAllSlides 保持更新所有 slides 與 deck default。

```ts
return updateSlideBackground(document, slideId, createDefaultSlideBackground())
```

- [ ] 測試 Reset 後 Apply to All、全新簡報、複製張、solid/gradient/transparency、Undo/Redo、儲存重開；初始值使用現有 factory，不另外散落 '#ffffff'。
- [ ] 補上 Background contract 表中的 en/zh-TW/zh-CN；確認 UI 顯示 Reset/重設/重置，不再出現中文語系英文 fallback。
- [ ] Run editable-presentation 與 locale 相關 tests，加三語 sidebar UI smoke。
- [ ] Commit `fix: reset slide backgrounds to global defaults`。

## Task 10 — Integrated verification and delivery

- [ ] 自我檢查上方 U1–U4 / M1 / E1–E14 每個 ID 有實作與驗收證據，不能遺漏後加的圖片八點、四向出界、三語按鈕。
- [ ] Run `npm run lint`、`npm run typecheck`、`npx vitest run`、`npm run build`；確保 bundle checks 通過。
- [ ] Run `npx playwright test --project=chromium e2e/presenter-ui-follow-up.spec.ts e2e/presentation-save-performance.spec.ts`，再跑受影響的既有 presentation/projection suites。新測試使用 repository 現有 dev server / build 配置，不另起第二套 app。
- [ ] Electron/browser：light/dark、正常與窄視窗、grouped/ungrouped、英文/繁中/簡中、字型載入、IME、投影結束、負座標、儲存重開。
- [ ] macOS/Windows：Ctrl/Cmd clipboard、Delete/Backspace、Arrow/Shift/Alt、原生 menu 焦點、實際 projection window。未能在某平台執行時清楚列為未完成證據，不能用另一平台結果替代。
- [ ] 依授權建立 PR，required CI 成功後才 merge；release/部署/安裝 smoke 各自記錄真實結果，不能只以 tag 或 package build 宣稱 installed acceptance。
- [ ] 完成 merge、成功 release 及 smoke 後，才移除本任務 clean temporary worktree；branch commits 已包含 origin/main 才刪 local branch。授權只到較早階段或仍有未驗證工作時保留 worktree。

## Recommended order and completion record

Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10。Task 8 baseline 在 Task 0 就開始；若先前 task 會影響 benchmark，記錄中間版本，不混淆效能改動與 UI 改動的貢獻。

- [x] 對話需求整理成新計劃，保留文字框六點與後續修訂。
- [ ] 實作與 focused tests。
- [ ] 整合 checks / benchmark / browser UI。
- [ ] macOS 與 Windows installed-device acceptance（依授權發版及安裝）。
- [ ] PR/CI、merge、release 與 cleanup 記錄。

目前沒有 code change 或修復完成宣告。此文件規劃下一次實作所需範圍及驗收，不覆寫既有計劃與報告。
