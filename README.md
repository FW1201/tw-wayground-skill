<p align="center"><img src="assets/logo.png" width="88" alt="Wayground logo"></p>

# tw-wayground-skill

> ⚠️ **非官方工具**：本套件**不是** Wayground／Quizizz 官方產品，也**非**其認可的整合。Wayground 沒有建立測驗的公開 API，本套件只產生老師可以直接上傳的官方匯入試算表，不做任何瀏覽器自動化或登入。

台灣 K-12 教師用的 Wayground（原 Quizizz）agent skill：一句話把結構化測驗 JSON 轉成 Wayground 官方匯入試算表 + 匯入就緒報告，老師拿著檔案自行到 wayground.com 匯入、發布、指派。

自 [edu-agent-kit](https://github.com/FW1201/edu-agent-kit) 的 Wayground adapter 獨立而來（來源 commit `a7eaa0f`）。

## 這套 skill 能做什麼

老師把測驗題目給 agent，agent 產生 Wayground 官方格式的匯入試算表（`.xlsx`），附上一份**匯入就緒報告**（每題 ready/skipped 狀態、media/長度/多空格等提醒），老師拿著檔案登入 Wayground 自行匯入、發布、指派。

## 快速上手

```bash
cd <skill-dir> && npm install                             # 首次
node scripts/build-xlsx.mjs quiz.json out.xlsx
```

## 自然指令範例

| 老師說 | 觸發 |
|---|---|
| 「把這 10 題轉成 Wayground 匯入試算表」 | `build-xlsx.mjs quiz.json out.xlsx` |
| 「這份試算表能直接匯入嗎？」 | 看 stdout 的 `warnings` + `readinessReportPath` |

## 功能總覽

| 腳本 | 用途 | 輸入 | 輸出 |
|---|---|---|---|
| `scripts/build-xlsx.mjs` | 產生官方匯入試算表 + 匯入就緒報告 | `quiz.json` `out.xlsx` | 檔案路徑 + warnings + readinessReportPath |

## 為什麼沒有瀏覽器自動化

這套 skill 原本用 Playwright 自動化登入＋匯入＋發布＋指派整條鏈。Google OAuth 會拒絕 Playwright 自動化的瀏覽器，之後改用連接使用者另外啟動的「正常 Chrome」（CDP）解決登入問題；但即便如此，**選擇器驅動的 UI 自動化本身仍然不穩定**。現在改成只產生最大程度符合 Wayground 官方匯入規範的檔案，平台 UI 的最後一哩路（匯入、發布、指派）交給老師，不再嘗試自動操作瀏覽器。

## License

MIT
