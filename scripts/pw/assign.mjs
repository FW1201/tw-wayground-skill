#!/usr/bin/env node
// Assign a published assessment as homework (or start Live) and capture the
// join code / share link. Agent must confirm mode & deadline with the teacher
// in chat BEFORE running (external write).
// Usage: node scripts/pw/assign.mjs --quiz-url <url> --mode homework|live [--deadline "YYYY-MM-DD"]
// Flow manifest: references/flow-assign.md
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

const quizUrl = arg("quiz-url");
const mode = arg("mode") ?? "homework";
const deadline = arg("deadline");

if (!quizUrl || !["homework", "live"].includes(mode)) {
  fail("usage", "用法：node scripts/pw/assign.mjs --quiz-url <url> --mode homework|live [--deadline YYYY-MM-DD]");
  process.exit(1);
}

const { context, page } = await openSession(PLATFORM);
try {
  await page.goto(quizUrl, { waitUntil: "domcontentloaded" });
  if (/\/login/.test(page.url())) {
    fail("not-logged-in", "尚未登入。請先執行 node scripts/pw/login.mjs。");
    await context.close();
    process.exit(1);
  }

  if (mode === "homework") {
    await clickFirst(
      page,
      [
        (p) => p.getByRole("button", { name: /assign|homework|指派/i }),
        (p) => p.getByText(/assign homework|^assign$/i),
      ],
      "Assign button",
      15000,
    );
    if (deadline) {
      try {
        const dateInput = page.locator('input[type="date"], input[placeholder*="date" i]').first();
        await dateInput.waitFor({ state: "visible", timeout: 5000 });
        await dateInput.fill(deadline);
      } catch {
        // deadline picker varies; teacher confirmed default in chat
      }
    }
    await clickFirst(
      page,
      [
        (p) => p.getByRole("button", { name: /^(assign|continue|confirm|指派|確認)$/i }),
        (p) => p.getByRole("button", { name: /assign/i }),
      ],
      "confirm assign",
      10000,
    );
  } else {
    await clickFirst(
      page,
      [
        (p) => p.getByRole("button", { name: /start.*live|host|live/i }),
        (p) => p.getByText(/start a live quiz/i),
      ],
      "Start live",
      15000,
    );
    await clickFirst(
      page,
      [(p) => p.getByRole("button", { name: /^(continue|start|開始)$/i })],
      "confirm live start",
      10000,
    ).catch(() => {});
  }

  // Success evidence: join code / share link appears.
  const codeLoc = page
    .locator('text=/join\\?gc=\\d+/, [class*="game-code"], [data-testid*="game-code"], [class*="join-code"]')
    .first();
  let joinCode, shareUrl;
  try {
    await codeLoc.waitFor({ state: "visible", timeout: 30000 });
    const txt = (await codeLoc.textContent())?.trim() ?? "";
    const urlMatch = txt.match(/(?:wayground|quizizz)\.com\/join\?gc=(\d+)/i);
    const codeMatch = txt.match(/\b(\d{6,8})\b/);
    joinCode = urlMatch?.[1] ?? codeMatch?.[1];
    shareUrl = urlMatch ? `https://${urlMatch[0]}` : joinCode ? `https://wayground.com/join?gc=${joinCode}` : undefined;
  } catch {
    // fall through to page-wide scan
  }
  if (!joinCode) {
    const body = (await page.locator("body").innerText()).slice(0, 20000);
    const m = body.match(/(?:wayground|quizizz)\.com\/join\?gc=(\d+)/i);
    if (m) {
      joinCode = m[1];
      shareUrl = `https://${m[0]}`;
    }
  }

  if (joinCode) {
    ok({ assigned: true, mode, joinCode, shareUrl, pageUrl: page.url() });
  } else {
    await handoff(PLATFORM, page, "join-code-not-found", {
      hint: "指派動作可能已完成但未擷取到加入代碼。請開啟 resumeUrl 從畫面複製 join code 給學生。",
    });
  }
} catch (err) {
  const msg = String(err?.message ?? err);
  if (msg.startsWith("selector-failure")) {
    await handoff(PLATFORM, page, msg, {
      hint: "無法確認指派是否完成（外部寫入狀態不明，已停止）。請開啟 resumeUrl 人工確認。",
    });
  } else {
    await failWithDiagnostics(PLATFORM, page, msg, "指派失敗。請確認測驗已發布、登入狀態正常後重試一次。");
  }
} finally {
  await context.close();
}
