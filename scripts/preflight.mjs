#!/usr/bin/env node
// Preflight check for the Wayground chain: is the toolchain installed, and is
// the teacher logged in? Run this BEFORE run.mjs so the one unavoidable manual
// step (login/MFA in a visible window) is surfaced up front instead of failing
// mid-chain. Login/MFA/CAPTCHA are always the teacher's own action — this only
// reports state, it never tries to log in.
// Usage: node scripts/preflight.mjs
// Output: {ok:true, loggedIn:bool} or {ok:false, error, hint}
import { existsSync } from "node:fs";

// Check the toolchain WITHOUT importing playwright first — a missing dependency
// must produce an actionable hint, not a module-not-found stack trace.
if (!existsSync(new URL("../node_modules/playwright", import.meta.url))) {
  console.log(
    JSON.stringify({
      ok: false,
      error: "needs-install",
      needsInstall: true,
      hint: "尚未安裝依賴。請先執行：cd <skill-dir> && npm install && npx playwright install chromium。",
    }),
  );
  process.exit(1);
}

const { openSession } = await import("./lib/session.mjs");

const PLATFORM = "wayground";
const DASHBOARD = /(wayground|quizizz)\.com\/(admin|dashboard)/;

const { context, page } = await openSession(PLATFORM);
try {
  await page.goto("https://wayground.com/admin", { waitUntil: "domcontentloaded" });
  const loggedIn = DASHBOARD.test(page.url()) && !/\/login/i.test(page.url());
  if (loggedIn) {
    console.log(
      JSON.stringify({
        ok: true,
        loggedIn: true,
        note: "已登入，可直接執行 node scripts/run.mjs <quiz.json> --stage prepare。",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        ok: false,
        error: "not-logged-in",
        loggedIn: false,
        hint: "尚未登入 Wayground。請先執行 node scripts/pw/login.mjs，由老師本人在開啟的視窗完成登入/MFA，再重跑 preflight。",
      }),
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.log(
    JSON.stringify({
      ok: false,
      error: String(err?.message ?? err),
      hint: "無法連到 Wayground。請確認網路後重試一次。",
    }),
  );
  process.exitCode = 1;
} finally {
  await context.close();
}
