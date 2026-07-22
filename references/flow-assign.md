# Flow: assign homework (with deadline) / live-game / live

- version: 4（2026-07-22 加入真正的 homework 期限路徑；三種模式明確化）
- entry URL: 發布後的 quiz URL（publish.mjs 輸出的 `quizUrl`）
- precondition: agent 已在對話中與老師確認模式與期限

## `--mode homework`（真正的作業路徑，含期限）— live 驗證

- entry: 由 quizUrl 直接推導 `/admin/quiz/<id>` → `/admin/quiz/homework/<id>`（比點「分配」按鈕更穩）
- declared steps：
  1. 導到 `/admin/quiz/homework/<id>`
  2. 選擇模式卡片：**練習 / 答對率 / 測試**（getByText，預設「練習」）
  3. 結束於 期限快選：**沒有最後期限 / 1天 / 1星期 / 2週**（注意是「1星期」「2週」，不是「1週」；預設 1星期）
  4. （選用）四分頁設定：一般的／精通／**反作弊**（反作弊監控/禁用右鍵單擊/停用複製貼上）／**遊戲化**（排行榜/通電/播放音樂/顯示梗圖），預設全不動
  5. 點右上角粉紅「**分配**」按鈕（`getByRole button name /^分配$/`，唯一；左上「分配」是麵包屑標題非按鈕）
- success evidence: 導到 `/admin/activity/classic/<id>`，出現 `joinmyquiz.com` + **6–8 碼數字代碼**（實測 homework 為 8 碼，如「0657 2521」，含空格需去空白）
- **last-verified: 2026-07-22**（端到端實測成功，真實產生代碼 0657 2521）
- capability-status: homework=verified（external-write evidence）；重試採 ambiguous handoff，不重複分配

## `--mode live-game`（「現在開始」即時自主遊戲，無期限）— live 驗證

- declared steps：現在開始 → 學生步調 → 經典（題數<10 其餘模式會鎖）→ 頁首「開始」
- success evidence: `/admin/activity/classic/`＋joinmyquiz.com 6 碼代碼（實測 994244）
- **last-verified: 2026-07-22**
- capability-status: live-game=verified（external-write evidence）

## `--mode live`（「現在開始」老師主導即時課堂）

- declared steps：現在開始 → 老師主導 → 經典 → 開始
- last-verified: 2026-07-22（同 live-game 機制，老師主導分支）
- capability-status: live=verified（external-write evidence）

## 共通

- cleanup plan: 指派可能已完成但抓不到 code → handoff 讓老師從畫面複製，不重按
- fallback artifact: 老師手動操作對應路徑
- trace policy: 同 flow-import
