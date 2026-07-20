#!/usr/bin/env node
// Open a visible browser for the teacher to log in to Wayground.
// The teacher completes email/Google login + any MFA/CAPTCHA personally.
// Session persists in ~/.tw-edu-skills/wayground/profile/ (never printed).
// Usage: node scripts/pw/login.mjs   (allow up to ~6 minutes)
import { openSession, ok, failWithDiagnostics } from "../lib/session.mjs";

const PLATFORM = "wayground";
const LOGIN_URL = "https://wayground.com/login";
// Login evidence: teacher dashboard URL (wayground.com/admin*, quizizz legacy redirects included)
const DASHBOARD = /(wayground|quizizz)\.com\/(admin|dashboard)/;
const WAIT_MS = 5 * 60 * 1000;

const { context, page } = await openSession(PLATFORM);
try {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  if (!DASHBOARD.test(page.url())) {
    console.error("請在開啟的視窗完成 Wayground 登入（最多等 5 分鐘）…");
    await page.waitForURL(DASHBOARD, { timeout: WAIT_MS });
  }
  ok({ loggedIn: true, dashboardUrl: page.url() });
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
