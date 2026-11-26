---
name: tw-wayground-skill
description: Design and create Wayground assessments, flashcards, presentations, and classroom game workflows using available connectors, import files, and verified browser operations.
---

## Codex connector 實作路徑

在目前 Agent 工具清單中發現並直接使用平台 connector；先讀工具描述與實際 schema，不依 CLI 推測支援。Padlet connector 可建立白板與 Arcade 配對遊戲；Wayground connector 可建立選擇題與閃卡草稿。每次建立後讀回或以平台編輯頁核對，呈現資源連結和實際存取狀態；connector 能力與 REST CLI 的限制須分開描述。未在工具清單發現功能時，依既有匯入或 Computer Use 流程處理。

使用平台特有模式時，先查閱 [模式與驗證指引](references/platform-modes.md)。以 [教學 brief 範例](assets/lesson-brief-v1.example.json) 定義年級、來源、目標、活動、時間和玩家回饋；用既有 CLI 的 `lesson --input <brief.json>` 檢查時間及來源關聯，結果不取代教師審查。

## 跨 Agent 環境與工具發現

首次安裝前及需要外部平台操作前，執行 `node scripts/portable-core/agent-doctor.mjs --agent codex`；可將 codex 換為 claude、antigravity、opencode 或 other。診斷不會讀出或測試金鑰；unknown 不是可用。依診斷提示與當前 Agent 工具清單檢查 connector/MCP、權限、瀏覽器與登入，不能由本機 CLI 是否存在推論工具可用。詳見 [跨 Agent 與模式指引](references/portable-integration.md)。

連接器與 MCP 路徑僅在當前工具庫確認操作、權限與使用者需求後使用；使用具體工具前確認其參數及輸出。原有下方 CLI 與人工流程、品質檢查及外部寫入限制仍適用於原工具；不能宣稱未測試的工具路徑已完成。完成後讀回並區分草稿、發布及分享狀態。

# Wayground 測驗匯入

將已審核的測驗 JSON 轉為 Wayground（原 Quizizz）`.xlsx` 匯入檔。**先有來源、受測者、目標和命題藍圖，再產檔；匯入格式通過不代表題目教學品質已由系統判定。**

## 必要工作流

1. 蒐集並確認 assessment brief；缺來源、受測者、目標或藍圖時，停止產題與產檔。
2. 依下列契約建立 `quiz.json`，使每題可回查教材與學習目標。
3. 執行 `node scripts/build-xlsx.mjs quiz.json out.xlsx`。
4. 先讀 `out.quality.json`；僅 `status: "ready"` 可交付。檢查 blockers、warnings、逐題追溯與 blueprint。
5. 再讀 `out.readiness.json` 及 stdout warnings，處理平台題型、圖片、長度、選項與空格的匯入風險。
6. 依實際可用的 connector 或登入介面建立、匯入並核對；結果必須區分草稿、發布與指派。

## assessment v1 契約

```json
{
  "title": "單元檢核",
  "questions": [{
    "type": "multiple_choice",
    "prompt": "題幹",
    "options": [{"text": "選項 A", "correct": true}, {"text": "選項 B", "correct": false}],
    "explanation": "供教師複核的說明",
    "sourceRefIds": ["src-1"], "objectiveIds": ["obj-1"],
    "cognitiveLevel": "understand", "difficulty": "basic"
  }],
  "assessment": {
    "version": 1,
    "sources": [{"id": "src-1", "title": "教材名稱", "locator": "第 3 頁／段落"}],
    "audience": {"gradeLevel": "國七", "proficiency": "基礎", "language": "zh-TW", "prerequisites": ["已學過…"]},
    "objectives": [{"id": "obj-1", "text": "能…"}],
    "purpose": "形成性檢核",
    "blueprint": [{"objectiveId": "obj-1", "cognitiveLevel": "understand", "difficulty": "basic", "count": 1}]
  }
}
```

`cognitiveLevel` 限 `remember`、`understand`、`apply`、`analyze`、`evaluate`、`create`；`difficulty` 限 `basic`、`developing`、`proficient`、`advanced`。每個來源須有 `id/title/locator`，受測者須有年級、程度、語言和至少一項先備能力；藍圖總題數及每一格實際題數都必須吻合。選擇題至少一個正解，單選題剛好一個。

## Wayground 提醒

- 映射題型為 `multiple_choice`、`multiple_select`、`true_false`、`fill_blank`、`short_answer`、`open_ended`、`poll`；其他題型會 skipped。選項最多五個。
- 試算表只有 Image Link；非圖片媒體要在編輯器補建。多空格填空題會被提醒，因單列格式無法表達不同空格。
- 匯入時：Create → 評估 → 匯入工作表／問題 → 選「試算表」分頁 → 上傳 xlsx。匯入後核對題目與能見度；勿直接發布。

### 簡報教材上傳（實測）

在已登入的 `/admin` 頁面點選「上傳」，進入 `wayground.com/admin?tab=upload`。頁面提供「轉換你的文件進入互動資源」，可選「裝置」或 Google 雲端硬碟，並顯示檔案上限 50 MB、最多 100 頁；另可貼網站或 YouTube 連結。選取簡報後選「投影片」→「下一個」，確認檔名、投影片數與資源類型，再選教學目標並點「Create resource」。成功證據是進入 `/presentation/<id>/edit` 編輯器並回讀投影片數；不要把檔案選擇器開啟或顯示 `No file chosen` 當成已上傳成功。

## Google OAuth 登入工作階段

依 [google-oauth-handoff.md](references/google-oauth-handoff.md) 執行登入前置作業。Google OAuth 只能在使用者平常使用的正常 Chrome 個人檔案中由教師手動完成；不要用 Playwright、Chrome DevTools MCP 新開的自動化瀏覽器、嵌入式 WebView 或 Skill 代填 Email、密碼、MFA。登入完成後，工具才可接管同一個已登入工作階段（例如 localhost CDP）執行 Wayground 操作。

若頁面停在 `accounts.google.com`、顯示「This browser or app may not be secure」、`signin/rejected` 或仍顯示「登陸註冊」，立即停止自動化；請教師回到正常 Chrome 完成登入，再重新執行工作階段前置檢查。不要用清除 Cookie、重試自動化登入或換固定座標來繞過 Google 風控。

若正常 Chrome 回到 Wayground 公開首頁並顯示「登入／註冊」，走 [google-oauth-handoff.md](references/google-oauth-handoff.md) 的「正常 Chrome 帳戶提示分支」：教師在 Chrome 原生提示中選取正確帳戶並完成必要確認，工具等待回到 Wayground 後重新讀取頁面；只有看到 `/admin`、帳戶入口／頭像且不再看到「登入／註冊」才算登入成功。

## 錄製後的草稿動作

教師以 Record & Replay 提供可檢視錄製後，才可依 [recorded-action-handoff.md](references/recorded-action-handoff.md) 將 XLSX 匯入與未發布預覽接回工作流；沒有錄製時不可猜測網站操作。完成 Google OAuth 後，瀏覽器操作需使用同一個真人已登入的正常 Chrome／Computer Use 工作階段，採用語意化控制（按鈕、分頁、檔案名稱），不可把座標或錄製中的固定檔名當成通用腳本。

執行錄製後流程時：

1. 先確認 `quality.status=ready`，閱讀 `quality.blockers`、`quality.warnings`、`readiness.perQuestion` 與 `readiness.warnings`；任何未接受的風險都先停下來請教師判斷。
2. 進入 Wayground 的建立評估流程，選「匯入工作表／問題」，切到「試算表」，再以檔案選擇器選取使用者明確指定的 `out.xlsx`。
3. 按「繼續」後，核對題數、題幹、題型、選項、正解與解析；若預覽與 quality/readiness 報告不一致，停止，不修正或發布平台內容。
4. 進入草稿編輯器後，依教師提供的 brief 核對標題、科目、年級、語言、教學目標與能見度；錄製中的「蒸散作用／科學／7年級／英語」只是示範值，不得固定套用。
5. 在發布前停止並回報證據，交由教師決定是否發布、指派或 Live。不得點擊或聲稱完成「發布」「指派」「Live」「分享」或擴大能見度。

若要走簡報教材分支：從 `/admin` 點「上傳」→「裝置」→選取教師指定的 PPT／PPTX／PDF，等待文件轉換→選「投影片」→「下一個」→選教學目標→「Create resource」。2026-07-28 實測 `CANARY-20260728-water-cycle.pptx` 成功建立 15 張投影片的編輯器草稿，URL 為 `/presentation/6a681d45b9b859b2c15d6099/edit`；只看到「發布」按鈕不代表已發布。

## 例外與限制

`--legacy` 會輸出 `legacy-unverified` quality report，不能作為命題品質證明。未有已審核 action map 前，此工具不含 API、登入、瀏覽器自動登入、發布或指派；錄製後流程只會在教師明確確認後啟用對應的已驗證動作。

## 常見錯誤

| 症狀 | 處理 |
|---|---|
| `assessment-quality-blocked` | 補 assessment v1、題目追溯欄位與藍圖；不要把 legacy 當修正。 |
| skipped／flagged | 先讀 readiness 的 `perQuestion` 和 warnings，再修正題型、選項、媒體或空格。 |
| `explanation-missing` | 補教師複核與回饋用的解析；quality report 不會驗證學科真偽。 |

## CLI 教學帳戶控制（錄製後啟用）

`tw-edtech-wayground` 在既有 assessment quality gate 外，加入能力目錄、計畫確認與遮罩證據。先跑 `doctor`、`validate --input quiz.json`、`catalog scan`、`plan`；未有已審核的正常 Chrome Canary action map 時，`run` 一律回傳 `requires-recording`。

```bash
tw-edtech-wayground validate --input quiz.json
tw-edtech-wayground plan --action assessment.import --resource CANARY-assessment
```

匯入／編輯需 `--confirm-write`；發布、分享、Live、作業、班級同步、報告與刪除需計畫確認碼與 `--confirm-impact`。讀取名單或報告時還需 `--confirm-student-data`，不得記錄姓名、email、作答或分享 URL。
