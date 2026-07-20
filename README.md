# tw-wayground-skill

台灣 K-12 教師用的 Wayground（原 Quizizz）agent skill：把結構化測驗 JSON 轉成官方匯入試算表，並以 Playwright 輔助完成「匯入 → 發布 → 指派作業 → 取得加入代碼」。

自 [edu-agent-kit](https://github.com/FW1201/edu-agent-kit) 的 Wayground adapter 獨立而來（來源 commit `a7eaa0f`）。

## 安裝

```bash
npx skills add FW1201/tw-wayground-skill
# 或手動 clone 後 symlink 至 ~/.codex/skills/
cd <skill-dir> && npm install && npx playwright install chromium
```

## 腳本

| 腳本 | 功能 |
|---|---|
| `scripts/build-xlsx.mjs <quiz.json> <out.xlsx>` | 產生 Wayground 官方匯入試算表（含 warnings） |
| `scripts/pw/login.mjs` | 可見視窗登入（使用者本人完成，session 保存於 `~/.tw-edu-skills/wayground/profile/`） |
| `scripts/pw/import-xlsx.mjs <file.xlsx>` | 自動匯入試算表到新測驗 |
| `scripts/pw/publish.mjs` | 填 metadata 並發布 |
| `scripts/pw/assign.mjs` | 指派作業/開 Live，回傳 join code 與連結 |

## 自動化邊界（ToS 風險控管）

- 一律可見（headed）瀏覽器、使用者本人帳號；登入/MFA/CAPTCHA 由使用者親自完成。
- 只上傳使用者自己的檔案、操作使用者自己的內容；不繞過方案限制/付費牆/速率限制。
- 發布與指派前，agent 必須在對話中取得老師明確確認。
- 選擇器或成功證據比對失敗 → 零重試、截圖、停止並交還人工（`resumeUrl`）。
- Cookies 只存在本機 Chromium profile，不序列化、不輸出、不進 agent context。
- Wayground 若日後提供官方 API，一律優先官方路徑。

## Playwright 流程狀態

各流程的入口 URL、步驟、成功證據記錄在 `references/flow-*.md`，需以真實帳號驗證後蓋 `last-verified` 時戳。**尚未驗證的流程視為 provisional**：失敗時會安全停止，不會亂點。

## License

MIT
