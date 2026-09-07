# Personal Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not delegate unless separately authorized.

**Goal:** 在多媒體提供同帳號跨電腦的雲端資料夾，支援子資料夾、一般檔案與 Presenter `.lpdeck` 的離線增刪改及雙向同步。

**Architecture:** asset-api 擁有個人 collection、檔案樹及同步 revision，復用既有 private Blob、上傳、掃描與清理機制。Presenter 將本機修改與 outbox 原子寫入同一個 IndexedDB，再以有版本條件、可冪等重試的操作提交雲端；Blob 先備妥，DB 最後切換指向。

**Tech Stack:** TypeScript、React 19、Zustand、idb、Electron、Go、PostgreSQL、Azure Blob Storage；不新增服務或依賴。

**Spec:** 本文件「Confirmed scope and design」承載本次對話已確認需求；2026-09-05 使用者確認個人同步、允許離線修改，並要求分別整理實作計劃。以下工程預設是計劃決策，不是已實作能力。

## Global Constraints

- 同帳號跨電腦；不做分享、同工 ACL UI、即時共同編輯或內容自動合併。
- 一般檔案與 `.lpdeck`；沿用現有可接受媒體類型並在 personal namespace 明確列出，不代表任意副檔名皆可上傳。
- 離線允許增刪改；只有已有本機內容的檔案可離線編輯／投影，未下載檔案需明確提示。
- 一次本機修改必須連同待送操作落盤；不得先更新檔案後跨 DB 寫 outbox。
- Electron、browser 都支援。既有 LINE、OneDrive、local sync 保留原本唯讀語意。
- 服務端以受信任登入身分決定 owner；不接受 client 指定 owner、namespace、grant 或 Blob key。
- 雲端有效資料不自動到期；軟刪除、解除同步、清除本機快取是不同操作。
- 不改 Bible 刪除流程；不讓 File Explorer 呼叫 `cleanupExpired()`。
- 正式實作時每個 repo 自最新 `origin/main` 建立隔離 worktree；各自 PR、CI、release、smoke。2026-09-07 使用者已授權開始實作；2026-09-07 使用者另已授權依序發 PR、等待 CI、merge、release，持續到整份計劃完成。

## Confirmed scope and design

### UX and ownership

- 每個 account user ID 一個 personal collection，多媒體出現「雲端資料夾」根節點；允許任意合法子資料夾。
- 這是 Presenter 內的資料夾，不是 Finder／檔案總管實體目錄的雙向監控。
- 第一次啟用需登入並在線建立／取得 collection；已啟用後可離線操作。帳號切換或登出停止原帳號同步，隱藏其雲端入口，保留未送出的修改；另一帳號不得讀取或送出這些操作。
- 以 account ID 綁定 connection、outbox、cursor、local mapping；晚到的非當前 auth generation 回應不得提交。
- 介面區分「已儲存本機」、「待同步」、「同步中」、「已同步」、「衝突」、「需要登入」、「空間不足／失敗」。只在 durable local commit 後顯示本機已儲存。
- 刪除先同步 tombstone，垃圾桶保留 30 天（工程預設）；沒有復原 UI 之前不能宣稱完成可復原刪除。
- 跨本機／雲端根目錄的拖放先採複製；不做跨儲存域原子 move。來源只由使用者另外刪除。雲端內 move 為單一 DB mutation。

### Server data and transaction contract

復用 `asset_collections`、`asset_collection_items`。新增欄位採 additive migration，不修改已套用 migration；執行時依最新 migration 序號建立 `*_personal_cloud_sync.sql`。

| Entity | 新增／延伸內容 | Invariant |
| --- | --- | --- |
| collection | `owner_user_id`、personal namespace、permanent retention mode | personal owner unique；舊 LINE rows 與 ACL 不改 |
| item | `kind`、`parent_item_id`、現有 asset/revision/deleted 欄位 | 同 collection 的 parent FK；folder 無 asset；file 必須指向合法 asset |
| mutation receipt | owner + operation ID、request hash、result | 同 ID 同 body 回傳原結果；不同 body 拒絕 |
| change log | collection revision + node snapshots/tombstones | 與 item mutation 同 transaction；可分頁重放 |

- personal namespace 使用 `presenter.personal`，建立政策由 asset-api 持有。既有 policy 中 `.lpdeck` 只出現在 LINE namespace，不能借用 LINE caller 身分上傳。
- opaque item ID 穩定，`remote_item_id` 可採同一 ID；名稱／parent 不是 Blob key。改名／移動不複製 Blob。
- 第一版不做內容去重，每個 file revision 對應獨立 asset，避免碰到既有 active asset unique index 的共享引用問題。
- 同一 collection mutation 先鎖 collection row，再檢查 node expected revision；短 transaction 串行化目錄操作及 revision 分配。不得在 transaction 內上傳或掃描。實作註解標示 `ponytail: per-collection lock; revisit only if personal sync contention is measured`。
- 驗證名稱非空、無斜線／NUL、長度限制 255 字元；同 parent 下 NFC 正規化後的相同名稱拒絕。根目錄禁止 move/delete；parent 必須存活且為 folder；遞迴檢查不得移入自身或後代。
- folder delete/restore 帶 `expectedCollectionRevision`，若子樹在讀取後被其他裝置修改則 409；避免刪掉未看過的新內容。完整子樹在同 transaction 產生 tombstones／restore changes。parent 已刪時 restore 至 personal root，名稱碰撞回 409。
- uploads 僅 staging；掃描與型別驗證完成後才允許 replace/create 指向 asset。DB 同 transaction 更新 node、revision、change log、冪等 receipt。
- Blob 與 DB 不做分散式 transaction。中途失敗保留舊 head；未引用 staging asset 由既有 retention worker 延遲清理。有效 head、垃圾桶保留內容與使用中的 download 必須受到引用／租期保護；禁止只依 upload age 清除。
- change cursor 綁定 collection，帶固定讀取上限 revision 與頁內位置；完成一輪才前進 cursor。過期 cursor 回 reset，重新 snapshot 也必須保留本機 dirty nodes。

### Proposed HTTP contract

以下為本計劃新增 contract，並非目前已存在路由。路由都經 gateway 受保護的 exact method/path policy；不公開 `/priv/*`。

| Method and path | Request / response |
| --- | --- |
| `POST /api/assets/personal-space` | 依受信任 user ID 冪等取得／建立 collection，回 collection ID/revision |
| `GET /api/assets/personal-space/changes` | cursor/limit，回 snapshots、tombstones、nextCursor、hasMore、reset |
| `POST /api/assets/personal-space/uploads` | fileName/mimeType/sizeBytes，回 upload ID 與同源 content path |
| `PUT /api/assets/personal-space/uploads/{uploadID}/content` | 串流 request body 到既有 storage；限制長度、timeout、owner，不把大檔讀進 RAM |
| `POST /api/assets/personal-space/uploads/{uploadID}/complete` | 封存 upload，進入既有驗證／掃描；回 processing state |
| `GET /api/assets/personal-space/uploads/{uploadID}` | 查詢 processing state；過期後以新 upload ID 重送原本固定 revision bytes |
| `POST /api/assets/personal-space/mutations` | 下方 discriminated operation；回 nodeRevision/collectionRevision |
| `GET /api/assets/personal-space/items/{itemID}/content` | owner 驗證、指定 revision、支援 Range；未指定 revision 讀目前 head |

```ts
type PersonalNodeKind = 'folder' | 'file'
type PersonalMutation =
  | { operationId: string; type: 'create-folder'; itemId: string; parentId: string | null; name: string }
  | { operationId: string; type: 'create-file'; itemId: string; parentId: string | null; name: string; uploadId: string }
  | { operationId: string; type: 'replace-content'; itemId: string; expectedRevision: number; uploadId: string }
  | { operationId: string; type: 'rename'; itemId: string; expectedRevision: number; name: string }
  | { operationId: string; type: 'move'; itemId: string; expectedRevision: number; parentId: string | null }
  | { operationId: string; type: 'delete' | 'restore'; itemId: string; expectedRevision: number; expectedCollectionRevision?: number }

type PersonalMutationResult = {
  itemId: string
  nodeRevision: number
  collectionRevision: number
}
```

folder delete/restore 強制要求 collection revision；file 操作使用 node revision。API 回 401 表示需登入、404 隱藏非 owner 資源、409 表示版本／名稱衝突或 operation body 不一致、413 表示超限、422 表示內容無效；未完成掃描的 mutation 回 409 並使用獨立 `asset-not-ready` code，不生成衝突副本。429/5xx 依 Retry-After／退避重試。

### Local atomicity and conflict rules

- `hhc-file-explorer` 新增 `personal-sync-outbox`、`personal-sync-nodes` 與 `personal-sync-state` stores。既有 `hhc-sync` 是另一個 DB，不能當作 local edit transaction 的 authoritative outbox；只復用其下載服務或可重建顯示資料。
- file/folder metadata、不可變 upload snapshot 參照、outbox 在同一 transaction 提交。native-fs 先完成新 opaque blob ID 的檔案寫入，再提交 DB；失敗留下的未引用檔案進既有 cleanup journal。
- 每個 operation 固定 bytes/metadata；開始上傳後不能以新內容覆用同一 ID。後續編輯建立新 operation，前一個 ACK 不得將後一個 dirty revision 標成已同步。
- 每個 account 依序 drain outbox；使用跨 tab 的 IDB lease/expiry 防止重複 worker，服務端冪等仍是最終保護。不建立通用 queue framework。
- 建立 parent 在子檔案之前送出。依賴 mutation 成功後才以其 ACK revision 填下一筆 expectedRevision；不得用新拉到的任意 revision 默默重設舊操作的 base。
- pull 遇到 clean node 可更新；dirty node 不覆蓋。remote delete 遇到 local edit 保留本機副本，再套用 tombstone。
- 409 content conflict 建立一個穩定 ID 的 sibling conflict copy，保留完整本機內容；通知使用者。rename/move/delete conflict 保留待處理操作並讓使用者選「保留雲端」或「另存本機副本」，不自動重試 destructive command。不能僅保留錯誤訊息而丟掉 bytes。
- 僅在整頁資料與 cursor 同一 local transaction 落盤後 ACK cursor；download bytes 另行完成，標成 available-offline 前驗證 revision/size。斷網、本機容量不足、HTTP 不確定成功都不得清掉 outbox。

### Portable `.lpdeck`

- 沿用 `application/vnd.hhc.presenter+json` 及完整 JSON + 內嵌 images，不做 ZIP 或分拆 asset manifest。
- 增加 `schemaVersion: 1`；現有缺 version 的合法文件透過明確 legacy migration 讀入；未知新版拒絕編輯但保留原 bytes。
- 本機 `sourceItemId`／`sourceBlobId` 不作跨機依赖；下載建立本機 catalog mapping，渲染只依文件內 ID/reference。原始 PPTX 不是編輯後 deck 的必需相依檔案。
- 驗證 slideOrder、elementOrder、asset reference、有限正數尺寸與元素數量上限；禁止 blob/file URL、外部 URL 與可執行 SVG。允許的內嵌圖片 MIME 和限制同時由 server validator 與 client parser enforce，不只檢查 JSON object。
- 字型不隨 deck 分發；缺字型提示並使用既有 fallback，不宣稱跨機排版逐像素相同。

## Repository and file map

路徑以各 repo 根目錄為基準。Presenter 為本 repo；asset-api 為 `/Users/rayselfs/Projects/hhc/website/asset-api`；gateway 為 `/Users/rayselfs/Projects/hhc/website/api-gateway`。

| Repository | Modify existing | Create |
| --- | --- | --- |
| asset-api | `internal/assets/types.go`, `policy.go`, `media_validation.go`, `internal/httpapi/handler.go`, `internal/postgres/store.go`, `internal/retention/worker.go`, `docs/openapi.yaml` | `internal/assets/personal_sync.go`, `internal/postgres/personal_sync.go`, `internal/httpapi/personal_sync.go`, corresponding `_test.go`, additive SQL migration |
| gateway | `docs/openapi.yaml`, exact route sources under `conf.d/`, `internal/verifier/` policy if required | `scripts/test-personal-cloud-routes.sh` |
| Presenter persistence | `src/renderer/src/lib/file-explorer-db.ts`, `folder-db.ts`, `editable-presentation-persistence.ts`, `stores/folder.ts`, `stores/file-explorer.ts` | `lib/personal-sync-db.ts`, `lib/personal-sync-runtime.ts`, corresponding `lib/__tests__/*.test.ts` |
| Presenter integration | `src/shared/types/folder.ts`, `src/shared/hhc-assets.ts`, `lib/hhc-asset-api*.ts`, `lib/cloud-provider.ts`, `lib/sync-readonly.ts`, `lib/app-init.ts`, `lib/sync-unlink.ts`, `src/main/ipc/hhc-assets.ts`, `src/preload/index.ts`, `src/preload/index.d.ts` | `lib/personal-cloud-provider.ts`, `lib/__tests__/personal-cloud-provider.test.ts` |
| Presenter UI/deck | `pages/FilesPage.tsx`, `pages/TrashPage.tsx`, `components/Control/FileExplorer/FileUpload.tsx`, `useFileContextMenu.ts`, `FileItemStatus.tsx`, `lib/editable-presentation.ts`, `lib/presentation-save-coordinator.ts`, `locales/{en,zh-TW,zh-CN}.json` | `e2e/personal-cloud-sync.spec.ts` |

## Task 1: Server atomic personal namespace and directory operations

**Files:** asset-api migration, personal_sync files, types/policy and `_test.go` from map.
**Interfaces:** Consumes existing asset storage/scanning and collection IDs; produces `PersonalMutation` / `PersonalMutationResult` contract above, matching Go structs and transactional store methods.

- [x] Add DB integration cases: two creates yield one personal root; same expected revision concurrent writes yield one success and one conflict; transaction failure yields no head/change/receipt; cross-owner parent/asset access rejected; cycle rejected; folder deletion with changed collection revision rejected.
- [x] Run `go test ./internal/postgres ./internal/assets -run Personal -count=1` against a disposable PostgreSQL test DB configured as in `.github/workflows/ci.yml`; require actual executed DB tests, not skipped cases.
- [x] Implement additive columns/constraints, short collection lock, revision allocation, immutable change records and owner-scoped mutation receipts. Test retry after response loss with identical body returns exact result; changed body is rejected.
- [x] Example DB assertion to implement in existing store test style:

```go
if successCount != 1 || conflictCount != 1 {
    t.Fatalf("expected one commit and one conflict, got %d/%d", successCount, conflictCount)
}
```

- [x] Run targeted tests again and commit `feat: add atomic personal cloud collections` only with passing migration and concurrency checks.

## Task 2: Authenticated upload, content and gateway contract

**Files:** asset-api HTTP handlers, policy/media validation, OpenAPI/tests; gateway exact route configs, OpenAPI and route test script.
**Interfaces:** Consumes Task 1 owner collection and mutation store; produces all HTTP endpoints in the contract table. No browser receives private Blob/SAS credentials.

- [x] Add handler tests for forged owner headers, unauthorized upload ID, wrong MIME/size, scan rejection, request cancellation, Range download and owner mismatch. Add schema-version/reference corruption fixtures for `.lpdeck`.
- [x] Run `go test ./internal/httpapi ./internal/assets -run 'Personal|Presenter' -count=1`; confirm new cases fail before handler implementation.
- [x] Implement server-owned upload metadata and streaming content proxy. Enforce a 200 MiB per-file maximum as initial policy, including `.lpdeck`; expose structured failure to client. Reuse existing admission/rate controls rather than add a billing/quota system.
- [x] Add exact gateway routes only on existing Presenter API host policy; inspect `conf.d/` source/include ownership before edit. Extend request-body limits/timeouts narrowly for content upload. Keep adjacent unknown paths, wrong methods and `/priv/*` rejected.
- [x] Test `bash scripts/test-personal-cloud-routes.sh`, `go test ./...`, `go vet ./...` in gateway; run asset handler tests and OpenAPI checks. Commit separately in each repo.

## Task 3: Durable local operations and immutable content snapshots

**Files:** Presenter persistence files from map plus `lib/__tests__/personal-sync-db.test.ts`.
**Interfaces:** Add `commitPersonalLocalMutation(input): Promise<void>` taking owner ID, node ID, local revision, mutation payload and optional immutable blob ID. It writes catalog/node/outbox atomically; `personal-sync-db.ts` owns its concrete input types. Runtime consumes durable records, never optimistic Zustand state.

- [x] Add fake-indexeddb tests for transaction abort, restart recovery, consecutive edits while upload active, native staging failure and account isolation.
- [x] Run `npx vitest run src/renderer/src/lib/__tests__/personal-sync-db.test.ts` and verify failures.
- [ ] Add new object stores with non-destructive upgrade. Route all personal create/rename/move/delete/restore/copy and deck-save call sites through the transaction helper; search every caller of folder mutation methods and file upload functions before edits.
- [ ] Assert the failure boundary explicitly:

```ts
expect(await db.get('personal-sync-outbox', operationId)).toBeUndefined()
expect(await db.get('folder-items', itemId)).toEqual(beforeItem)
```

- [ ] Preserve immutable snapshot bytes until ACK and dependent operations settle; integrate cleanup journal rather than eagerly delete old content. Publish Zustand updates only after local durable commit.
- [ ] Re-run focused tests and existing folder/deck persistence tests; commit `feat: persist personal cloud edits with outbox`.

## Task 4: Bidirectional sync, retry and conflicts

**Files:** `personal-sync-runtime.ts`, `personal-cloud-provider.ts`, `personal-sync-db.ts`, HHC API adapters, IPC/preload, `cloud-provider.ts`, `app-init.ts`; new runtime/provider tests.
**Interfaces:** Runtime exposes `startPersonalSync(accountUserId): () => void` and `requestPersonalSync(accountUserId): void`; consumes Task 2 APIs and Task 3 durable operations. Stop aborts I/O and fences late ACKs, without deleting pending data.

- [ ] Add deterministic fake-API tests for lost mutation response, 401/429/5xx, expired upload, blocked scan, remote update versus dirty content, delete versus offline edit, parent dependency, reset cursor and interrupted download.
- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/personal-sync-runtime.test.ts` before implementation.
- [ ] Implement startup/reconnect/manual refresh and bounded periodic polling by extending existing runtime scheduling; single account worker with IDB lease. Reuse transfer storage/download code, but commit personal state and cursor in the file explorer DB.
- [ ] Implement conflict copy once per conflicting operation with stable ID. Verify retry does not create extra copies and ACK for revision 1 cannot mark revision 2 clean.

```ts
expect(node.localRevision).toBe(2)
expect(node.syncedLocalRevision).toBe(1)
expect(pendingOperations).toHaveLength(1)
```

- [ ] Test logout/relogin same account recovers outbox, different account cannot drain it, and in-flight old-account responses cannot mutate current UI. Re-run related sync/read-only tests; commit `feat: synchronize personal cloud changes safely`.

## Task 5: File Explorer, offline deck editing and garbage collection

**Files:** UI/deck map, `sync-readonly.ts`, `sync-unlink.ts`, stores; asset-api retention worker tests; new `personal-cloud-sync.spec.ts`.
**Interfaces:** Personal provider advertises write capability; legacy providers default readonly. `.lpdeck` parser outputs the existing document plus supported schemaVersion and remapped local provenance; editor uses existing save coordinator with Task 3 commit.

- [ ] Add tests proving personal folders permit all mutation entrypoints while LINE/OneDrive remain readonly; downloaded decks edit offline; server rejection leaves local bytes intact.
- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/sync-readonly.test.ts src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts` plus new personal UI cases.
- [ ] Add one cloud root entry, pending/conflict status, retry and conflict resolution using existing File Explorer UI; no additional dashboard. Hide unsupported cross-root move and use copy semantics.
- [ ] Add schema migration and round-trip tests for embedded images, themes, notes, legacy deck and missing fonts. Unknown version opens an error state without rewriting bytes.
- [ ] Ensure active cloud files have no local expiry; trash cleanup cannot purge pending operations or dirty content. Server GC keeps current heads and 30-day trash; orphan staging older than 24 hours is collectible only after checking active upload state. Replaced content stays protected for at least existing download lease/ticket duration.
- [ ] Verify retention with a clock-controlled test: active files older than 14 days survive, 29-day trash survives, eligible 31-day trash is purged, active/dirty references remain intact.
- [ ] Commit UI/deck and server retention changes in their respective repos after tests pass.

## Task 6: Release and end-to-end acceptance

- [ ] Presenter: `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`, `npm run build:web`, `npx playwright test e2e/personal-cloud-sync.spec.ts --project=chromium`.
- [ ] asset-api: disposable DB-backed `go test -race ./... -count=1 -p=1`, `go vet ./...`, migration policy scripts, OpenAPI lint, all required `.github/workflows/ci.yml` checks. Gateway: route matrix, auth tests, OpenAPI and required CI.
- [ ] Cross-device smoke: A creates folder/image/deck, B receives and edits; A receives B changes; both offline edit same deck then reconnect; both versions survive; retry after commit response loss creates no duplicates; remote delete versus offline edit loses no bytes.
- [ ] Run actual Electron macOS + Windows and browser against authorized test account. Record account alias, device/app version, operation ID, cloud revision and downloaded hash without tokens.
- [ ] Release producer first: asset-api migration/API/health → gateway routes/health → Presenter package and web release. Each repo requires separate PR/CI/merge/release evidence; perform deployments only when authorized.
- [ ] Rollback client/gateway first if needed; keep additive schema and pending local outbox. Never drop personal data as rollback. Record tests versus deployment versus device smoke separately.
- [ ] Remove only this task's clean temporary worktrees after merged commits, successful releases and device smoke; otherwise preserve them. Planning-only delivery makes no implementation or deployment claim.

## Execution status — 2026-09-07

- Presenter worktree: `.worktrees/personal-cloud-sync`, branch `feat/personal-cloud-sync`, based on `02c59386` (camera PR #49 merged).
- asset-api worktree: `.worktrees/personal-cloud-sync`, branch `feat/personal-cloud-sync`, based on `c4465cf`.
- Task 1 completed in asset-api commit `a078572`: additive migration 017, owner-scoped collection/node mutations, receipts, immutable paginated snapshots and tombstones.
- Task 2 completed locally: asset-api `0bcb6e3` / `1102777`, gateway `b8dd292`, azure-infra `a7dcb09`.
- Owner-scoped create/PUT/complete/status and revision/Range content endpoints are implemented. Staging publication uses Azure If-None-Match and local atomic hard links; late writes clean obsolete staging. Replays preserve microsecond timestamp precision.
- `.lpdeck` server validation covers legacy/v1 schema, graph/order/reference consistency, bounded geometry and embedded raster images (PNG/JPEG/GIF/WebP/BMP, 20 MiB per image). SVG and external/local URLs are rejected. Task 5 must use the same client policy and retain unsupported original bytes.
- Download acquisition takes a ten-minute purge exclusion lease; HTTP transfers have a five-minute deadline. Active heads and 30-day trash are protected from purge. Full orphan/version/trash collection remains Task 5.
- Additional required repository: `/Users/rayselfs/Projects/hhc/website/azure-infra/.worktrees/personal-cloud-sync`. Gateway and asset-api Dapr request limits are set to 210 MB in Terraform, with the asset-api Bicep source kept consistent. nginx and API enforce the 200 MiB file limit.
- Dapr defaults require explicit larger-body configuration: https://docs.dapr.io/operations/configuration/increase-request-size/ . Changes are authored only; Terraform plan/apply and actual Azure large-file acceptance remain release gates.
- Validation: actual PostgreSQL-backed HTTP upload/scan-state/Range/owner tests, full Go race suite, vet, migration policy, OpenAPI, both Docker builds, gateway runtime method/host/auth matrix, Bicep compilation, Terraform fmt/validate. These were pre-release checks; see the later release evidence below.
- Actual disposable PostgreSQL 17 tests cover concurrent root creation and updates, receipt replay, injected transaction rollback, owner isolation, cycles, NFC name collisions, scan-gated head replacement, subtree restore and changes across pagination boundaries.
- Full database-backed `go test -race ./... -count=1 -p=1` and `go vet ./...` passed. Migration policy and OpenAPI validation passed; repository-wide OpenAPI warnings remain.
- Remaining work: Tasks 3–4, client/UI/deck/cleanup parts of Task 5, and Task 6 release/device acceptance. No cloud UI, client sync or device acceptance is claimed yet.
- User authorized automatic PR/CI/merge/release and continued implementation through the entire plan on 2026-09-07. A thread heartbeat (automation ID `automation`, every 30 minutes) resumes unfinished work and must be paused when all plan items are actually verified complete.
- Producer PR: https://github.com/HallelujahHomeChurch/asset-api/pull/57 (head includes `050a014`, personal GC and restore protection).
- Gateway PR: https://github.com/HallelujahHomeChurch/api-gateway/pull/79 .
- Infrastructure PR: https://github.com/HallelujahHomeChurch/azure-infra/pull/58 .
- Producer PR #57 merged as `9b827e1`; Production Release run `34078418371` succeeded, including deployment, health, workers and OpenAPI. Infrastructure PR #58 merged as `baa7566`; reviewed fresh production plan changes only gateway Dapr request size to 210 (asset-api was set by its Bicep release). Terraform apply is in progress; verify its result. Gateway PR #79 is open at `759b415`; CI run `34078728055` succeeded after updating the exact OpenAPI and runtime fragment expectations. Check current exact head before merge. Release order: asset-api producer/Bicep → reviewed azure-infra plan, merged change and deliberate Terraform apply → gateway → Presenter. azure-infra has no automatic apply workflow; never apply unrelated drift or an unreviewed plan.
- Server GC additions: active heads/29-day trash survive, 31-day restores fail, orphan staging waits 24 hours and excludes active uploads/workers, and head attachment/restore/replacement extend the asset lease to fence concurrent purge. Migration 019 indexes personal asset references. Full disposable PostgreSQL-backed Go race suite passed after these changes.
- Local database fixture is Docker container `codex-personal-cloud-pg`, PostgreSQL 17, bound only to `127.0.0.1:55439`, database `asset_test`. It is disposable test infrastructure, not production.
- Next implementation: atomic local outbox in the Presenter file-explorer DB, then runtime and all mutation entrypoints. Existing folder store mutators publish optimistically and must be handled specifically for personal writes; preserve legacy providers and Bible behavior.

## Acceptance checklist

- [ ] One owner, one cloud root; another account cannot read/write/upload/restore.
- [ ] CRUD and nested move converge across two computers; interrupted writes never expose partial content.
- [ ] Offline operations survive restart; uncertain retries do not duplicate work.
- [ ] Concurrent same-account edits preserve both versions, including delete/edit conflict.
- [ ] `.lpdeck` remains editable and presentable on another device without the original PPTX or local blob IDs.
- [ ] Active files never inherit LINE expiry; trash/GC and unlink cannot discard unsynced data.
- [ ] Legacy sync providers and existing projection flows pass regression checks.

### Local persistence checkpoint

- Presenter commit `d5ec943a` adds DB version 6, atomic catalog/node/outbox/snapshot writes, account isolation, sequence/dependency recording, native staging journals with Web Locks, and pending-snapshot protection during storage repair.
- Focused verification: 66 tests across personal DB, file DB, cleanup journal, storage integrity and LINE connection; full node/web typecheck and changed-file ESLint passed.
- This is the persistence foundation only. No personal root or UI is enabled. Task 3 still requires every mutation/deck-save call site, subtree semantics and durable UI publication. ACK/lease/runtime/conflicts, portable deck parsing and device acceptance remain unfinished.
- Native staging records acquire a Web Lock also respected by journal cleanup; failed staging IDs cannot be reused until cleanup completes. Avoid bypassing this helper for personal content.

### Released backend and portable document checkpoint

- Gateway PR #79 merged as `0eb56bc`; Production Release run `34079445416` succeeded, including runtime smoke and OpenAPI publication. Producer, gateway and infra source changes are merged; Presenter remains unmerged and unfinished.
- Terraform apply of the reviewed one-field change failed before mutation because Azure rejected the existing name-only inline secret during the provider full PUT (`bible-api-password-hash`). No secret value was retrieved or modified. Applied only the reviewed `httpMaxRequestSize: 210` with the documented Container Apps JSON Merge PATCH API, using a body generated from the saved merged-code plan. Official contract: https://learn.microsoft.com/en-us/rest/api/resource-manager/containerapps/container-apps/update?view=rest-resource-manager-containerapps-2026-01-01 . Subsequent Terraform plan exited successfully with no changes. Source of truth remains merged infra PR #58; do not add duplicate Terraform ownership or replay the failed saved plan.
- Asset-api live readback: `asset-api--0000049`, ready revision matches latest, image digest `sha256:58956fcdd981b5588a24c24fb752c51746d771b3ce3a8b6e4353359deb4dc522`, Dapr 210. Gateway Dapr readback 210 with provisioning succeeded before its release. Actual authenticated 200 MiB upload/device tests remain open.
- Presenter `e63cde67` adds portable graph/image validation aligned with the server, schemaVersion 1 for new/migrated documents, legacy loading, removal of remote provenance, local document-ID remapping and native source reads without original PPTX. Unsupported input bytes remain untouched. Rich-style validation, missing-font UX and personal editor-save integration remain to review/complete.
- At `e63cde67`: full lint, node/web typecheck, all 3,144 tests across 267 test files, and build/bundle checks passed. Bundle precache is 4.91 MiB of 5 MiB; retain the budget while adding runtime/UI.
- Next: finish Task 3 mutation routing and durable UI publication, then runtime/owner visibility/conflicts and complete Task 5 UI/cleanup. Existing generic folder mutators are optimistic. File Explorer should use its own async creation path (upload-utils must await parent creation); Bible-only FolderBrowser behavior remains unchanged. Personal native snapshots must never be overwritten through the old deck source ID captured by PresentationSessionRegistryContext.
- Offline startup note: HhcAuthContext clears session on unavailable bootstrap. Personal offline identity needs a durable last-active owner that is cleared on explicit sign-out/account switch; network failure must preserve local edits without authorizing API writes. Do not conflate an unavailable session with a different authenticated owner.

### Transport and synchronization checkpoint

- `74e90be8`: personal deck saves create immutable snapshots and ordered content/rename operations; ACK cannot mark a later edit clean. `29eab927`: shared authenticated HTTP protocol.
- `d8472166`: registered native IPC plus browser/Electron provider. Native uploads use disk-backed `openAsBlob`; downloads use bounded streams and atomic no-overwrite publication. Main-window/owner checks and cancellation fence late responses. Transport tests: 39 passing; real Electron `net.fetch` smoke uploaded a 1 MiB disk-backed Blob successfully (`/tmp/hhc-personal-electron-blob.log`). This is local transport smoke, not authenticated production/device acceptance.
- `914bdb14`: 30-second IDB worker lease with renewal and guarded release; ACK/transfer updates reject stale workers. Outbox advancement persists the exact mutation request before sending, reuses it after response loss, waits for scans and preserves conflict/rejected bytes. Retry scheduling and conflict resolution remain unfinished.
- Pull implementation stages immutable snapshots and commits catalog, node mappings and cursor atomically. Native staging journals remain locked until page commit. Dirty nodes preserve local bytes and retain a remote-head candidate. Collection revision advances only across observed changes; a noncontiguous ACK cannot authorize deletion of unseen subtree changes. Personal catalog records carry `personalOwnerId` for the upcoming visibility integration.
- Verification at this checkpoint: all 3,171 tests across 272 files passed; lint and build (including node/web typechecks) passed after removing an unused pull variable. PWA precache remains 4.91 MiB / 5.00 MiB. Logs: `/tmp/hhc-personal-client-checkpoint-{lint,tests,build}.log`. The separate earlier `typecheck` log contains the now-fixed unused-variable failure; use the successful build's fresh typechecks as current evidence.
- Still no cloud root/UI enabled and no Presenter PR/release. Remaining: owner/offline visibility; scheduler/start-stop/reconnect and expired historical download reset; every CRUD/copy/subtree mutation entrypoint; stable conflict copies/resolution; safe trash/unlink; portable rich styles/missing fonts; browser/Electron/device acceptance and Presenter CI/release. Do not mark Task 3/4/5 complete based on these foundations.

### Account visibility checkpoint

- `813f7776` records the atomic pull implementation and successful full-suite/build checkpoint above.
- Added the persisted last-owner preference, with runtime active owner/status in Zustand. HhcAuthContext hides personal records immediately on logout/account transition; only unavailable auth (offline startup) restores the last owner. Folder initialization and lazy item reads filter personal ownership; owner switches synchronously remove old catalog records from the visible store without deleting durable data. Refresh publication is generation-fenced. Personal deck saves publish while offline for the active owner, and durable item moves remove old-parent membership.
- Focused verification: 76 auth/folder/visibility tests, then 31 deck/visibility/file-store tests; node/web typechecks and changed-file ESLint passed. A broad text edit initially touched the legacy deck path; its two failing regression tests caught it and the edit was corrected before this checkpoint.
- Remaining ownership integration includes closing/fencing already-open personal editor/projection sessions on account departure, mutation entrypoint ownership checks, and scheduler generation cancellation. No personal root has been enabled yet.

### Local subtree and action checkpoint

- `3056d6ba` records account visibility integration.
- Folder delete/restore now atomically records affected subtree local revisions in the parent outbox operation. Child dirty state survives a later restore until its own parent ACK. Server subtree members share one collection revision; pulled tombstones use that revision as the deletion group, so independently deleted children are not implicitly restored.
- Local transactions validate parent mapping, live destination, normalized/legal names, sibling collisions, tombstone transitions and folder cycles. Pending operations retain their original expected revisions.
- Added personal action functions for local-space initialization, nested folders, file snapshots and rename/move/delete/restore with durable publication and account checks. These are not yet wired into all UI callers and local-space initialization is not automatically invoked yet.
- Verification: 26 subtree/pull/runtime tests, 20 action/DB tests, node/web typechecks and changed-file ESLint passed. Logs `/tmp/hhc-personal-subtree-final-tests.log`, `/tmp/hhc-personal-actions-tests.log`, `/tmp/hhc-personal-actions-typecheck.log`.

### Explorer routing checkpoint

- `9e057cff` records subtree/action primitives.
- File Explorer public rename/delete/restore/move methods route personal records through durable actions. Its legacy synchronous writer is blocked for personal parents; async folder creation and uploads resolve ownership from the durable parent when the visible cache is missing. Folder upload waits for each parent. Cross-domain move uses copying and preserves the source; recursive personal copies reject copying into their own subtree. Bible keeps its own store behavior.
- Personal folder dialogs hide retention choices. Generic file projection notes remain local settings (not cloud file content); personal pulls preserve them. `.lpdeck` creation now commits its snapshot and outbox before publication, including native staging. Thumbnail failure cannot compensate away personal content. Subsequent `.lpdeck` edits already use the immutable revision path.
- Account transition fixes: failed cleanup of a known departing account cannot reactivate it as an offline fallback; failed sign-out restores the still-valid current identity.
- Verification: 78 file-store/action/FAB tests, 35 upload/page/FAB tests, 24 auth/visibility tests, 41 deck-creation/parser/action tests; node/web typecheck and changed-file ESLint passed. Logs `/tmp/hhc-personal-store-routing-tests.log`, `/tmp/hhc-personal-ui-callers-tests.log`, `/tmp/hhc-personal-auth-transition-tests.log`, `/tmp/hhc-personal-deck-creation-tests.log`, `/tmp/hhc-personal-deck-creation-typecheck.log`.
- Root initialization is still not automatically invoked. Remaining work includes safe GC/trash/unlink, scheduler and conflict resolution, per-item status/root UI, account departure of already-open private editor/projection content, historical download reset and full browser/Electron/device acceptance. Do not treat this routing checkpoint as completed client delivery.

### Scheduler, conflict and retention checkpoint

- Asset API PR #58 merged as `28b1c24647d5f22bb1408d7fb2fd577b5fd344ab`. Production Release `34086266467` succeeded, including worker checks and OpenAPI publication. Live latest/ready revision is `asset-api--0000050`, image digest `sha256:22ac8a2c8ea138b4928a57b3b84ec12d9b99ec27a551ac32f3347d28debcb55f`. Optional restore name now commits with subtree restoration in one transaction; real PostgreSQL race tests, vet and OpenAPI validation passed before CI. This is not authenticated client acceptance.
- Added the cancellable account scheduler, lease renewal, ordered upload/pull, retry/backoff, expired download cursor reset and wake events. It is not yet started by the app supervisor. Offline authentication bootstrap retries on online/focus without reviving a superseded session.
- Added atomic content-conflict copy preservation: retain local editor item identity and immutable bytes, queue one fresh remote item, and reserve a separate mapping for an existing cloud original. Unsafe subtree/deleted-parent cases remain for explicit resolution. Manual resolution computes the affected subtree, fences the reviewed revisions, retains data on backup failure, and resets only reviewed catalog/outbox entries for a fresh pull. The existing explicit-rename save contract already preserves conflict filenames on normal autosave; no extra document-name tracking schema was needed.
- Added the cloud status/action component, three locale strings, backup including deleted descendants, and guarded trash/GC. Active, dirty, pending and recent trash stay protected; expired clean personal tombstones can be collected. Named trash restore awaits durable commit, reads fresh state between parent/child restores, and hides permanent deletion for cloud trash.
- Verification: full ESLint and build passed (PWA precache 4.96 MiB / 5 MiB). Full Vitest run: 273 files passed; five HHC LINE page tests failed because their mock omitted `_foldersArray`. Corrected that mock and all five passed on focused rerun. Conflict/runtime/pull/GC checks passed; logs `/tmp/hhc-personal-latest-{lint,build,tests}.log`, `/tmp/hhc-personal-page-fix-tests.log`, `/tmp/hhc-personal-resolution-tests.log`.
- Still unfinished: root identity/icon/action restrictions and per-item status; scheduler supervisor; account departure handling for open editors/projection; rich-style/font portability; targeted UI conflict/deleted-subtree acceptance; final full suite, browser/Electron and authenticated multi-device QA; Presenter PR/CI/release. Root initialization remains disabled until those integration safeguards are ready.
