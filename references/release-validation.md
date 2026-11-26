# 候選版驗證紀錄（2026-11-26）

- 本專案 `npm test`：37 項通過；`npm audit`：0 已知弱點（以當次資料庫為準）。技能 metadata 驗證通過。
- 在隔離專案測試四種 Agent 安裝目錄；Codex 與 OpenCode 測過 Padlet 技能讀取，不能推論本專案在各 Agent 的自然觸發已通過。Claude Code 當次登入失效；Antigravity 與 Grok Bot 未完成載入驗證。
- Runtime 路由需要宿主提供實際工具能力，不代表 CLI 能自動呼叫 Codex connector。登入、權限、方案和可用工具需在每次平台動作前查驗。
- 平台功能與測試範圍見 [模式說明](platform-modes.md)。未實測的學生端、公開分享、裝置與平台模式均未驗證。
- 升級前備份既有安裝；本版為 release candidate，保留原有入口與限制。

- 2026-11-26 加強轉換忠實度與錯誤答案防護，詳見模式說明；原有測試與新增防錯測試通過，未因此宣稱平台實際匯入已通過。
