#!/usr/bin/env node
// Assign a published assessment as homework (student-paced) or start Live
// (teacher-led), and capture the join code / share link.
// Live-verified 2026-07-22 end-to-end against a real logged-in session —
// this is a COMPLETE REWRITE of the original guessed flow, which was wrong
// on nearly every step:
//  1. The trigger is "現在開始" (Start now) on the quiz detail page (NOT an
//     "Assign" button — that word doesn't appear in the UI at all). There is
//     a separate "分配" (Assign) button that opens an "individualization
//     adjustments" (accessibility/differentiation) flow — unrelated to
//     homework/live assignment, not used here.
//  2. Clicking 現在開始 opens "您想如何主持會議？" (How do you want to run
//     this?) with two cards: "學生步調" (Student-paced) and "老師主導"
//     (Teacher-led). Selecting one navigates to
//     .../start_new/<quizId>?selection=student-paced (or teacher-led).
//  3. That opens a "選擇會話模式" (Choose game mode) screen: 經典(Classic) /
//     佔領高峰(Mountain, disabled under 10 questions) / 操場(Playground) /
//     測驗模式(Test mode) / 團隊模式(Team mode). "經典" is the safe default.
//  4. That opens an assignment-detail settings page (header still reads
//     "Live") with class selection, individualization, attempt/timer
//     settings — click the header "開始" (Start) button.
//  5. Final screen shows the REAL join info: domain is "joinmyquiz.com" (NOT
//     wayground.com/join!) with a 6-digit numeric code (e.g. "994244"), plus
//     a QR code. Final URL is wayground.com/admin/activity/classic/<id>.
// Agent must confirm mode & class/deadline expectations with the teacher in
// chat BEFORE running (external write, students can join immediately).
// Usage: node scripts/pw/assign.mjs --quiz-url <url> --mode homework|live
// Flow manifest: references/flow-assign.md
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

const quizUrl = arg("quiz-url");
const mode = arg("mode") ?? "homework"; // homework -> student-paced, live -> teacher-led

if (!quizUrl || !["homework", "live"].includes(mode)) {
  fail("usage", "用法：node scripts/pw/assign.mjs --quiz-url <url> --mode homework|live");
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

  const startNow = page.getByRole("button", { name: /^現在開始$/i }).first();
  await startNow.waitFor({ state: "visible", timeout: 15000 });
  await startNow.click();

  const cardLabel = mode === "homework" ? /^學生步調$/ : /^老師主導$/;
  const modeCard = page.getByText(cardLabel).first();
  await modeCard.waitFor({ state: "visible", timeout: 10000 });
  await modeCard.click();

  // "選擇會話模式" (game mode) screen. "經典" is always enabled; others
  // (佔領高峰 etc.) are disabled below 10 questions. Stick to Classic.
  const classicCard = page.getByText(/^經典$/).first();
  await classicCard.waitFor({ state: "visible", timeout: 15000 });
  await classicCard.click();

  // Assignment-detail settings page. Header button confirms and starts.
  const headerStart = page.getByRole("button", { name: /^開始$/i }).first();
  await headerStart.waitFor({ state: "visible", timeout: 15000 });
  await headerStart.click();

  // Final join screen: real domain is joinmyquiz.com with a numeric code.
  const codeLoc = page.getByText(/^\d{6}$/).first();
  let joinCode, joinUrl, domain;
  try {
    await codeLoc.waitFor({ state: "visible", timeout: 30000 });
    joinCode = (await codeLoc.textContent())?.trim();
    const domainLoc = page.getByText(/joinmyquiz\.com/i).first();
    domain = (await domainLoc.textContent())?.trim() ?? "joinmyquiz.com";
    joinUrl = `https://${domain}`;
  } catch {
    // fall through to page-wide scan
  }
  if (!joinCode) {
    const body = (await page.locator("body").innerText()).slice(0, 20000);
    const codeMatch = body.match(/\b(\d{6})\b/);
    const domainMatch = body.match(/joinmyquiz\.com/i);
    joinCode = codeMatch?.[1];
    domain = domainMatch?.[0] ?? "joinmyquiz.com";
    joinUrl = joinCode ? `https://${domain}` : undefined;
  }

  if (joinCode) {
    ok({
      assigned: true,
      mode,
      joinCode,
      joinUrl,
      note: "學生到 joinmyquiz.com 輸入代碼即可加入，不需帳號。",
      pageUrl: page.url(),
    });
  } else {
    await handoff(PLATFORM, page, "join-code-not-found", {
      hint: "指派動作可能已完成但未擷取到加入代碼。請開啟 resumeUrl 從畫面複製 joinmyquiz.com 的 6 碼代碼給學生。",
    });
  }
} catch (err) {
  const msg = String(err?.message ?? err);
  await failWithDiagnostics(
    PLATFORM,
    page,
    msg,
    "指派失敗。流程為：現在開始 → 學生步調/老師主導 → 經典 → 開始。請確認測驗已發布、登入狀態正常後重試一次；或人工在測驗詳情頁點「現在開始」完成。",
  );
} finally {
  await context.close();
}
