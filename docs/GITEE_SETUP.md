# Gitee 自動更新設置指南

## 概述

本應用支持根據用戶地區自動選擇更新源：

- **中國地區**：使用 Gitee Releases 進行自動更新
- **其他地區**：使用 GitHub Releases 進行自動更新

## 設置步驟

### 1. 在 Gitee 創建倉庫

1. 登錄 [Gitee](https://gitee.com)
2. 創建一個新的倉庫（或使用現有倉庫）
3. 確保倉庫名稱與 GitHub 倉庫名稱一致（例如：`hhc-client`）

### 2. 獲取 Gitee Access Token

1. 進入 Gitee 設置頁面：https://gitee.com/profile/personal_access_tokens
2. 創建新的私人令牌（Personal Access Token）
3. 選擇權限：
   - `projects` - 讀寫權限
   - `releases` - 讀寫權限
4. 複製生成的 token（只會顯示一次）

### 3. 配置 GitHub Secrets

在 GitHub 倉庫的 Settings > Secrets and variables > Actions 中添加以下 secrets：

- `GITEE_TOKEN`: Gitee 的 Personal Access Token
- `GITEE_USERNAME`: 您的 Gitee 用戶名
- `GITEE_SSH_PRIVATE_KEY`（可選）: 用於自動同步代碼到 Gitee 的 SSH 私鑰

### 4. 更新配置

在 `electron/autoUpdater.ts` 中更新以下常量：

```typescript
const GITEE_OWNER = 'your-gitee-username' // 替換為您的 Gitee 用戶名
const GITEE_REPO = 'hhc-client' // 替換為您的 Gitee 倉庫名
```

### 5. 地區檢測機制

應用會通過以下方式檢測用戶是否在中國：

1. **時區檢測**：檢查系統時區是否為中國時區（Shanghai/Beijing/Chongqing）
2. **IP 地理位置**：通過 ipapi.co 服務檢測 IP 地址所在國家

如果任一方法檢測到用戶在中國，則使用 Gitee 作為更新源。

## 發布流程

1. 在 GitHub 上創建一個新的 tag（例如：`v1.1.9`）
2. GitHub Actions 會自動：
   - 構建應用程序
   - 發布到 GitHub Releases
   - 同步構建文件到 Gitee Releases
3. 用戶打開應用時會自動檢測地區並從相應的更新源檢查更新

## 注意事項

### Gitee 更新文件結構

由於 Gitee 的 Releases API 與 GitHub 不完全相同，需要確保：

1. `latest-mac.yml` 和 `latest.yml` 文件正確上傳到 Gitee Releases
2. 文件下載 URL 格式正確

### 故障排除

如果 Gitee 更新不工作：

1. 檢查 Gitee Releases 是否包含所有必要的文件
2. 檢查 `latest-*.yml` 文件中的下載 URL 是否正確
3. 查看應用控制台日誌，確認是否正確檢測到中國地區
4. 確認 Gitee token 權限正確

### 測試地區檢測

可以在開發環境中測試地區檢測：

```typescript
// 在 electron/autoUpdater.ts 中臨時添加
console.log('Region detection result:', await detectChinaRegion())
```

## 手動測試更新

1. 在 Gitee 創建一個測試 release
2. 上傳測試版本的安裝包
3. 在應用中檢查更新，確認能正確從 Gitee 下載
