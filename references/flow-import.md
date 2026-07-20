# Flow: import spreadsheet

- version: 1
- entry URL: https://wayground.com/admin
- login detector: URL matches `(wayground|quizizz).com/(admin|dashboard)`
- declared steps:
  1. Click Create（候選：button/link "Create"、文字「建立」）
  2. Click Assessment/Quiz
  3. Click "Import from spreadsheet"（候選含「試算表」「Import」）
  4. `setInputFiles` 到 `input[type=file]`
- success evidence: 題目預覽/編輯器出現（`[class*=question]`），可選 `--expect-questions N` 核對題數
- cleanup plan: 失敗時不留半成品——匯入未完成即停止，未建立任何已發布內容
- fallback artifact: build-xlsx.mjs 產生的 .xlsx（老師可手動 Import）
- trace policy: 失敗只留本機截圖於 `~/.tw-edu-skills/wayground/diagnostics/`
- last-verified: PENDING（尚未以真實帳號驗證；驗證後更新選擇器與時戳）
