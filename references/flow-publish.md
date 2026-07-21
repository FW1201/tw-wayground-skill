# Flow: publish assessment

- version: 3（2026-07-22 端到端 live 驗證後更新）
- entry URL: 匯入後的 editor URL（import-xlsx.mjs 輸出的 `editorUrl`，形如 `/admin/quiz/<id>/edit`）
- precondition: agent 已在對話中與老師確認名稱/科目/年級/能見度
- declared steps（真實驗證）：
  1. 點編輯器右上角「發布」（粉紅按鈕）→ 直接彈出「太棒了，你快完成了」metadata 對話框（沒有中介步驟）
  2. 姓名欄位：純文字 input，無 placeholder，有字元計數（如 7/64）
  3. 科目/年級/語言/能見度：皆為自訂下拉選單，需點開再點選項文字
  4. ⚠️ **科目清單只有 4 個籠統分類**：世界語言/數學/英語/科學——沒有「生物」等細分科目，需對映到最接近的「科學」
  5. ⚠️ **年級是美式學制**（幼兒園/小學/一至十二年級），非台灣「國小/國中/高中」——常用對應：7年級≈國一、8年級≈國二、9年級≈國三
  6. ⚠️ **能見度預設「公開可見」**（此資源將在評估庫中公開顯示，含答案）！三選項：公開可見/受限制的/我組織中的每個人。腳本預設改為「受限制的」，除非老師明確要求公開
  7. 對話框內再點一次「發布」確認
- success evidence: URL 轉為 `/admin/quiz/<id>`（不含 `/edit`）；輸出 quizUrl
- cleanup plan: 無法確認發布狀態＝外部寫入不明 → handoff，不重按
- fallback artifact: 編輯器內容已保留，老師可手動 Publish
- trace policy: 失敗截圖存 `~/.tw-edu-skills/wayground/diagnostics/`
- **last-verified: 2026-07-22**（端到端實測成功，含姓名/科目/年級/能見度全部欄位）
