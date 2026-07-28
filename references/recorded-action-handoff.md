# Record & Replay 動作銜接：Wayground

登入前先讀 [google-oauth-handoff.md](google-oauth-handoff.md)；本文件只描述已登入後的 Wayground UI 動作。

## 可重用流程

這次錄製確認了以下穩定的語意流程：

1. 在真人已登入的正常 Chrome 中進入 Wayground 的建立評估頁。
2. 選「匯入工作表／問題」，再選「試算表」。
3. 選「從電腦上傳」，使用檔案選擇器選取教師指定的 `out.xlsx`。
4. 按「繼續」，確認匯入題目的題數、題型、題幹、選項與正解。
5. 進入未發布的評估編輯器，核對標題與教師 brief 的 metadata。
6. 在發布控制前停止，回報草稿 URL／題數／核對結果，等待教師後續決定。

## 簡報教材分支

目前頁面另有獨立的文件上傳入口：`/admin` → `上傳` → `裝置`（或 Google 雲端硬碟）。頁面說明為轉換文件進入互動資源，顯示上限 50 MB、最多 100 頁；可處理簡報教材，也可貼網站／YouTube 連結。選取檔案後選「投影片」→「下一個」→選教學目標→「Create resource」。這不是「匯入工作表／問題」的 XLSX 分支；成功證據是進入 `/presentation/<id>/edit` 並回讀投影片數，檔案選擇器的 `No file chosen` 不算成功。

2026-07-28 實測成功：`CANARY-20260728-water-cycle.pptx` → `Presentation` → `已選擇 15 slides` → `Create resource`，回讀編輯器 `/presentation/6a681d45b9b859b2c15d6099/edit`，可看到 1–15 張投影片、預覽與發布控制；流程停在發布前。

錄製證據顯示瀏覽器曾到達 `/admin/assessment` 與 `/admin/quiz/<quiz-id>/edit`，並看見「試算表」「繼續」、題數摘要及標題／科目／年級／語言／能見度欄位。`<quiz-id>`、檔案名稱、題數與 metadata 都是每次輸入，不能寫死。

## 安全與停止條件

- 未收到錄製前，Skill 僅產生經 quality/readiness 檢查的 XLSX，不能猜測 Create、Assessment、Spreadsheet 匯入或登入介面。
- 每次匯入前確認 `quality.status=ready`，並逐一閱讀 `quality.warnings`、`readiness.perQuestion` 與 `readiness.warnings`；教師未接受風險時停止。
- 若匯入預覽、欄位或題數與報告不符，停止並交由教師判斷，不要替平台內容猜答案或修正。
- Publish、Assign、Live、分享、能見度擴大與學生資料操作一律排除；不能把錄製觸及發布按鈕當作發布成功。
- 不保存登入憑證、Cookie、學生資料、API key 或錄製中的私人檔案路徑；以使用者提供的檔案輸入取代固定路徑。
- 使用語意化按鈕、分頁與檔案名稱；不要依賴座標、DOM id、私人 quiz id 或短期 UI 文案以外的脆弱細節。
