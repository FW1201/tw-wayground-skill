# Flow: assign homework / start live

- version: 3（2026-07-22 端到端 live 驗證後更新，原邏輯幾乎整個重寫）
- entry URL: 發布後的 quiz URL（publish.mjs 輸出的 `quizUrl`）
- precondition: agent 已在對話中與老師確認模式（homework/live）
- declared steps（真實驗證，跟原本假設完全不同）：
  1. 點「**現在開始**」（不是「Assign」——這個字完全不存在於介面中；另有一個「分配」按鈕，那個走的是「個別化調整」/差異化輔助設定流程，跟指派作業無關，不使用）
  2. 彈出「您想如何主持會議？」：「學生步調」(homework) / 「老師主導」(live) → URL 帶 `?selection=student-paced` 或 `teacher-led`
  3. 進入「選擇會話模式」：經典/佔領高峰(題數<10不可用)/操場/測驗模式/團隊模式 → 一律選「經典」（唯一保證可用的模式）
  4. 進入「作業詳情」設定頁（頁首仍顯示「Live」字樣）→ 點頁首「開始」
  5. 最終加入畫面：**網域是 joinmyquiz.com（不是 wayground.com/join！）+ 6 碼純數字代碼**（如 994244），另有 QR code
- success evidence: 頁面出現 6 碼數字代碼 + `joinmyquiz.com` 網域文字；輸出 joinCode + joinUrl
- cleanup plan: 指派可能已完成但抓不到 code → handoff 讓老師從畫面複製，不重按
- fallback artifact: 老師手動點「現在開始」（約 30 秒）
- trace policy: 同 flow-import
- **last-verified: 2026-07-22**（端到端實測成功，真實產生 joinmyquiz.com 代碼）
