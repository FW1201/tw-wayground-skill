# Browser Core validation

- canary id: `CANARY-20260722-CDP-A`
- unit/static: 12/12 tests passed；涵蓋 CDP default、endpoint ordering、owned-page close、detach、OAuth rejection、query redaction、profile lock 與既有 Browser Core 行為。
- core parity: all four repositories use the same 10-file Browser Core；SHA-256 aggregate `3384ae3764213821cd2b0dc2bc96fb2bb40d94ff4370a22963f23e5d3bc2d785`。
- root-cause regression: Google `signin/rejected` 會分類為 `oauth-browser-rejected`，login 只允許 CDP，且 handoff 後不再保持 Playwright 連線。
- shared live CDP smoke: Chrome 150 launcher、websocket endpoint、detach 與 session-close lifecycle 已由 Nearpod 參考實作驗證；Wayground 登入仍待使用者重新安裝後測試。
- live boundary: 本次未執行 XLSX import、publish、assign 或 duplicate-write canary。
