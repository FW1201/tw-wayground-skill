import { promises as fs } from "node:fs";
import path from "node:path";
import { platformDir } from "./session-paths.mjs";
import { normalizeError, redactUrl } from "./contracts.mjs";
import { runDir } from "./run-state.mjs";

async function redactInputs(page) {
  await page.addStyleTag({ content: '[type="password"], [autocomplete="current-password"], [data-sensitive="true"] { visibility: hidden !important; }' }).catch(() => {});
}

export async function captureDiagnostics(platform, page, { runId, kind = "failure", error, extra = {} } = {}) {
  runId ??= process.env.TW_EDU_RUN_ID;
  const dir = runId ? runDir(platform, runId) : platformDir(platform, "diagnostics");
  const suffix = `${kind}-${Date.now()}`;
  let screenshot;
  let pageState;
  try {
    await redactInputs(page);
    screenshot = path.join(dir, `${suffix}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
  } catch {}
  try {
    pageState = path.join(dir, `${suffix}.json`);
    await fs.writeFile(pageState, `${JSON.stringify({
      kind,
      error: error ? { code: normalizeError(error), message: String(error.message ?? error) } : undefined,
      url: redactUrl(page.url()),
      title: await page.title().catch(() => undefined),
      readyState: await page.evaluate(() => document.readyState).catch(() => undefined),
      capturedAt: new Date().toISOString(),
      ...extra,
    }, null, 2)}\n`, { mode: 0o600 });
  } catch {}
  return { screenshot, pageState };
}

export async function failWithDiagnostics(platform, page, error, hint, extra = {}) {
  const diagnostics = await captureDiagnostics(platform, page, { kind: "failure", error, extra });
  console.log(JSON.stringify({ ok: false, error: normalizeError(error), message: String(error?.message ?? error), hint, ...extra, ...diagnostics }));
  process.exitCode = 1;
  return diagnostics;
}

export async function handoff(platform, page, reason, evidence = {}) {
  const diagnostics = await captureDiagnostics(platform, page, { kind: "handoff", extra: evidence });
  console.log(JSON.stringify({
    ok: false,
    handoff: reason,
    resumeUrl: redactUrl(page.url()),
    note: "已停止自動化。請老師在同一平台登入狀態下開啟 resumeUrl 手動接續；不可重複執行外部寫入。",
    ...evidence,
    ...diagnostics,
  }));
  process.exitCode = 1;
  return diagnostics;
}
