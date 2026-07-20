# Flow: publish assessment

- version: 1
- entry URL: 匯入後的 editor URL（import-xlsx.mjs 輸出的 `editorUrl`）
- precondition: agent 已在對話中與老師確認名稱/科目/年級/公開性
- declared steps:
  1. Click Publish（候選：「發布」）
  2. 填 name（`input[placeholder*=name|title]`）
  3. 可選：點 subject / grade / private 選項（找不到不視為失敗，留給老師）
  4. Click 確認（Save/Publish/Confirm/完成/發布/儲存）
- success evidence: URL 轉到 `admin/(quiz|assessment)|/library|/details`
- cleanup plan: 無法確認發布狀態＝外部寫入不明 → handoff，不重按
- fallback artifact: 編輯器內容已保留，老師可手動 Publish
- trace policy: 同 flow-import
- last-verified: PENDING
