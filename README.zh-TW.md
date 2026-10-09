<div align="center">

# StarBox

**把 GitHub Stars、Release、Fork 和 AI 整理成一個屬於自己的開發者工作台。**

自託管在 Cloudflare Workers，資料保存在自己的 D1 中。

[![CI](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iPotatow/StarBox/actions/workflows/ci.yml)

[简体中文](README.md) · 繁體中文 · [English](README.en.md)

</div>

<p align="center">
  <img src="assets/readme/starbox-ui.jpg" width="100%" alt="StarBox — 自託管的 GitHub 開發者工作台" />
</p>

## StarBox 是什麼

GitHub 的 Star 很適合收藏，但當儲存庫越來越多，真正麻煩的是後續：重新找到某個工具、知道它有沒有發新版本、整理自己的備註和分類、檢查 Fork 是否落後，以及把這些上下文交給 AI 使用。

StarBox 把這些事情放進同一個個人工作台。它面向希望長期維護自己 GitHub 收藏的開發者：介面和 API 執行在 Cloudflare Workers，帳號資料存進 D1，瀏覽器使用 IndexedDB 做本地快取；AI 是可選能力，不影響基礎的收藏、Release 和 Fork 工作流。

## 為什麼需要它

StarBox 不是另一個 GitHub 首頁，而是 GitHub 之後的那一層個人工作流：**收藏之後繼續整理，訂閱之後繼續閱讀，Fork 之後繼續維護。**

## 你會得到什麼

- **把 Stars 變成可維護的收藏庫** — 搜尋、篩選、分類、備註、README 閱讀，以及按需的 AI 摘要、標籤和批次整理。
- **持續跟進專案變化** — 聚合訂閱儲存庫的 Release、切換歷史版本、推薦安裝資源，並查看既有 Fork 與上游的領先 / 落後狀態和 Actions 執行情況。
- **把自己的收藏交給 AI** — 原生支援 Cloudflare Workers AI，也支援 OpenAI Compatible、Anthropic Messages 和 Google Gemini 等 HTTP 服務；透過 MCP 可以讓外部 AI 助手讀取你的收藏上下文，並依連線權限修改備註、分類和標籤。

## 快速開始

需要 Node.js、npm，以及可使用 **Workers + D1** 的 Cloudflare 帳號。

```bash
git clone https://github.com/iPotatow/StarBox.git
cd StarBox
npm ci
npx wrangler login
npm run deploy
```

首次部署後完成三件事：

1. 在 Cloudflare 為 `starbox` Worker 設定 **Custom Domain 或 Route**。倉庫預設關閉 `workers.dev`。
2. 設定登入密碼和憑據加密金鑰：

   ```bash
   npx wrangler secret put LOGIN_PASSWORD
   npx wrangler secret put STARBOX_ENCRYPTION_KEY
   # 可選：預設使用者名稱為 admin
   npx wrangler secret put LOGIN_USERNAME
   ```

3. 開啟 StarBox，進入 **Settings** 連接 GitHub Token；需要 AI 時再新增模型服務。

`npm run deploy` 會檢查或建立名為 `starbox` 的 D1 資料庫，並自動處理受支援的初始化 / 升級路徑，不需要手動填寫資料庫 UUID。升級既有實例前，請先備份 D1，並保留原本的 `STARBOX_ENCRYPTION_KEY`。

如果 Cloudflare 登入帳號下有多個帳號，可在部署前設定 `CLOUDFLARE_ACCOUNT_ID` 選擇目標帳號。

## AI：可選，但開箱即用

StarBox 已宣告 Cloudflare `AI` binding。部署後在 **Settings → AI** 新增 **Cloudflare Workers AI** 即可使用儲存庫整理、批次整理和 Release 總結，不需要額外儲存 AI API Key；也可以繼續使用自訂 HTTP Provider。

Workers AI 的每日官方用量面板是可選增強，需要額外設定 Cloudflare Account Analytics 唯讀憑據。完整說明見 [WORKERS_AI.md](WORKERS_AI.md)。

## MCP：把收藏交給你的 AI 助手

StarBox 在 `/mcp` 提供 Streamable HTTP MCP 介面。每個連線使用獨立 Bearer Token，預設唯讀，可單獨開啟收藏編輯權限。

支援的能力包括搜尋收藏、讀取儲存庫與 README、查詢分類和 Release，以及在啟用權限後修改備註、分類和標籤。完整設定與工具列表見 [MCP.md](MCP.md)。

## 資料和安全

- **資料留在自己的 Cloudflare 帳號**：業務資料存於 D1，IndexedDB 只負責瀏覽器快取與本地加速。
- **敏感憑據加密儲存**：GitHub Token、HTTP AI Key 和敏感自訂請求標頭由 Worker 加密後寫入 D1，安全讀取介面不回傳明文。
- **寫入有並行保護**：儲存庫使用者欄位使用版本校驗避免覆蓋較新的修改；MCP 編輯沿用同一套 revision guard。

README 與 Release Markdown 支援 GFM，原始 HTML 不會執行。

## 目前邊界

- StarBox 可以維護既有 Fork，但目前不負責建立新的 Fork。
- `npm run dev` 是靜態 UI 預覽，`/api/*` 與 `/mcp` 會回傳 501；完整 Worker 聯調請使用 Wrangler 和本地 D1。
- MCP 目前要求客戶端支援自訂 Bearer 請求標頭，不提供僅 OAuth 的連線方式。

## 開發與驗證

```bash
npm ci
npm run dev
```

提交前執行完整檢查：

```bash
npm run check
```

它會執行型別檢查、自動化測試、生產建置和 UI source gates。生產部署後的資料庫、登入和加密設定可以透過：

```bash
STARBOX_DEPLOYMENT_URL=https://your-domain.example npm run deploy:verify
```

驗證範圍與邊界見 [VERIFICATION.md](VERIFICATION.md)。

## 技術與文件

**React 19 · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1 · Base UI**

UI primitives 採用 [COSS](https://github.com/cosscom/coss) 的 copy/paste-and-own 模式在倉庫內維護，圖示使用 [Phosphor Icons](https://phosphoricons.com/)。

- [Workers AI](WORKERS_AI.md) — 原生 AI binding、模型服務和官方額度統計。
- [MCP](MCP.md) — AI 助手連線、權限、工具和安全邊界。
- [驗證契約](VERIFICATION.md) — 自動化檢查、CI 與生產驗證範圍。
- [第三方聲明](THIRD_PARTY_NOTICES.md) — 依賴來源與授權說明。

## 關於作者

由 [iPotatow](https://github.com/iPotatow) 維護。

## 授權

目前倉庫尚未包含 `LICENSE` 檔案。請不要在授權明確前假設擁有複製、修改或再散佈權限。
