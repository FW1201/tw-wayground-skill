#!/usr/bin/env node
// Import a build-xlsx.mjs spreadsheet into a new Wayground assessment.
// Stops (with screenshot + resumeUrl) on any selector/evidence failure.
// Usage: node scripts/pw/import-xlsx.mjs <file.xlsx> --expect-questions N
// Flow manifest: references/flow-import.md
import path from "node:path";
import { existsSync } from "node:fs";
import {
  openSession,
  ok,
  fail,
  failWithDiagnostics,
  handoff,
  clickFirst,
} from "../lib/session.mjs";

const PLATFORM = "wayground";
const DASHBOARD = /(wayground|quizizz)\.com\/(admin|dashboard)/;

const args = process.argv.slice(2);
const file = args[0];
const expectIdx = args.indexOf("--expect-questions");
const expected = expectIdx >= 0 ? Number(args[expectIdx + 1]) : undefined;

if (!file || !existsSync(file)) {
  fail("missing-file", "用法：node scripts/pw/import-xlsx.mjs <file.xlsx> [--expect-questions N]。請先執行 build-xlsx.mjs 產生檔案。");
  process.exit(1);
}

const { context, page } = await openSession(PLATFORM);
try {
  await page.goto("https://wayground.com/admin", { waitUntil: "domcontentloaded" });
  if (!DASHBOARD.test(page.url())) {
    fail("not-logged-in", "尚未登入 Wayground。請先執行 node scripts/pw/login.mjs。");
    await context.close();
    process.exit(1);
  }

  // Declared step candidates (flow-import.md). Rebrand-era UI may use either wording.
  await clickFirst(
    page,
    [
      (p) => p.getByRole("button", { name: /create/i }),
      (p) => p.getByRole("link", { name: /create/i }),
      (p) => p.getByText(/^建立$/),
    ],
    "Create button",
  );
  await clickFirst(
    page,
    [
      (p) => p.getByText(/assessment|quiz/i),
      (p) => p.getByRole("menuitem", { name: /assessment|quiz/i }),
    ],
    "Assessment/Quiz entry",
  );
  await clickFirst(
    page,
    [
      (p) => p.getByText(/import from spreadsheet/i),
      (p) => p.getByText(/spreadsheet|試算表/i),
      (p) => p.getByText(/import/i),
    ],
    "Import from spreadsheet",
    15000,
  );

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 15000 });
  await fileInput.setInputFiles(path.resolve(file));

  // Success evidence: the imported-questions preview/editor appears.
  const preview = page
    .locator('[class*="question"], [data-testid*="question"]')
    .first();
  await preview.waitFor({ state: "visible", timeout: 60000 });

  const count = await page
    .locator('[class*="question-container"], [data-testid*="question-card"]')
    .count();
  if (expected !== undefined && count > 0 && count !== expected) {
    await handoff(PLATFORM, page, "question-count-mismatch", {
      expected,
      found: count,
      hint: "匯入題數與預期不符，請在編輯器中人工核對後再發布。",
    });
  } else {
    ok({
      imported: true,
      editorUrl: page.url(),
      questionCountSeen: count || undefined,
      next: "執行 scripts/pw/publish.mjs 填寫 metadata 並發布。",
    });
  }
} catch (err) {
  const msg = String(err?.message ?? err);
  if (msg.startsWith("selector-failure")) {
    await handoff(PLATFORM, page, msg, {
      hint: "Wayground 介面可能已改版。請人工完成匯入（Create → Assessment → Import from spreadsheet），並回報以更新 flow manifest。",
    });
  } else {
    await failWithDiagnostics(PLATFORM, page, msg, "匯入失敗。請確認網路與登入狀態後重試一次。");
  }
} finally {
  await context.close();
}
