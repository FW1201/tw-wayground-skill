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
      hint: "尚未安裝依賴。請先執行：cd <skill-dir> && npm install。",
    }),
  );
  process.exit(1);
}

const { openSession, inspectAuthAcrossPages, gotoReady, authManifest } = await import("./lib/session.mjs");

const PLATFORM = "wayground";
const DASHBOARD = /(wayground|quizizz)\.com\/(admin|dashboard)/;
const AUTH = authManifest({
  entryUrl: "https://wayground.com/admin",
  loginUrls: [/wayground\.com\/login/i, /quizizz\.com\/login/i],
  authenticatedUrlPatterns: [DASHBOARD],
  authenticatedLocators: [(p) => p.getByText(/建立|create|assessment|測驗/i)],
});

let context;
let page;
let session;
try {
  session = await openSession(PLATFORM, { mode: "cdp" });
  ({ context, page } = session);
  await gotoReady(page, "https://wayground.com/admin", { timeoutMs: 30000 });
  const auth = await inspectAuthAcrossPages(context, page, AUTH);
  const loggedIn = auth.state === "authenticated";
  if (loggedIn) {
    console.log(
      JSON.stringify({
        ok: true,
        loggedIn: true,
        authState: auth.state,
        browserMode: session.browserMode,
        cdpEndpoint: session.cdpEndpoint,
        checkedUrl: auth.url,
        note: "已登入，可直接執行 node scripts/run.mjs <quiz.json> --stage prepare。",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        ok: false,
        error: "not-logged-in",
        loggedIn: false,
        authState: auth.state,
        browserMode: session.browserMode,
        cdpEndpoint: session.cdpEndpoint,
        checkedUrl: auth.url,
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
      hint: err?.code === "cdp-unavailable"
        ? "找不到教育平台專用正常 Chrome。請先執行 npm run browser:start。"
        : "無法連到 Wayground。請確認正常 Chrome 與網路後重試一次。",
    }),
  );
  process.exitCode = 1;
} finally {
  await context?.close();
}
