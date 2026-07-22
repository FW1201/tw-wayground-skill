# 測試情境（產生器正確性——2026-07-23 大型縮減後改寫）

本文件原本記錄 Playwright 瀏覽器自動化的 RED/GREEN/REFACTOR TDD 過程（登入、匯入、發布、指派）。該自動化層已整個移除（見 README「為什麼沒有瀏覽器自動化」），歷史脈絡保留在 git log，不在此重述——包含當時真實揪出的兩個 xlsx 邏輯 bug（Fill-in-the-Blank 型別字串連字號、填空題答案欄位錯置），這兩個修正邏輯本身仍保留在 `build-xlsx.mjs` 中並持續生效。

現在 `build-xlsx.mjs` 是唯一產品面，測試情境改為關注**產生器對官方規範的正確性**，可執行測試見 `tests/build-xlsx.test.mjs`（`npm test` 執行，node:test + node:assert，無需瀏覽器/帳號）。

## 涵蓋情境

1. **正常題目**：全部題型合法時，`questionCount` 與題目數相符，`warnings` 為空陣列，`readiness.json` 的 `skippedQuestions` 為 0。
2. **不支援題型**：matching/ordering/draw/word_cloud 被跳過且有明確 `reason`（官方匯入範本本身沒有對應欄位，是硬限制，不是可補的缺口）。
3. **非圖片媒體**（本輪新增）：`media.kind !== "image"` 時要有明確警告，不可靜默丟棄。
4. **長文字截斷提醒**（本輪新增）：題幹/選項超過 `LONG_TEXT_WARN_CHARS`（500 字，屬保守經驗值，非官方文件記載的硬限制）時要警告「可能被截斷」。
5. **多空格填空題**（本輪新增）：`fill_blank` 題幹含超過一個 `___`/`[blank]` 標記時要警告「Wayground 單列 xlsx 格式無法表示多個空格」；只有一個標記時不應誤報。
6. **匯入就緒報告**：`readinessReportPath` 指向的 JSON 要包含每題的 ready/skipped 狀態、原因、備註，這是取代「先匯入再看預覽」的新安全網。

## 何時要補測試

`build-xlsx.mjs` 的 `mapQuestion` 新增任何警告條件時，`build-xlsx.test.mjs` 至少要補一組「觸發該警告」與「未觸發時不誤報」的測試，確保新規則不會在無關題目上誤報。
