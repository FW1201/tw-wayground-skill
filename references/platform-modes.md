# Wayground 模式與執行

- Assessment／Flashcards：當前 Codex connector 可建立選擇題與閃卡，依當前工具 schema 檢查年級、科目、選項與正解；返回編輯連結不是題目讀回證據。2026-11-26 實測 connector 產生的私人測驗在瀏覽器「共用帳號」顯示需要存取權限；需核對 connector 與瀏覽器是否為相同帳號，不能申請權限或改公開來掩蓋不一致。
- Presentation：以教師登入的介面建立，Google Slides 可同步、PDF 匯入為靜態頁；逐頁檢查版面、順序、互動題與對應教材。connector 測驗工具不提供 Presentation 建立。
- Playground：使用課堂既有登入介面查可用遊戲、主持條件與設定，設計學生操作、目標與回饋；沒有可用主持介面時明確回報未驗證。
- Paper Mode：先檢查題型與紙卡、教師掃描設備；不要以螢幕端成功推論紙卡流程通過。

官方來源：https://help.wayground.com/support/solutions/articles/158000405007-create-a-presentation-formerly-lesson- 、https://help.wayground.com/support/solutions/articles/158000451315-about-playground-live-classroom-games-on-wayground （2026-11-26）；本次 connector 產生 quiz 連結，尚未讀回。

## 2026-11-26 現有帳號介面觀察

桌面視窗可建立 Presentation：封面加一張選擇題，草稿重新載入後讀回兩頁、題目、4 和 3，4 有綠色正解標記。資源庫清單顯示 0 幻燈片，與編輯器實際兩頁不一致，應以重新進入編輯器的逐頁讀回為準，不假設列表計數正確。草稿未發布，預覽不等於現場參與者實測。

Playground 從資源庫選現有測驗後顯示 WayArena、拔河、密碼破解者、Board Battle 與 Peak Rush；可設遊戲時長、每輪題目與答案顯示。實測僅到模式選擇及設定，未啟動或學生試玩。

轉換保護：是非題保留原選項並轉為 Multiple Choice；超過五個選項、超過五個可接受答案或單題多個填空會跳過，避免靜默遺失；部分輸出回傳 partial、exit code 2，匯入前須查閱 readiness 報告。來源和目標 ID 已保留在逐題報告。

## 2026-11-26 試算表匯入實測

以七年級自編方程式 3 題 JSON，使用已安裝版本產生 XLSX；既有瀏覽器帳號從「新增資源 → 評估 → 使用模板」上傳，進入編輯器顯示 3 題。重新載入後逐題讀回選項、正解 4、3、7、30 秒及答案解析，均與來源一致。草稿網址：https://wayground.com/activity/admin/quiz/6b07f84fa3513b595d68366f/edit 。尚未發布，分享權限、跨帳號及學生端未驗證。此結果只證明三題單選的這次匯入，不代表其他題型、圖片或所有格式均已驗證。
