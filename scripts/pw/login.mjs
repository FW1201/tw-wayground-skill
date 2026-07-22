#!/usr/bin/env node
// Two-step login through a user-launched normal Chrome profile. The first run
// opens Wayground login over CDP and detaches before OAuth/MFA; rerun to verify.
import { openSession, ok, fail, failWithDiagnostics, inspectAuthAcrossPages, gotoReady, authManifest } from "../lib/session.mjs";

const PLATFORM = "wayground";
const LOGIN_URL = "https://wayground.com/login";
const ENTRY_URL = "https://wayground.com/admin";
// Login evidence: teacher dashboard URL (wayground.com/admin*, quizizz legacy redirects included)
const DASHBOARD = /(wayground|quizizz)\.com\/(admin|dashboard)/;
const AUTH = authManifest({
  entryUrl: ENTRY_URL,
  loginUrls: [/wayground\.com\/login/i, /quizizz\.com\/login/i],
  authenticatedUrlPatterns: [DASHBOARD],
  authenticatedLocators: [(p) => p.getByText(/建立|create|assessment|測驗/i)],
});

let session;
let context;
let page;
let detached = false;
try {
  session = await openSession(PLATFORM, { mode: "cdp" });
  ({ context, page } = session);
  await gotoReady(page, ENTRY_URL, { timeoutMs: 30000 });
  const current = await inspectAuthAcrossPages(context, page, AUTH);
  if (current.state === "authenticated") {
    ok({ loggedIn: true, authState: current.state, dashboardUrl: current.url });
  } else {
    const oauthRejected = current.reason === "oauth-browser-rejected";
    await gotoReady(page, LOGIN_URL, { timeoutMs: 30000 });
    console.log(JSON.stringify({
      ok: false,
      handoff: oauthRejected ? "oauth-browser-rejected" : "external-login-required",
      authState: "user-action-required",
      browserMode: session.browserMode,
      loginUrl: page.url(),
      hint: oauthRejected
        ? "Google 已拒絕先前的 automated Chromium。請改在目前的教育平台專用正常 Chrome 分頁重新登入。"
        : "請在目前的正常 Chrome 分頁完成人工登入／Google OAuth／MFA；完成後重新執行本指令或 preflight。",
    }));
    await session.detach();
    detached = true;
    process.exitCode = 2;
  }
} catch (err) {
  if (err?.code === "cdp-unavailable") fail(err, "請先執行 npm run browser:start，再執行 login。");
  else if (page) await failWithDiagnostics(PLATFORM, page, err, "登入檢查失敗。請確認正常 Chrome 仍開啟，再重試一次。");
  else fail(err, "無法建立 CDP session。請執行 npm run browser:status 檢查。");
} finally {
  if (session && !detached) await session.close();
}
