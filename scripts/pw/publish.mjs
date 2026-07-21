#!/usr/bin/env node
// Fill assessment metadata and publish. The agent must confirm the parameters
// with the teacher in chat BEFORE running this (external write).
// Live-verified 2026-07-22 end-to-end against a real logged-in session. Key
// findings vs. the original guessed selectors:
//  - The confirm button on the editor is "發布" (top-right, pink). Clicking
//    it opens a "太棒了，你快完成了" (Almost done!) dialog — this IS the
//    metadata dialog (there's no separate earlier "Publish" click).
//  - Fields: 姓名 (name, plain text input, no placeholder text — has a
//    char counter like "7/64"), 科目 (subject, custom dropdown), 年級
//    (grade, custom dropdown), 語言 (language, custom dropdown, defaults to
//    英語/English), 能見度 (visibility, custom dropdown).
//  - ⚠️ 科目 dropdown does NOT have fine-grained subjects like "生物"
//    (Biology) — only broad categories: 世界語言/數學/英語/科學 (World
//    Languages/Math/English/Science). Map --subject to the closest match
//    (usually 科學/Science) and tell the teacher the mapping isn't exact.
//  - 年級 uses a US-style grade scale (幼兒園/小學/一年級.../7年級/8年級...),
//    not Taiwan's 國小/國中/高中 labels. 7年級≈國一, 8年級≈國二, 9年級≈國三
//    is the commonly used mapping; pass the literal Chinese grade label.
//  - ⚠️ 能見度 defaults to "公開可見" (Public — "此資源將在評估庫中公開
//    顯示", i.e. the quiz AND its answers become publicly searchable). The
//    other options are "受限制的" (Restricted — only you and people you
//    share with) and "我組織中的每個人" (Everyone in my organization). This
//    script defaults to Restricted unless --visibility public is explicit,
//    since public-by-default is a real privacy risk for a teacher's content.
//  - After clicking 發布 in the dialog, the quiz detail page loads at
//    wayground.com/admin/quiz/<id> (no /edit suffix) — that's the quizUrl
//    to pass to assign.mjs.
// Usage: node scripts/pw/publish.mjs --editor-url <url> --name "..." [--subject 科學] [--grade 7年級] [--visibility restricted|public|org]
// Flow manifest: references/flow-publish.md
import {
  openSession,
  ok,
  fail,
  failWithDiagnostics,
  handoff,
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
const visibility = arg("visibility") ?? "restricted";
const VISIBILITY_LABEL = {
  public: /^公開可見$/,
  restricted: /^受限制的$/,
  org: /^我組織中的每個人$/,
};

if (!editorUrl || !name) {
  fail("usage", 'node scripts/pw/publish.mjs --editor-url <url> --name "測驗名稱" [--subject 科學] [--grade 7年級] [--visibility restricted|public|org]');
  process.exit(1);
}
if (!VISIBILITY_LABEL[visibility]) {
  fail("usage", `--visibility 必須是 ${Object.keys(VISIBILITY_LABEL).join("|")} 之一`);
  process.exit(1);
}

// Open a custom dropdown by its 上方 label text, then click a matching option.
async function selectDropdown(page, labelText, optionRegex) {
  const label = page.getByText(labelText, { exact: true }).first();
  const trigger = label.locator("xpath=following-sibling::*[1]");
  await trigger.click({ timeout: 8000 });
  await page.getByText(optionRegex).first().click({ timeout: 8000 });
}

const { context, page } = await openSession(PLATFORM);
try {
  await page.goto(editorUrl, { waitUntil: "domcontentloaded" });
  if (/\/login/.test(page.url())) {
    fail("not-logged-in", "尚未登入。請先執行 node scripts/pw/login.mjs。");
    await context.close();
    process.exit(1);
  }

  const publishBtn = page.getByRole("button", { name: /^發布$/ }).first();
  await publishBtn.waitFor({ state: "visible", timeout: 15000 });
  await publishBtn.click();

  await page.getByText(/太棒了，你快完成了/).waitFor({ state: "visible", timeout: 10000 });

  const nameInput = page.locator('input[value], input[type="text"]').first();
  await nameInput.fill(name);

  if (subject) {
    try {
      await selectDropdown(page, "科目", new RegExp(`^${subject}$`));
    } catch {
      // subject not in the fixed list (世界語言/數學/英語/科學) — leave
      // default and let the teacher pick manually; not fatal.
    }
  }
  if (grade) {
    try {
      await selectDropdown(page, "年級", new RegExp(`^${grade}$`));
    } catch {
      // long scrollable list — leave for teacher if the exact label misses
    }
  }
  await selectDropdown(page, "能見度", VISIBILITY_LABEL[visibility]).catch(() => {
    // if this fails the default (公開可見/Public) stays — surfaced via notes below
  });

  const confirmBtn = page.getByRole("button", { name: /^發布$/ }).last();
  await confirmBtn.click({ timeout: 10000 });

  // Success evidence: lands on the quiz detail page (no /edit suffix).
  await page.waitForURL(/\/admin\/quiz\/[a-z0-9]+$/i, { timeout: 30000 });
  ok({
    published: true,
    quizUrl: page.url(),
    visibility,
    visibilityWarning:
      visibility === "public"
        ? "⚠️ 此測驗設為公開可見，內容與答案將出現在 Wayground 評估庫供所有人搜尋。"
        : undefined,
    next: "執行 scripts/pw/assign.mjs 指派作業或開 Live。",
  });
} catch (err) {
  const msg = String(err?.message ?? err);
  await handoff(PLATFORM, page, msg, {
    hint: "無法確認發布是否完成，或 metadata 欄位選擇器不符。請開啟 resumeUrl 人工確認：點「發布」→ 填姓名/科目/年級/能見度 → 再點對話框內「發布」。",
  });
} finally {
  await context.close();
}
