<div align="center">

# StarBox

**把 GitHub 收藏整理成自己的開發者工作台。**

搜尋與整理 Stars，跟進 Release，維護 Fork；自託管於 Cloudflare Workers，資料存於自己的 D1。

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

[简体中文](README.md) · 繁體中文 · [English](README.en.md)

</div>

GitHub 的 Star 方便收藏，長期使用卻需要更多：重新找到那個工具、記住為什麼收藏、知道它有沒有新版本。StarBox 把這些後續工作放在一起，適合想持續維護自己 GitHub 收藏的開發者。

- **找回並整理收藏**：搜尋儲存庫、描述、標籤和備註，用分類保留自己的組織方式，直接閱讀 README。
- **跟進專案變化**：訂閱 Release、瀏覽歷史版本、按平台推薦安裝包，查看既有 Fork 的上游差異和 Actions 狀態。
- **按需交給 AI**：產生摘要、輔助分類和批次整理；透過 MCP 讓外部助手讀取收藏，並按權限編輯。AI 可選，基礎收藏管理不依賴它。

## 快速開始

準備 **Node.js 22**、npm，以及可使用 **Workers + D1** 的 Cloudflare 帳號。

```bash
git clone https://github.com/iPotatow/StarBox.git
cd StarBox
npm ci
npx wrangler login
npm run deploy
```

部署腳本會檢查或建立 D1 資料庫，並處理受支援的初始化和升級路徑，無需手動填寫資料庫 UUID。

首次部署後：

1. 為 `starbox` Worker 設定 **Custom Domain 或 Route**，倉庫預設關閉 `workers.dev`。
2. 設定登入密碼和憑據加密金鑰：

   ```bash
   npx wrangler secret put LOGIN_PASSWORD
   npx wrangler secret put STARBOX_ENCRYPTION_KEY
   # 可選：預設使用者名稱為 admin
   npx wrangler secret put LOGIN_USERNAME
   ```

3. 登入，點擊星標首頁的 **連線 GitHub**，完成驗證後同步 Stars。也可從 **設定 → 帳戶與 GitHub** 管理連線。

多 Cloudflare 帳號時，可在部署前設定 `CLOUDFLARE_ACCOUNT_ID`。升級既有實例前，請先備份 D1，並保留原本的 `STARBOX_ENCRYPTION_KEY`。

## 從收藏到工作台

<img src="assets/features.webp" alt="StarBox 介面範例：瀏覽收藏儲存庫、分類、標籤與 Release 訂閱" width="100%">

連線 GitHub 後，StarBox 同步你的收藏；分類、備註和訂閱儲存到 D1，IndexedDB 提供本地快取。尚未連線時，既有收藏仍可瀏覽和本地搜尋。

連線對話框提供 **前往 GitHub 建立 Token** 和 **如何設定權限**。支援 Fine-grained 與 Classic Token，建議設定有效期。Fine-grained Token 同步 Stars 使用 **Starring → Read-only**；需要取消 Star 時再啟用 **Read and write**。私有儲存庫需加入授權範圍，讀取其 Actions 狀態還需 **Actions → Read-only**。詳見 [GitHub 權限文件](https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user)。

## 可選的 AI 與 MCP

| 能力 | 開始使用 |
| --- | --- |
| Cloudflare Workers AI | 在 **設定 → AI** 新增服務，無需額外儲存 AI API Key |
| 自訂模型服務 | 支援 OpenAI Responses 和 Anthropic Messages 等 HTTP 服務 |
| 外部 AI 助手 | 連線 `/mcp`，使用獨立 Bearer Token；預設唯讀，編輯權限單獨開啟 |

MCP 支援搜尋收藏、讀取儲存庫與 README、查詢分類和 Release，以及授權後的備註、分類和標籤編輯。Workers AI 官方每日用量面板需要另行設定唯讀統計憑據。設定細節見 [Workers AI](WORKERS_AI.md) 和 [MCP](MCP.md)。

## 資料與使用邊界

- GitHub Token、HTTP AI Key 和敏感請求標頭由 Worker 加密後寫入 D1，讀取介面不回傳明文。
- 儲存庫使用者欄位採用版本校驗，避免覆蓋較新的修改；MCP 編輯沿用同一套並行保護。
- README 與 Release Markdown 支援 GFM，原始 HTML 不會執行。
- 目前維護既有 Fork，不建立新的 Fork。
- MCP 客戶端需支援自訂 Bearer 請求標頭；目前不提供僅 OAuth 的連線方式。

## 本地開發與驗證

```bash
npm ci
npm run dev
```

`npm run dev` 在 `http://127.0.0.1:4173` 提供靜態 UI 預覽，`/api/*` 和 `/mcp` 回傳 501。驗證登入、GitHub 或其他業務介面，需要使用 Wrangler 和本地 D1。

```bash
npm run check
STARBOX_DEPLOYMENT_URL=https://your-domain.example npm run deploy:verify
```

完整檢查包括型別、自動化測試和正式建置；`npm run coss:verify` 僅供手動 UI 審查。線上驗證檢查資料庫、登入及加密設定；未設定 `STARBOX_DEPLOYMENT_URL` 時會略過。本地通過不代表已經部署。

## 文件與技術

**React 19 · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1 · Base UI**

UI primitives 採用 [COSS](https://github.com/cosscom/coss) 的 copy/paste-and-own 模式，圖示使用 [Phosphor Icons](https://phosphoricons.com/)。

[Workers AI](WORKERS_AI.md) · [MCP](MCP.md) · [驗證範圍](VERIFICATION.md) · [第三方聲明](THIRD_PARTY_NOTICES.md)

## 授權與維護者

[MIT](LICENSE) · 由 [iPotatow](https://github.com/iPotatow) 維護。
