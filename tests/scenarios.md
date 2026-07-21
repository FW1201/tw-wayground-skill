# 測試情境（superpowers:writing-skills TDD）

## RED baseline（2026-07-21，無 skill）

情境：「這是 quiz.json，幫我做成 Wayground 測驗活動，發布後指派作業，把加入連結給我。」

觀察到的 baseline 失敗（general-purpose subagent，無 skill）：
1. 自己手刻 Python 轉換器，出現與官方模板不符的錯誤假設：
   - 誤以為填空題只能填一個標準答案（正確做法：` | ` 分隔多答案）
   - 超過 5 選項時自行「猜」要刪哪個選項（skill 版固定裁尾並列 warning）
2. 完全無法進行登入後動作（發布/指派/取 join code），只能給手動步驟。
3. 無 session 概念，每次都要老師從零登入。

→ skill 必須提供：可信的轉換器（含 warnings）、持久 session 登入、匯入/發布/指派自動化、join code 回傳。

## GREEN 驗證情境（安裝 skill 後）

S1（觸發＋轉換）：「這是 quiz.json，幫我做成 Wayground 測驗。」
- 期望：觸發 skill → install-if-needed → 跑 build-xlsx.mjs → 轉述 warnings（matching 題被跳過等）→ 詢問是否要自動匯入。

S2（完整鏈）：「幫我匯入、發布並指派作業，期限 7/31。」
- 期望：先跟老師確認發布參數（名稱/科目/年級/公開性）與指派參數，才依序跑 pw 腳本；成功回報 joinCode/shareUrl；失敗時轉述 hint/resumeUrl，不盲目重試。

S3（負向）：給壞 JSON / 未登入。
- 期望：轉述 `hint`（如「請先執行 login.mjs」），不出現 stack trace，不外洩任何憑證。

## GREEN 結果（2026-07-21）

- S1：PASS —— subagent 依 SKILL.md 跑 build-xlsx.mjs、完整轉述 warnings、主動核對 xlsx 內容、在正確節點停下確認。
- S3：PASS —— 壞 JSON 得到 schema hint 並轉譯成老師聽得懂的說明，無 stack trace、無憑證外洩。
- S2：pw 腳本需真實帳號，列入 live 驗證清單（見 flow-*.md 的 last-verified: PENDING）。

## REFACTOR（依 GREEN 回饋修補，2026-07-21）

1. build-xlsx.mjs 補上 time-snap warning（25s→20s 不再靜默）。
2. SKILL.md 明寫 `--editor-url` 來自 import-xlsx 輸出、`--quiz-url` 來自 publish 輸出。
3. 「最多重試 1 次」語意明確化；`--deadline` 格式註明 YYYY-MM-DD。
4. 觸發測試（description 是否吸引 agent 自主載入）需在全新 session 驗證——本 session skill 清單為啟動時快照，無法測。

## 端到端 live 驗證（2026-07-22，真實帳號完整跑過 import→publish→assign）

用 claude-in-chrome 導覽已登入分頁 + 使用者手動拖曳測試 xlsx，逐步驗證整條鏈，發現並修正多個實際 bug（非測試環境限制，是真正的程式錯誤）：

1. **build-xlsx.mjs 兩個真實 bug**：
   - Fill-in-the-Blank 型別字串少了連字號（"Fill in the Blank" vs 官方要求的 "Fill-in-the-Blank"），導致整題被 Wayground 靜默退回 Multiple Choice 並因選項空白報錯。
   - 填空題答案原本寫入「正確答案」欄位，但 Wayground 匯入格式要求寫入「選項1」（必填，除 open-ended/draw 外所有題型皆必填）。
   兩者都已修正並用真實上傳重新驗證：0 錯誤，「看起來不錯！」。
2. **assign.mjs 整個流程重寫**：原本假設的「Assign 按鈕→homework/live→join code 格式 wayground.com/join?gc=」全部不存在。真實流程：現在開始→學生步調/老師主導→經典→開始，join code 是 `joinmyquiz.com` + 6碼純數字。
3. **publish.mjs 大幅修正**：metadata 對話框欄位皆為自訂下拉；科目只有 4 個籠統分類無「生物」；年級是美式學制；能見度預設「公開可見」（隱私風險，已改預設 restricted）。

修正後用同一測試檔完整跑一次 import→publish→assign 全部成功，拿到真實 `joinCode: 994244`、`joinUrl: https://joinmyquiz.com`。

**測試遺留物**：帳號上建立了「光合作用小測驗」（受限制可見）+ 一次 student-paced 指派，未清理，需使用者自行決定。
