// Shared Playwright session helpers for tw-*-skill repos.
// Policy (from edu-agent-kit docs/refactor/BROWSER-AUTOMATION-POLICY.md):
//  - visible (headed) browser; the user completes login/MFA/CAPTCHA themselves
//  - persistent context per platform under ~/.tw-edu-skills/<platform>/profile/
//    (cookies live only inside the Chromium profile; never serialized, never printed)
//  - selector/success-evidence failure => zero retries, screenshot, stop
//  - ambiguous external-write state => stop
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = path.join(os.homedir(), ".tw-edu-skills");

export function platformDir(platform, sub) {
  const d = path.join(BASE, platform, sub);
  mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}

export async function openSession(platform, { headless = false } = {}) {
  const context = await chromium.launchPersistentContext(
    platformDir(platform, "profile"),
    {
      headless,
      viewport: { width: 1440, height: 900 },
      locale: "zh-TW",
    },
  );
  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

/** Print success JSON. */
export function ok(data = {}) {
  console.log(JSON.stringify({ ok: true, ...data }));
}

/** Print failure JSON with an actionable zh-TW hint; sets exit code 1. */
export function fail(error, hint, extra = {}) {
  console.log(JSON.stringify({ ok: false, error, hint, ...extra }));
  process.exitCode = 1;
}

/** Screenshot to diagnostics dir, then fail. Never includes cookies/headers. */
export async function failWithDiagnostics(platform, page, error, hint, extra = {}) {
  let screenshot;
  try {
    screenshot = path.join(
      platformDir(platform, "diagnostics"),
      `fail-${Date.now()}.png`,
    );
    await page.screenshot({ path: screenshot });
  } catch {
    screenshot = undefined;
  }
  fail(error, hint, { ...extra, screenshot });
}

/**
 * Stop-and-hand-off: record where we stopped so the teacher can resume
 * manually. The login session persists in the profile, so reopening the
 * resumeUrl in a later login.mjs / manual browser restores state.
 */
export async function handoff(platform, page, reason, evidence = {}) {
  let screenshot;
  try {
    screenshot = path.join(
      platformDir(platform, "diagnostics"),
      `handoff-${Date.now()}.png`,
    );
    await page.screenshot({ path: screenshot });
  } catch {
    screenshot = undefined;
  }
  console.log(
    JSON.stringify({
      ok: false,
      handoff: reason,
      resumeUrl: page.url(),
      screenshot,
      note: "已停止自動化。登入狀態已保留，請老師開啟 resumeUrl 手動接續。",
      ...evidence,
    }),
  );
  process.exitCode = 1;
}

/**
 * Click the first matching candidate locator. Candidates are the flow's
 * declared steps (see references/flow-*.md) — if none match, this is a
 * selector failure: no guessing, no retries.
 */
export async function clickFirst(page, candidates, description, timeout = 8000) {
  for (const make of candidates) {
    const loc = make(page).first();
    try {
      await loc.waitFor({ state: "visible", timeout });
      await loc.click();
      return true;
    } catch {
      // try next declared candidate
    }
  }
  throw new Error(`selector-failure: ${description}`);
}

/** Wait until URL matches, as login/success evidence. */
export async function waitForUrl(page, pattern, timeoutMs) {
  await page.waitForURL(pattern, { timeout: timeoutMs });
}
