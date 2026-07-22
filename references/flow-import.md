# Flow: import spreadsheet

- version: 2（2026-07-22 live 驗證後更新）
- entry URL: https://wayground.com/admin
- login detector: URL matches `(wayground|quizizz).com/(admin|dashboard)`
- declared steps（真實驗證，zh-TW 帳號）：
  1. 點「建立」（文字完全比對，非按鈕角色）
  2. 選單裡點「評估」（不是 Assessment/Quiz 字面）→ URL 轉為 `/admin/assessment`
  3. 「建立一個新活動」畫面三選項卡片，點「匯入工作表/問題」
  4. **關鍵**：預設開啟的「檔案文件」分頁**不支援 xlsx**（僅 PDF/PPT/PPTX/DOC/DOCX/PNG/JPG/Canvas QTI.zip）——必須切到頂部「試算表」分頁，該分頁才有 xlsx 上傳區與官方「下載模板」按鈕
  5. `setInputFiles` 到 `input[type=file]`
- success evidence: 題目預覽/編輯器出現（`[class*=question]`），可選 `--expect-questions N` 核對題數
- cleanup plan: 失敗時不留半成品——匯入未完成即停止，未建立任何已發布內容
- fallback artifact: build-xlsx.mjs 產生的 .xlsx（老師可手動走「試算表」分頁上傳）
- trace policy: 失敗只留本機截圖於 `~/.tw-edu-skills/wayground/diagnostics/`
- **last-verified: 2026-07-22（步驟 1-4 已用真實帳號驗證；步驟 5 上傳後的預覽畫面因測試環境無法上傳檔案而未實測，仍視為 provisional）**
- capability-status: provisional（spreadsheet tab switching verified；XLSX preview-count live evidence pending）
- 附帶發現：官方範本比原移植版多一欄「Answer explanation」，已同步修正 `build-xlsx.mjs`（見該檔案標頭註記）
