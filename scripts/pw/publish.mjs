#!/usr/bin/env node
// Fill assessment metadata and publish. The agent must confirm the parameters
// with the teacher in chat BEFORE running this (external write).
// Usage: node scripts/pw/publish.mjs --editor-url <url> --name "..." [--subject ...] [--grade ...] [--visibility public|private]
// Flow manifest: references/flow-publish.md
import {
  openSession,
  ok,
  fail,
  failWithDiagnostics,
  handoff,
  clickFirst,
} from "../lib/session.mjs";

const PLATFORM = "wayground";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const editorUrl = arg("editor-url");
const name = arg("name");
const subject = arg("subject");
const grade = arg("grade");
const visibility = arg("visibility") ?? "private";

if (!editorUrl || !name) {
  fail("usage", "用法：node scripts/pw/publish.mjs --editor-url <url> --name \"測驗名稱\" [--subject 科目] [--grade 年級] [--visibility public|private]");
  process.exit(1);
}

const { context, page } = await openSession(PLATFORM);
try {
  await page.goto(editorUrl, { waitUntil: "domcontentloaded" });
  if (/\/login/.test(page.url())) {
    fail("not-logged-in", "尚未登入。請先執行 node scripts/pw/login.mjs。");
    await context.close();
    process.exit(1);
  }

  await clickFirst(
    page,
    [
      (p) => p.getByRole("button", { name: /publish|發布/i }),
      (p) => p.getByText(/^publish$/i),
    ],
    "Publish button",
    15000,
  );

  // Metadata dialog: name field
  const nameInput = page
    .locator('input[placeholder*="name" i], input[placeholder*="title" i], [data-testid*="name"] input')
    .first();
  try {
    await nameInput.waitFor({ state: "visible", timeout: 10000 });
    await nameInput.fill(name);
  } catch {
    // Some flows carry the name from the editor; not fatal if absent.
  }

  if (subject) {
    try {
      await clickFirst(page, [(p) => p.getByText(new RegExp(subject, "i"))], "subject option", 5000);
    } catch {
      // subject chips vary; leave for teacher if not found
    }
  }
  if (grade) {
    try {
      await clickFirst(page, [(p) => p.getByText(new RegExp(grade, "i"))], "grade option", 5000);
    } catch {
      // grade selector varies; leave for teacher if not found
    }
  }
  if (visibility === "private") {
    try {
      await clickFirst(page, [(p) => p.getByText(/private|私人/i)], "private visibility", 5000);
    } catch {
      // default may already be acceptable; teacher confirmed in chat
    }
  }

  await clickFirst(
    page,
    [
      (p) => p.getByRole("button", { name: /^(save|publish|confirm|完成|發布|儲存)$/i }),
      (p) => p.getByRole("button", { name: /publish|save/i }),
    ],
    "confirm publish",
    10000,
  );

  // Success evidence: leaves editor for the quiz detail/library page.
  await page.waitForURL(/(admin\/(quiz|assessment)|\/library|\/details)/, { timeout: 30000 });
  ok({
    published: true,
    quizUrl: page.url(),
    next: "執行 scripts/pw/assign.mjs 指派作業或開 Live。",
  });
} catch (err) {
  const msg = String(err?.message ?? err);
  if (msg.startsWith("selector-failure") || /waitForURL/i.test(msg) || /Timeout/i.test(msg)) {
    await handoff(PLATFORM, page, msg, {
      hint: "無法確認發布是否完成（外部寫入狀態不明，已停止）。請開啟 resumeUrl 人工確認發布狀態。",
    });
  } else {
    await failWithDiagnostics(PLATFORM, page, msg, "發布失敗。請確認登入狀態後重試一次。");
  }
} finally {
  await context.close();
}
