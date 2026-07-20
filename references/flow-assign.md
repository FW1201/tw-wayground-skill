# Flow: assign homework / start live

- version: 1
- entry URL: 發布後的 quiz URL（publish.mjs 輸出的 `quizUrl`）
- precondition: agent 已在對話中與老師確認模式（homework/live）與期限
- declared steps:
  - homework: Click Assign → 可選填 deadline（`input[type=date]`）→ Click 確認
  - live: Click Start live/Host → 可選 Continue/Start
- success evidence: 頁面出現 `wayground.com/join?gc=NNNNNN`（或 quizizz 網域）或 game-code 元素；輸出 joinCode + shareUrl
- cleanup plan: 指派可能已完成但抓不到 code → handoff 讓老師從畫面複製，不重按 Assign
- fallback artifact: 老師手動 Assign（約 30 秒）
- trace policy: 同 flow-import
- last-verified: PENDING
