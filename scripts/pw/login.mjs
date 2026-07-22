#!/usr/bin/env node
// Open a visible browser for the teacher to log in to Wayground.
// The teacher completes email/Google login + any MFA/CAPTCHA personally.
// Session persists in ~/.tw-edu-skills/wayground/profile/ (never printed).
// Usage: node scripts/pw/login.mjs   (allow up to ~6 minutes)
import { openSession, ok, failWithDiagnostics, inspectAuth, waitForAuthenticated, gotoReady, authManifest } from "../lib/session.mjs";

const PLATFORM = "wayground";
const LOGIN_URL = "https://wayground.com/login";
const ENTRY_URL = "https://wayground.com/admin";
// Login evidence: teacher dashboard URL (wayground.com/admin*, quizizz legacy redirects included)
const DASHBOARD = /(wayground|quizizz)\.com\/(admin|dashboard)/;
const WAIT_MS = 5 * 60 * 1000;
const AUTH = authManifest({
  entryUrl: ENTRY_URL,
  loginUrls: [/wayground\.com\/login/i, /quizizz\.com\/login/i],
  authenticatedUrlPatterns: [DASHBOARD],
  authenticatedLocators: [(p) => p.getByText(/建立|create|assessment|測驗/i)],
});

const { context, page } = await openSession(PLATFORM);
try {
  await gotoReady(page, ENTRY_URL, { timeoutMs: 30000 });
  const current = await inspectAuth(page, AUTH);
  if (current.state !== "authenticated") {
    await gotoReady(page, LOGIN_URL, { timeoutMs: 30000 });
    console.error("請在開啟的視窗完成 Wayground 登入（最多等 5 分鐘）…");
    const authenticated = await waitForAuthenticated(context, page, AUTH, WAIT_MS);
    ok({ loggedIn: true, authState: authenticated.state, dashboardUrl: authenticated.url });
  } else {
    ok({ loggedIn: true, authState: current.state, dashboardUrl: current.url });
  }
} catch (err) {
  await failWithDiagnostics(
    PLATFORM,
    page,
    `login-timeout: ${String(err?.message ?? err)}`,
    "5 分鐘內未偵測到登入完成。請重新執行 scripts/pw/login.mjs 並在視窗中完成登入。",
  );
} finally {
  await context.close();
}
