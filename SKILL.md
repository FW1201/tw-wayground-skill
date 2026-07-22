---
name: tw-wayground-skill
description: Use when a teacher wants quiz content turned into a Wayground (formerly Quizizz) activity — 建立 Wayground 測驗、匯入試算表、發布、指派作業或開 Live、取得加入代碼/連結。Triggers include quiz.json, Wayground, Quizizz, 匯入題目, join code, 指派作業.
---

# tw-wayground-skill

把結構化測驗（quiz.json）轉成 Wayground 官方匯入試算表，並可用 Playwright 完成「匯入 → 發布 → 指派 → 回傳加入連結」整條鏈。

## 首次使用

```bash
cd <skill-dir> && npm install
npm run browser:start
npm run browser:status
```

只在 `node_modules/` 不存在時執行。

⚠️ **執行環境**：本 skill 透過 CDP 連接由使用者啟動的教育平台專用正常 Chrome。Google OAuth/MFA/CAPTCHA 必須由老師在 Skill detach 後親自完成；不得在 Playwright automated Chromium 登入。

## 一鍵流程（推薦）

先執行 `npm run browser:start`；第一次 login 會開登入頁後立即 handoff。老師登入後重跑 login/preflight，再用串接器執行：

```bash
node scripts/run.mjs quiz.json --stage prepare          # build→匯入，回傳 editorUrl + 待確認摘要
# 把摘要給老師確認名稱/科目/期限，確認後：
node scripts/run.mjs quiz.json --stage deliver --editor-url <editorUrl> --name "..." --mode homework --deadline 1星期
```

檔案上傳由 `setInputFiles` 全自動，**不需人工拖曳**。下方單支腳本用於需要細部控制時。

## 工作流程

1. **產生匯入檔（必經）**：
   ```bash
   node scripts/build-xlsx.mjs quiz.json out.xlsx
   ```
   輸出 JSON 含 `questionCount` 與 `warnings`（跳過的題型、被裁掉的選項）——**一定要把 warnings 轉述給老師**。
   ⚠️ 不要自己手刻轉換器或猜測範本格式：填空題多答案用 ` | ` 分隔、上限 5 選項、秒數只能是固定檔位，這些規則都已內建。
2. **登入（每個新環境一次）**：`npm run browser:start` → `node scripts/pw/login.mjs` → 老師在專用正常 Chrome 完成 OAuth/MFA → 重跑 login/preflight。Session 留在 `~/.tw-edu-skills/browser/chrome-profile/`。
3. **匯入**：`node scripts/pw/import-xlsx.mjs out.xlsx --expect-questions N`（N 用步驟 1 的 questionCount）。成功輸出的 `editorUrl` 供下一步使用。
4. **發布（外部寫入，先在對話中跟老師確認名稱/科目/年級/能見度）**：
   ```bash
   node scripts/pw/publish.mjs --editor-url <步驟3的editorUrl> --name "..." --subject 科學 --grade 7年級 --visibility restricted
   ```
   ⚠️ **科目清單只有 4 個籠統分類**（世界語言/數學/英語/科學），沒有「生物」等細分——老師要問過會自動對映最接近的「科學」。
   ⚠️ **年級是美式學制**（幼兒園/小學/一至十二年級），不是台灣學制——常用對應 7年級≈國一、8年級≈國二、9年級≈國三、10年級≈高一，請用這個列表跟老師確認再填。
   ⚠️ **能見度預設「公開可見」會把測驗和答案公開在 Wayground 資源庫**——除非老師明確要求公開，一律預設 `restricted`（受限制的）。
5. **指派（外部寫入，先確認模式與期限）**：
   ```bash
   node scripts/pw/assign.mjs --quiz-url <步驟4的quizUrl> --mode homework --deadline 1星期
   ```
   三種模式（2026-07-22 重新命名，消除舊命名誤導）：
   - `--mode homework`：**真正的作業路徑**，直接導到 `/admin/quiz/homework/<id>`，可設 `--deadline none｜1天｜1星期｜2週`（自訂日期請人工用「編輯截止日期」）、`--practice-mode practice｜accuracy｜test`，以及 `--anti-cheat`／`--no-leaderboard`／`--music`。按右上「分配」後回傳代碼。
   - `--mode live-game`：「現在開始」的即時自主遊戲（學生步調 → 經典），無期限。
   - `--mode live`：「現在開始」的老師主導即時課堂。
   成功輸出 `joinCode`（6–8 碼數字，可能含空格）與 `joinUrl`——**注意加入網域是 `joinmyquiz.com`，不是 wayground.com**，這是給學生的最終交付物。

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
| `cdp-unavailable` | 先跑 `npm run browser:start`，保持該正常 Chrome 開啟 |
| `oauth-browser-rejected` | 關閉舊 automated Chromium；在專用正常 Chrome 重新登入 |
| `selector-failure` | Wayground 改版；交還 resumeUrl，回報以更新 `references/flow-*.md` |
| `question-count-mismatch` | 匯入題數異常；請老師在編輯器核對 |
| quiz.json 驗證失敗 | 對照 `scripts/lib/models.mjs` 的 Quiz schema 修正 |
| `join-code-not-found` | 指派可能已完成；老師從畫面手動複製 joinmyquiz.com 代碼 |
