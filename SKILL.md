---
name: tw-wayground-skill
description: Use when a teacher wants quiz content turned into a Wayground (formerly Quizizz) import-ready spreadsheet — 產生 Wayground 官方匯入試算表、匯入就緒報告。Triggers include quiz.json, Wayground, Quizizz, 匯入題目, 匯入試算表.
---

# tw-wayground-skill

把結構化測驗（quiz.json）轉成 Wayground 官方匯入試算表，並附上匯入就緒報告，老師拿著檔案自行到 wayground.com 匯入、發布、指派。

## 首次使用

```bash
cd <skill-dir> && npm install
```

只在 `node_modules/` 不存在時執行。

## 工作流程

1. **產生匯入檔（唯一步驟）**：
   ```bash
   node scripts/build-xlsx.mjs quiz.json out.xlsx
   ```
   輸出 JSON 含 `questionCount`、`warnings`、`readinessReportPath`（指向與 xlsx 同目錄的 `out.readiness.json`）。**warnings 一定要完整轉述給老師**，包含：跳過的題型、超過 5 選項被裁掉、時間被 snap 到官方檔位、非圖片媒體無法匯入、題幹/選項過長可能被截斷、填空題含多個空格標記。
   ⚠️ 不要自己手刻轉換器或猜測範本格式：填空題答案寫入 Option 1..5（不是 Correct Answer 欄）、上限 5 選項、秒數只能是固定檔位，這些規則都已內建且經真實上傳驗證。
   `readiness.json` 的 `perQuestion` 陣列列出每題的 ready/skipped 狀態與原因——上傳前建議老師先看過這份報告，取代原本「先匯入再看預覽」的步驟。

2. **上傳後，請老師在 Wayground 官網做的事**：登入 wayground.com → Create → 評估 → 匯入工作表/問題 → **切到「試算表」分頁**（預設「檔案文件」分頁不吃 xlsx）→ 上傳剛產生的 xlsx → 對照 warnings 核對跳過/截斷的題目 → 自行填 metadata（科目/年級/能見度，⚠️ 能見度預設「公開可見」會把測驗和答案公開，請確認）→ 發布 → 指派作業或開 Live。

## 規則

- 每支腳本輸出單行 JSON：`{ok:true,...}` 或 `{ok:false,error,hint}`。
- `warnings` 一定完整轉述；不支援的題型（matching/ordering/draw/word_cloud，官方匯入範本沒有對應欄位）一定要點名，提醒老師可在 Wayground 編輯器手動補建。
- 這裡沒有任何瀏覽器/登入自動化——本 skill 只產生檔案，見下方「為什麼沒有瀏覽器自動化」。

## 常見錯誤

| 症狀 | 處理 |
|---|---|
| quiz.json 驗證失敗 | 對照 `scripts/lib/models.mjs` 的 Quiz schema 修正 |
| `No questions could be mapped` | 所有題目型別都不被支援；檢查 quiz.json 的 `type` 欄位 |
