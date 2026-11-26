<p align="center"><img src="assets/logo.png" width="88" alt="Wayground logo"></p>

# tw-wayground-skill 使用手冊

Wayground（原 Quizizz）教學資源 Skill。它將具來源追溯與命題藍圖的測驗 JSON 轉成 `.xlsx`、`.quality.json`、`.readiness.json`，並提供正常 Chrome 的試算表匯入、PPTX 簡報教材轉換、草稿核對與發布前停點。

## 事前條件

- Node.js 18 以上；先在本資料夾執行 `npm install`。
- 可定位的教材來源、明確受測者（年級、程度、語言、先備能力）、學習目標、用途及藍圖。
- 以 [assessment-brief.example.json](references/assessment-brief.example.json) 為起點，填入自己的資料後才命題。

## 標準使用與報告

```bash
npm install
node scripts/build-xlsx.mjs quiz.json out.xlsx
```

| 檔案 | 用途 |
|---|---|
| `out.xlsx` | 教師手動匯入的 Wayground 試算表。 |
| `out.quality.json` | 只有 `status: "ready"` 可交付；含阻擋原因、warning、逐題追溯與藍圖摘要。 |
| `out.readiness.json` | 匯入格式的 ready/skipped、媒體、長度與空格提醒。 |

## assessment v1 輸入契約

Quiz 需有 `title`、`questions[]`、`assessment.version: 1`。`assessment.sources[]` 每筆都有 `id/title/locator`；`audience` 有 `gradeLevel/proficiency/language/prerequisites[]`；`objectives[]` 每筆有 `id/text`，另有 `purpose`；`blueprint[]` 每格有 `objectiveId/cognitiveLevel/difficulty/count`。每題有 `sourceRefIds[]`、`objectiveIds[]`、`cognitiveLevel`、`difficulty`。

認知層次：`remember`、`understand`、`apply`、`analyze`、`evaluate`、`create`；難度：`basic`、`developing`、`proficient`、`advanced`。所有題目必須能回查登錄的來源與目標，藍圖總數和每一格實際數量都要吻合。選擇題至少有一個正解，單選題剛好一個；`explanation` 雖非阻擋欄位，應提供給教師審核與回饋。

缺資料、未知來源／目標、錯誤答案鍵或藍圖不符時會以 `assessment-quality-blocked` 停止。這不是可由「快要上課」覆寫的提醒，而是先補 brief 的信號。

## Wayground 匯入提醒

支援 `multiple_choice`、`multiple_select`、`true_false`、`fill_blank`、`short_answer`、`open_ended`、`poll`，選項最多五個。只有圖片可放入 Image Link；其他媒體需在編輯器補加。多個填空標記無法由單列格式完整表達。請完整查看 warnings。

教師操作：Wayground → Create → 評估 → 匯入工作表／問題 → 切到「試算表」分頁 → 上傳 `out.xlsx` → 在未發布草稿核對每題 → 審慎確認 metadata 與能見度後，再由教師決定發布、指派或 Live。不要將此工具描述成會代替教師執行平台操作。

Wayground 另有簡報／文件教材入口：`/admin` → `上傳` → `裝置`（或 Google 雲端硬碟）→ 選取 PPT／PPTX／PDF → 選「投影片」→「下一個」→選教學目標→`Create resource`。成功判定是回到 `/presentation/<id>/edit` 並能核對投影片數；頁面目前顯示上限 50 MB、最多 100 頁。這與 XLSX 試算表匯入是兩條不同流程。

## 正常 Chrome 登入與錄製後銜接

Google 登入必須由教師在平常使用的正常 Chrome 個人檔案中完成；不要讓自動化瀏覽器、嵌入式 WebView 或 Skill 代填 Email、密碼、MFA。若出現 `This browser or app may not be secure`、`signin/rejected` 或仍停在登入頁，回到正常 Chrome 完成登入後再繼續。Wayground 回到 `/admin`、顯示帳戶入口／頭像且不再顯示「登入／註冊」後，才算登入成功。

收到可檢視的 Record & Replay 錄製後，才可用同一個已登入 Chrome 工作階段銜接 XLSX 匯入與草稿預覽；每次要重新讀取頁面，使用按鈕、分頁與檔案名稱等語意資訊，不固定座標、私人 quiz id 或錄製中的檔名。上傳前先確認 `quality.status=ready`，匯入預覽再核對題數、題幹、題型、選項、正解與解析。

這個流程最多做到未發布草稿並回報證據；不會自動發布、指派、Live、分享或擴大能見度。實際匯入成功、草稿 URL、題數與平台發布結果必須分開描述，不能以本地測試或看到 Publish 按鈕代替平台寫入證據。完整停止條件見 [`references/google-oauth-handoff.md`](references/google-oauth-handoff.md) 與 [`references/recorded-action-handoff.md`](references/recorded-action-handoff.md)。

## 舊資料、安全與維護

只有既有資料救援才用 `--legacy`：`node scripts/build-xlsx.mjs quiz.json out.xlsx --legacy`。它的 quality report 為 `legacy-unverified`，無來源、對象與藍圖驗證，不能當作一般交付。不要輸入學生可識別資料、平台帳密或 API key。

維護者需在平台範本有疑義時下載當日試算表範本，對照欄名、欄序、題型、選項、答案、秒數、圖片與解析欄，並用真人帳號匯入未發布草稿；未完成此流程，只能說程式結構測試通過。

## 疑難排解與驗證

| 現象 | 處理 |
|---|---|
| `assessment-quality-blocked` | 依 quality `blockers` 補 assessment 與題目追溯資料。 |
| skipped／flagged | 讀 readiness `perQuestion` 和 warnings，再修題型、選項、媒體或填空。 |
| 匯入預覽不同 | 以當日官方 template 重比對，先在草稿修正。 |

```bash
npm test
```

測試不會登入或寫入平台。壓力情境與預期行為見 [skill-evaluations.md](references/skill-evaluations.md)。

## CLI 控制與下一輪錄製

```bash
tw-edtech-wayground doctor
tw-edtech-wayground validate --input quiz.json
tw-edtech-wayground plan --action assessment.import --resource CANARY-assessment
```

請依序錄製教材庫盤點、Assessment／Presentation 匯入、編輯、發布、分享、Live、作業、班級同步、報告與刪除。每段使用 Canary 測試帳戶與一次性資源，完成後讀回名稱、題數、能見度與狀態；登入憑證、學生名單、成績、報告內容與分享 URL 不得進錄製。普通寫入需要 `--confirm-write`，高風險動作還要 `--confirm-plan` 與 `--confirm-impact`。

## 跨 Agent 安裝診斷

安裝前執行 `node scripts/portable-core/agent-doctor.mjs --agent codex`，其他 Agent 可替換為 `claude`、`antigravity`、`opencode` 或 `other`。診斷結果中的 unknown 需在實際 Agent 與平台確認；詳見 [跨 Agent 指引](references/portable-integration.md)。核心只提供診斷和路由建議，不會自動安裝、登入或執行平台操作。

### 專案範圍安裝

執行 `node scripts/portable-core/install.mjs --agent codex --project <專案目錄>` 預覽；確認結果後加 `--apply`，將完整 Skill 複製到該 Agent 專案技能目錄。已有同名 Skill 時停止，絕不覆蓋；需要同時安裝套件時加 `--with-deps`，使用 `npm ci --ignore-scripts`；完成後重新載入 Agent 並檢查技能發現。安裝器不修改 MCP 設定或登入。

使用 `tw-edtech-wayground runtime --inventory inventory.json` 將本次 Agent 發現的工具與替代能力送入 CLI，回報動作路由；此命令唯讀，不會替宿主呼叫 connector。工具可見不代表帳號權限已驗證。
