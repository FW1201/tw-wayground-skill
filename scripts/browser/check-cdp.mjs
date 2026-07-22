#!/usr/bin/env node
import { cdpEndpointCandidates } from "../lib/browser-core/session.mjs";

const results = [];
for (const endpoint of cdpEndpointCandidates()) {
  try {
    const response = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const version = await response.json();
    console.log(JSON.stringify({ ok: true, endpoint, browser: version.Browser, webSocketDebuggerUrl: Boolean(version.webSocketDebuggerUrl) }));
    process.exit(0);
  } catch (error) {
    results.push({ endpoint, error: String(error?.message ?? error) });
  }
}
console.log(JSON.stringify({
  ok: false,
  error: "cdp-unavailable",
  checked: results,
  hint: "請先執行 npm run browser:start，並保持該 Chrome 視窗開啟。",
}));
process.exitCode = 1;
