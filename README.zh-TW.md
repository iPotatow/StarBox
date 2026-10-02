<div align="center">

# StarBox

**把收藏的儲存庫、關注的版本和維護的 Fork，放進自己的 GitHub 工作台。**

一個面向個人開發者、可自行架設的 GitHub 管理工具。

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)

[简体中文](README.md) · 繁體中文 · [English](README.en.md)

[核心功能](#核心功能) · [快速開始](#快速開始) · [部署設定](#部署設定)

</div>

<p align="center">
  <img src="assets/readme/starbox-ui.jpg" width="100%" alt="StarBox Star 頁面實際截圖：使用本機示範儲存庫資料展示儲存庫收藏工作台。" />
</p>

Star 過的專案越來越多，找回某個工具、跟進新版本、檢查 Fork 是否落後，也逐漸成了日常工作。StarBox 把這些操作集中到一個介面：整理收藏、訂閱釋出、維護已有 Fork，再從發現頁找到下一個值得關注的專案。

前端與 API 部署在 Cloudflare Workers，帳號資料儲存在 D1。換裝置登入後，可以繼續使用自己的分類、備註和訂閱；AI 分析依需求設定。

## 核心功能

| 想做的事 | StarBox 提供的能力 |
| --- | --- |
| **找回並整理收藏** | 搜尋已 Star 的儲存庫，按分類、語言和時間篩選；檢視 README、記錄備註，使用 AI 摘要、標籤、分類與批次分析。 |
| **跟進版本釋出** | 聚合訂閱儲存庫的最新 Release，搜尋儲存庫、切換歷史版本，並按目標裝置推薦安裝套件；支援最新 Release 的 AI 摘要。 |
| **維護已有 Fork** | 檢視與上游的領先 / 落後狀態和最近一次 Actions 執行，同步上游或手動觸發 Workflow。 |
| **發現新專案** | 透過 GitHub 搜尋熱門、活躍或新近儲存庫，按語言、Topic 和時間範圍篩選，並直接 Star。 |

Settings 中可管理 GitHub 連線、AI 服務與模型、分類、外觀、導覽、Release 規則，以及資料匯入 / 匯出。目前範圍不包含 Gist 管理和建立 Fork。

支援簡體中文、繁體中文與 English，可在設定頁或桌面側邊欄切換，語言偏好會在登入裝置間同步。

## 快速開始

### 部署自己的工作台

需要 Node.js、npm 和可使用 Workers / D1 的 Cloudflare 帳號。

```bash
git clone https://github.com/iPotatow/StarBox.git
cd StarBox
npm ci
npx wrangler login
npm run deploy
```

部署腳本會先執行專案檢查，查詢或建立名為 `starbox` 的 D1 資料庫，初始化或升級受支援的資料庫結構，再部署 Worker 與靜態資源，無需手動填寫資料庫 UUID。

**首次部署還需完成以下設定：**

1. 為 Worker 綁定自訂網域或 route；預設關閉 `workers.dev`。
2. 設定非空的 `LOGIN_PASSWORD` 和 `STARBOX_ENCRYPTION_KEY`，依需求修改預設使用者名稱 `admin`。
3. 開啟部署網址並登入，在 Settings 中連線 GitHub Token；需要 AI 分析時再新增 AI 服務與模型。

### 部署設定

透過互動式命令設定 Worker 金鑰：

```bash
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put STARBOX_ENCRYPTION_KEY
npx wrangler secret put LOGIN_USERNAME
```

| 變數 | 用途與預設值 |
| --- | --- |
| `LOGIN_USERNAME` | 登入使用者名稱，預設 `admin`，可改為自訂值。 |
| `LOGIN_PASSWORD` | 必須為非空值；缺失時拒絕登入，沒有預設密碼。 |
| `STARBOX_ENCRYPTION_KEY` | 必須為非空值；trim 後經 SHA-256 派生，用於 AES-256-GCM 憑證加密。 |
| `SESSION_TTL_SECONDS` | 工作階段有效期，預設 `604800` 秒（7 天）。 |

不要將金鑰寫入儲存庫或 `wrangler.jsonc`。如果 Cloudflare 登入帳號下有多個帳號，請設定 `CLOUDFLARE_ACCOUNT_ID` 選擇部署目標。

設定公開存取網址後，執行遠端健康檢查：

```bash
STARBOX_DEPLOYMENT_URL=https://your-domain.example npm run deploy:verify
```

該命令檢查 `/api/health` 的資料庫、登入設定和加密設定。未設定 `STARBOX_DEPLOYMENT_URL` 時會跳過遠端檢查；本機檢查通過不能代替正式環境驗證。

### 資料庫初始化與升級

部署腳本先執行 `npm run check:installed`，再根據遠端資料庫結構選擇操作：

- 空庫：執行 `migrations/0001_schema.sql`，建立最終結構。
- 受支援的舊結構：使用 `migrations/0002_legacy_upgrade.sql` 升級，包括舊多表結構和已合併的舊單使用者結構。
- 目前結構：不執行 SQL；未知或中間結構會中止部署。

儲存庫只維護這兩個 SQL 檔案，它們不是依次執行的增量遷移鏈。腳本驗證最終 8 表結構、關聯、JSON、資料計數和關鍵查詢計劃，並透過臨時 Wrangler 設定部署，不改寫儲存庫內的 `wrangler.jsonc`。升級已有執行個體前，先備份 D1 資料並保留原有加密金鑰。

### 本機預覽與開發

```bash
npm ci
npm run dev
```

預設預覽網址為 `http://127.0.0.1:4173`。此命令建置並啟動靜態 UI 預覽，`/api/*` 返回 501；完整 API 聯調需要 Wrangler、本機 D1 結構和本機憑證設定。

提交程式碼前可執行：

```bash
npm run check
```

該檢查使用已安裝依賴的真實型別，執行自動化測試、正式環境建置與 UI 結構檢查，無需瀏覽器執行環境。CI 在 main 推送、面向 main 的 Pull Request 和手動觸發時執行相同檢查；介面互動與真實服務整合需另行驗證。完整要求見 [驗證契約](VERIFICATION.md)。

## 資料由自己管理

- **跨裝置延續工作台**：D1 儲存帳號業務資料，IndexedDB 用於瀏覽器快取與本機加速。
- **憑證加密儲存**：GitHub Token、AI Key 和敏感自訂請求頭由 Worker 加密後寫入 D1，憑證 API 不返回明文。
- **AI 依需求連線**：在 Settings 中設定服務與模型，讓儲存庫整理和版本閱讀使用自己的 AI 設定。

README 與 Release 內容支援 Markdown 和 GFM，原始 HTML 不執行。

## 同步與架構

D1 保持 8 張產品表。Repository 使用者欄位透過 `user_revision` 做樂觀並行控制；Release 原文和附件由瀏覽器快取持有，最新 Release 的 AI 摘要儲存於 D1。Star 同步最多讀取 3,000 個儲存庫，D1 業務寫入按最多 50 條語句一批處理。

常規寫入在伺服器端確認後不會立即觸發完整 Bootstrap；Bootstrap 仍是帳號資料的權威校準入口，等待進行中的寫入，遇到重疊會重新取得快照。IndexedDB 只持久化變化的 entity store，並合併快速連續寫入。登入工作階段變化會取消舊請求，編輯器保留開啟時的草稿與版本。

五個業務頁面依需求載入；Star 卡片使用 `content-visibility` 延遲離屏佈局與繪製。入口、CSS 和頁面分塊使用內容雜湊與 immutable 靜態快取，頁面載入失敗提供重新載入以恢復。

Worker 入口、路由與業務處理分離，`worker/routes` 按業務域組織，`worker/repositories` 建置寫入 SQL，`worker/repository.ts` 執行 D1 交易；`shared` 統一前後端資料契約、設定驗證和附件平台規則。

登入使用安全 Cookie 與頻率限制，寫請求驗證同源 Origin 和 JSON Content-Type。GitHub 請求限制為 30 秒 / 8 MiB，AI 請求限制為 60 秒 / 2 MiB，AI 請求禁止重新導向。Workers Logs 已啟用，取樣率為 10%。

## 技術與文件

React 19 · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1

介面元件採用 [COSS](https://github.com/cosscom/coss) 的 copy/paste-and-own 模式，互動基於 [Base UI](https://github.com/mui/base-ui)，圖示使用 [Phosphor Icons](https://phosphoricons.com/)。

- [驗證契約](VERIFICATION.md)：自動化檢查、CI 與正式環境驗證邊界。
- [第三方聲明](THIRD_PARTY_NOTICES.md)：依賴來源與授權條款說明。

遇到問題或有功能建議，歡迎提交 [Issue](https://github.com/iPotatow/StarBox/issues)，並附上重現步驟和相關環境資訊。

## MCP 連線

在 **Settings → MCP** 建立有有效期的獨立憑據，將 `/mcp` 位址與 Bearer 請求標頭填入支援 Streamable HTTP 的客戶端。AI 可搜尋收藏、讀取備註與 README、查詢分類、訂閱及版本。預設唯讀，可按連線開啟備註、分類和標籤修改，並沿用版本衝突校驗。設定頁可查看最近使用時間和撤銷憑據。目前不支援僅 OAuth 的客戶端。詳見 [MCP 使用說明](MCP.md)。

## 關於與診斷

設定底部的「關於」區域顯示應用版本，有新部署時提示重新整理，並支援複製版本、服務與瀏覽器診斷資訊用於問題回報。診斷內容不包含密碼或連線憑據。
