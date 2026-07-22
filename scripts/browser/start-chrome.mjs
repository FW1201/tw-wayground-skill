#!/usr/bin/env node
import { startChrome } from "../lib/browser-core/chrome-launch.mjs";

try {
  const started = startChrome();
  console.log(JSON.stringify({
    ok: true,
    ...started,
    note: "已啟動教育平台專用的正常 Chrome。請在此視窗完成人工 Google 登入；不要關閉 Chrome，再執行 login 或 preflight。",
  }));
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    error: String(error?.code ?? error?.message ?? error),
    hint: "找不到 Google Chrome。可設定 TW_EDU_CHROME_PATH 指向 Chrome 執行檔後重試。",
  }));
  process.exitCode = 1;
}
