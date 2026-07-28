# Google OAuth 動作銜接：Wayground

## 目的

讓 Google 能辨識這是使用者在正常 Chrome 中的登入，而不是由自動化瀏覽器代登入。這是一次性的人工前置作業；Skill 不保存密碼、Cookie、session 或 OAuth token。

## 前置流程

1. 開啟教師平常使用的正常 Chrome 個人檔案，不使用自動化新瀏覽器、嵌入式 WebView、無頭模式或 Incognito。
2. 教師手動進入 Wayground，完成 Google Email、密碼、MFA／CAPTCHA 與任何同意畫面。
3. 登入後確認 Wayground 顯示帳戶入口或「登出」狀態，而不是「登陸註冊」；不要只以 URL 判定已登入。
4. 將已登入的正常 Chrome 工作階段交給本機瀏覽器控制層（例如 localhost CDP）；控制層只操作 Wayground，不操作 Google 登入表單。
5. 開始匯入前記錄唯讀前置證據：Wayground URL、帳戶已登入狀態、輸入 XLSX 的絕對路徑，以及 `quality.status`／readiness 檢查結果。

## 正常 Chrome 帳戶提示分支

如果重新讀取後是 Wayground 公開首頁，且頁面仍顯示「登入／註冊」：

1. 在正常 Chrome 點擊 Wayground 的「登入」，不要改用自動化瀏覽器或嵌入式登入頁。
2. 如果 Chrome 顯示原生提示 `Sign in to wayground.com with google.com`，由教師確認並選取正確的 Google 帳戶；工具不替教師選帳戶，也不讀取或輸入帳戶地址。
3. 若接著出現 Google 密碼、MFA／CAPTCHA 或安全確認，由教師完成；工具只等待，不輸入憑證。
4. 回到 Wayground 後重新讀取頁面。成功條件是 URL 到達 `/admin` 或 `/admin?tab=create`，且頁面有帳戶入口／頭像、沒有「登入／註冊」；否則回報登入尚未成立並停止。

這個分支是「正常 Chrome 已完成人工登入後再接管」，不是自動化繞過 Google 風控的登入方法。

## 失敗處理

- 若出現 `This browser or app may not be secure`、`signin/rejected`、Google 登入頁或嵌入式登入視窗，立即停止控制層，不再輸入任何憑證。
- 請教師切換回平常的正常 Chrome，確認 JavaScript 開啟、Chrome 已更新，必要時暫時停用不受信任的擴充功能，再手動重試。
- 正常 Chrome 仍失敗時，停止並交由教師處理帳戶、網路代理、企業安全軟體或 Google 支援；不得用繞過風控的方式繼續。
- 登入過期時重新走人工前置流程；不要從事件錄製、日誌、URL 或檔案保存登入資料。

## 與 Wayground 流程的界線

Google OAuth 成功只代表登入工作階段成立，不代表 XLSX 已匯入、草稿已建立、測驗已發布或已指派。每一個外部寫入都要依使用者當次授權與 Wayground 頁面讀回證據確認。
