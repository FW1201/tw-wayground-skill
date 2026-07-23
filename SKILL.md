---
name: tw-wayground-skill
description: Use when a teacher needs a source-traceable, audience-aligned Wayground spreadsheet import file, or needs to assess whether quiz JSON is ready for Wayground import.
---

# Wayground 測驗匯入

將已審核的測驗 JSON 轉為 Wayground（原 Quizizz）`.xlsx` 匯入檔。**先有來源、受測者、目標和命題藍圖，再產檔；匯入格式通過不代表題目教學品質已由系統判定。**

## 必要工作流

1. 蒐集並確認 assessment brief；缺來源、受測者、目標或藍圖時，停止產題與產檔。
2. 依下列契約建立 `quiz.json`，使每題可回查教材與學習目標。
3. 執行 `node scripts/build-xlsx.mjs quiz.json out.xlsx`。
4. 先讀 `out.quality.json`；僅 `status: "ready"` 可交付。檢查 blockers、warnings、逐題追溯與 blueprint。
5. 再讀 `out.readiness.json` 及 stdout warnings，處理平台題型、圖片、長度、選項與空格的匯入風險。
6. 教師自行匯入未發布草稿、預覽並設定能見度；不可聲稱已自動發布或指派。

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

## 例外與限制

`--legacy` 會輸出 `legacy-unverified` quality report，不能作為命題品質證明。此工具不含 API、登入、瀏覽器自動化、發布或指派。

## 常見錯誤

| 症狀 | 處理 |
|---|---|
| `assessment-quality-blocked` | 補 assessment v1、題目追溯欄位與藍圖；不要把 legacy 當修正。 |
| skipped／flagged | 先讀 readiness 的 `perQuestion` 和 warnings，再修正題型、選項、媒體或空格。 |
| `explanation-missing` | 補教師複核與回饋用的解析；quality report 不會驗證學科真偽。 |
