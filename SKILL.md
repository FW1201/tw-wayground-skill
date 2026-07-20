---
name: tw-wayground-skill
description: Use when a teacher wants quiz content turned into a Wayground (formerly Quizizz) activity — 建立 Wayground 測驗、匯入試算表、發布、指派作業或開 Live、取得加入代碼/連結。Triggers include quiz.json, Wayground, Quizizz, 匯入題目, join code, 指派作業.
---

# tw-wayground-skill

把結構化測驗（quiz.json）轉成 Wayground 官方匯入試算表，並可用 Playwright 完成「匯入 → 發布 → 指派 → 回傳加入連結」整條鏈。

## 首次使用

```bash
cd <skill-dir> && npm install && npx playwright install chromium
```

只在 `node_modules/` 不存在時執行。

## 工作流程

1. **產生匯入檔（必經）**：
   ```bash
   node scripts/build-xlsx.mjs quiz.json out.xlsx
   ```
   輸出 JSON 含 `questionCount` 與 `warnings`（跳過的題型、被裁掉的選項）——**一定要把 warnings 轉述給老師**。
   ⚠️ 不要自己手刻轉換器或猜測範本格式：填空題多答案用 ` | ` 分隔、上限 5 選項、秒數只能是固定檔位，這些規則都已內建。
2. **登入（每個新環境一次）**：`node scripts/pw/login.mjs`（timeout 設 ≥360000ms）。可見視窗，老師自行登入/MFA；session 保存在 `~/.tw-edu-skills/wayground/profile/`。
3. **匯入**：`node scripts/pw/import-xlsx.mjs out.xlsx --expect-questions N`（N 用步驟 1 的 questionCount）。成功輸出的 `editorUrl` 供下一步使用。
4. **發布（外部寫入，先在對話中跟老師確認名稱/科目/年級/公開性）**：
   ```bash
   node scripts/pw/publish.mjs --editor-url <步驟3的editorUrl> --name "..." --subject 生物 --grade 國一 --visibility private
   ```
5. **指派（外部寫入，先確認模式與期限）**：
   ```bash
   node scripts/pw/assign.mjs --quiz-url <步驟4的quizUrl> --mode homework --deadline 2026-07-31
   ```
   `--deadline` 格式 `YYYY-MM-DD`（平台以老師帳號時區解讀）。成功輸出 `joinCode` 與 `shareUrl`——這是給學生的最終交付物。

## 規則

- 每支腳本輸出單行 JSON：`{ok:true,...}` 或 `{ok:false,error,hint}`。失敗就照 `hint` 做；同一支 pw 腳本**最多重試 1 次**，再失敗即交還老師。
- 出現 `handoff` 欄位＝自動化已安全停止：把 `resumeUrl` 給老師手動接續，並回報 `screenshot` 路徑。
- 發布與指派是外部寫入：**執行前必須在對話中取得老師明確確認參數**。
- 絕不輸出或讀取瀏覽器 cookies/profile 內容。
- 不支援的題型（matching/ordering/draw/word_cloud）會被跳過並列入 warnings——提醒老師可在 Wayground 編輯器手動補建。

## 常見錯誤

| 症狀 | 處理 |
|---|---|
| `not-logged-in` | 先跑 `scripts/pw/login.mjs` |
| `selector-failure` | Wayground 改版；交還 resumeUrl，回報以更新 `references/flow-*.md` |
| `question-count-mismatch` | 匯入題數異常；請老師在編輯器核對 |
| quiz.json 驗證失敗 | 對照 `scripts/lib/models.mjs` 的 Quiz schema 修正 |
