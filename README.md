<p align="center"><img src="assets/logo.png" width="88" alt="Wayground logo"></p>

# tw-wayground-skill 使用手冊

非官方、離線的 Wayground（原 Quizizz）試算表產生器。它將已審核的測驗 JSON 轉成 `.xlsx`、`.quality.json`、`.readiness.json`；不登入、不匯入、不發布、不指派，也不以格式檢查取代教師的學科審題。

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
