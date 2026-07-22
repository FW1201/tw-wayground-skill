#!/usr/bin/env node
// Import a build-xlsx.mjs spreadsheet into a new Wayground assessment.
// Live-verified 2026-07-22 against a real logged-in session (UI was in
// Traditional Chinese). Key findings vs. the original port:
//  - "建立"（Create）click opens an inline menu whose assessment option is
//    labelled "評估" (not "Assessment"/"Quiz").
//  - That opens a "建立一個新活動" screen with 3 cards: 匯入工作表/問題
//    (Import worksheet/questions) / 用人工智慧生成 (AI generate) /
//    從頭開始創建 (from scratch). Click the import card.
//  - The import screen defaults to a "檔案文件" (File document) tab whose
//    supported formats are PDF/PPT/PPTX/DOC/DOCX/PNG/JPG/Canvas QTI.zip —
//    NO xlsx. The spreadsheet upload is a SEPARATE "試算表" (Spreadsheet)
//    tab that must be clicked first — this was missing from the original
//    logic entirely.
//  - The 試算表 tab has an official "下載模板" (Download template) button;
//    its header row was diffed against build-xlsx.mjs's output (see that
//    script's header comment) and used to fix a missing "Answer explanation"
//    column.
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
  gotoReady,
  inspectAuth,
  authManifest,
} from "../lib/session.mjs";

const PLATFORM = "wayground";
const DASHBOARD = /(wayground|quizizz)\.com\/(admin|dashboard)/;
const AUTH = authManifest({
  loginUrls: [/wayground\.com\/login/i, /quizizz\.com\/login/i],
  authenticatedUrlPatterns: [DASHBOARD],
  authenticatedLocators: [(p) => p.getByText(/建立|create|assessment|測驗/i)],
});

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
  await gotoReady(page, "https://wayground.com/admin", { timeoutMs: 30000 });
  const auth = await inspectAuth(page, AUTH);
  if (auth.state !== "authenticated") {
    fail("not-logged-in", "尚未登入 Wayground。請先執行 node scripts/pw/login.mjs。");
    await context.close();
    process.exit(1);
  }

  await clickFirst(
    page,
    [
      (p) => p.getByText(/^建立$/),
      (p) => p.getByRole("button", { name: /create/i }),
      (p) => p.getByRole("link", { name: /create/i }),
    ],
    "Create button",
  );
  await clickFirst(
    page,
    [
      (p) => p.getByText(/^評估$/),
      (p) => p.getByText(/assessment|quiz/i),
      (p) => p.getByRole("menuitem", { name: /assessment|quiz/i }),
    ],
    "Assessment entry",
  );
  await page.waitForURL(/\/admin\/assessment/i, { timeout: 15000 });

  await clickFirst(
    page,
    [
      (p) => p.getByText(/^匯入工作表\/問題$/),
      (p) => p.getByText(/import.*spreadsheet|import.*question/i),
    ],
    "Import worksheet/questions card",
    15000,
  );

  // Must switch to the "試算表" (Spreadsheet) tab — the default "檔案文件"
  // tab does not accept .xlsx at all.
  await clickFirst(
    page,
    [(p) => p.getByRole("tab", { name: /^試算表$|^spreadsheet$/i }), (p) => p.getByText(/^試算表$/)],
    "Spreadsheet tab",
    10000,
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
      hint: "Wayground 介面可能已改版。請人工完成匯入（建立 → 評估 → 匯入工作表/問題 → 試算表分頁），並回報以更新 flow manifest。",
    });
  } else {
    await failWithDiagnostics(PLATFORM, page, msg, "匯入失敗。請確認網路與登入狀態後重試一次。");
  }
} finally {
  await context.close();
}
