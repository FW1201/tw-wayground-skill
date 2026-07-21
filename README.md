# tw-wayground-skill

> ⚠️ **非官方工具**：本套件**不是** Wayground／Quizizz 官方產品，也**非**其認可的整合。它以 Playwright 自動操作官方網頁 UI（因為 Wayground 無建立測驗的公開 API），受 Wayground 服務條款約束。請以**老師本人帳號**、由本人完成登入/MFA，操作自己的內容，風險自負。若 Wayground 日後提供官方 API，應優先改用官方路徑。

台灣 K-12 教師用的 Wayground（原 Quizizz）agent skill：一句話就能把結構化測驗 JSON 一路做到「產生官方匯入試算表 → 匯入 → 發布 → 指派作業（含真實期限）→ 回傳學生加入代碼」。

自 [edu-agent-kit](https://github.com/FW1201/edu-agent-kit) 的 Wayground adapter 獨立而來（來源 commit `a7eaa0f`）。

## 這套 skill 能做什麼

老師只要把測驗題目給 agent，agent 就能：
1. 產生 Wayground 官方格式的匯入試算表（`.xlsx`）。
2. 自動上傳匯入成新測驗（**檔案上傳全自動，不需人工拖曳**）。
3. 填 metadata 並發布。
4. 指派作業並設定**期限**，回傳 `joinmyquiz.com` + 加入代碼給學生。

中間只有**兩個**需要人的地方：**登入**（老師本人在視窗完成一次）、**發布/指派前的確認**（agent 會把要送出的內容摘要給老師點頭）。

## 快速上手（一鍵流程，推薦）

```bash
cd <skill-dir> && npm install && npx playwright install chromium   # 首次

node scripts/preflight.mjs                       # 先確認：裝好了嗎？登入了嗎？
node scripts/pw/login.mjs                        # 若未登入，老師本人在視窗登入一次
node scripts/run.mjs quiz.json --stage prepare   # build→匯入，回傳 editorUrl + 待確認摘要
# ⇧ agent 把摘要給老師確認名稱/科目/期限…
node scripts/run.mjs quiz.json --stage deliver \
  --editor-url <上一步的 editorUrl> --name "光合作用小測驗" \
  --mode homework --deadline 1星期                # 發布→指派，回傳 joinCode
```

## 自然指令範例（老師怎麼講，agent 就懂）

| 老師說 | 觸發 |
|---|---|
| 「把這 10 題做成 Wayground 測驗，**指派作業給我、期限一週**，回連結」 | `run.mjs … --mode homework --deadline 1星期` |
| 「這份小考現在就開始，學生用手機加入」 | `assign.mjs --mode live-game` |
| 「我要在課堂上主持這份測驗」 | `assign.mjs --mode live` |
| 「先幫我做好測驗、發布就好，先別指派」 | `run.mjs … --stage prepare` + `publish.mjs` |

## 功能總覽

| 腳本 | 用途 | 輸入 | 輸出 |
|---|---|---|---|
| `scripts/preflight.mjs` | 前置檢查（依賴/登入） | — | `{loggedIn}` |
| `scripts/run.mjs` | **一鍵串接器**（prepare/deliver 兩階段） | `quiz.json` | editorUrl / joinCode |
| `scripts/build-xlsx.mjs` | 產生官方匯入試算表 | `quiz.json` `out.xlsx` | 檔案路徑 + warnings |
| `scripts/pw/login.mjs` | 可見視窗登入（本人完成） | — | 登入狀態 |
| `scripts/pw/import-xlsx.mjs` | 自動匯入試算表到新測驗 | `<file.xlsx>` | editorUrl |
| `scripts/pw/publish.mjs` | 填 metadata 並發布 | `--editor-url --name …` | quizUrl |
| `scripts/pw/assign.mjs` | 指派：`homework`(含期限)/`live-game`/`live` | `--quiz-url --mode …` | joinCode + joinUrl |

指派模式說明：`--mode homework` 走真正的作業路徑（`/admin/quiz/homework/`），支援 `--deadline none｜1天｜1星期｜2週`、`--practice-mode practice｜accuracy｜test`，以及 `--anti-cheat`／`--no-leaderboard`／`--music`；`--mode live-game` 是「現在開始」的即時自主遊戲；`--mode live` 是老師主導的即時課堂。

## 自動化邊界（ToS 風險控管）

- 一律可見（headed）瀏覽器、老師本人帳號；登入/MFA/CAPTCHA 親自完成。
- 檔案上傳由程式自動完成（`setInputFiles`），只上傳老師自己的檔案。
- 發布與指派前，agent 必須在對話中取得老師明確確認。
- 選擇器或成功證據比對失敗 → 零重試、截圖、停止並交還人工（`resumeUrl`）。
- Cookies 只存本機 Chromium profile，不序列化、不輸出、不進 agent context。

## Playwright 流程狀態

各流程的入口 URL、步驟、成功證據記錄在 `references/flow-*.md`，已以真實帳號驗證者蓋有 `last-verified` 時戳。

## License

MIT
