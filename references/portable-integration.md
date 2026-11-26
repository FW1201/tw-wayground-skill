# 跨 Agent 診斷與平台模式

執行 `node scripts/portable-core/agent-doctor.mjs --agent <codex|claude|antigravity|opencode|other>`。先處理 Node 18+ 與各專案 `npm ci`。診斷採唯讀方式，不發網路請求，不安裝套件，不會驗證 key、平台方案、登入、connector 或 MCP；其狀態為 unknown 時，請在正在運行的 Agent 中查詢可用工具與相應文件。專案 scope 安裝路徑及官方文件由診斷輸出；先檢查目標 Agent 的現行文件，將完整 skill 資料夾放入適用目錄，重新啟動或重新載入，再測試手動及新對話觸發。

Agent 提供 connector/MCP 時，根據本次任務檢查動作、參數、使用者帳戶和平台權限。官方 API、既有 CLI、Computer Use、人工匯入是依實際可用性選擇的替代路徑。`router.mjs` 只選擇明確標記 available 且 action 相符的路徑；呼叫端必須先取得實際能力證據，它不會自行偵測或呼叫工具。

區分測驗、閃卡、Presentation、Paper Mode 與 Playground；connector 測驗或閃卡可用，不代表可建立 Presentation 或主持 Playground。逐頁核對簡報與互動題。

完成狀態必須有平台讀回證據；生成中、超時、部分成功或狀態不明不能報為完成。只在使用者授權範圍內進行寫入，勿將憑證或學生資料放入日誌。

## 相容性狀態

四種 Agent 的自動觸發及外部平台端到端測試均待驗證。此指引與核心的存在不代表已在任何 Agent 安裝成功。

## Connector 執行契約

`connector-adapter.mjs` 提供 `resolveTool(action, toolNames)` 與 `executeConnector({action,input,toolNames,invoke})`。宿主必須注入本次實際發現的工具名稱和呼叫函式；Node 腳本本身不能存取 Codex 的工具物件。對應 Padlet 白板、貼文、Arcade 及 Wayground 測驗／閃卡；若宿主無注入能力，Agent 應依動作對應直接呼叫其可見 connector，不能假裝腳本已呼叫。

執行結果 `submitted` 僅表示已收到明確成功訊號或 Wayground 文件定義的資源連結，需平台讀回才能視為完成；無法判讀的回應或呼叫逾時返回 `unknown`，先查目標而非重送。不同環境的 tool inventory、登入與授權需於每次執行重新檢查。

### 當前 Agent 工具盤點

由正在執行的 Agent 讀取其實際工具清單，將無憑證的名稱與平台、動作組成 JSON，如 `{"platform":"padlet","action":"padlet.board.create","tools":["mcp__codex_apps__padlet_create_padlet"],"browser":"unknown","api":"unknown","cli":"unknown","manual":"available"}`，再執行 `node scripts/portable-core/diagnose-runtime.mjs inventory.json`。不得把登入資訊或帳號資料放入 inventory。工具被發現後，必須讀取當前 schema、核對連接器與瀏覽器帳號，並在本次操作後讀回。

部分欄位／貼文未套用時回傳 `partial`；等待審核的貼文需提醒尚不可見。工具回應的連結或成功旗標不等於平台內容、分享權限已讀回。
