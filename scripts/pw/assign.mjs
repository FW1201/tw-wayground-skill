#!/usr/bin/env node
// Assign a published assessment to students, and capture the join code / link.
// Three modes (renamed 2026-07-22 to remove the earlier misleading naming):
//
//   --mode homework  -> the REAL homework/assignment path with a DEADLINE.
//                       Navigates to /admin/quiz/homework/<id> directly, picks
//                       a practice mode + deadline quick-pick, then clicks the
//                       top-right "分配" (Assign) button. Live-verified
//                       2026-07-22: this is a DIFFERENT page than "現在開始",
//                       reached at /admin/quiz/homework/<id>. It has:
//                        - 選擇模式 cards: 練習 / 答對率 / 測試
//                        - 結束於 deadline quick-picks: 沒有最後期限 / 1天 /
//                          1星期 / 2週  (note "1星期" and "2週", not "1週")
//                        - 4 settings tabs (一般的/精通/反作弊/遊戲化) with
//                          anti-cheat (反作弊監控/禁用右鍵單擊/停用複製貼上)
//                          and gamification (排行榜/通電/播放音樂/顯示梗圖).
//                       After 分配 it lands on /admin/activity/classic/<id> and
//                       shows joinmyquiz.com + a numeric code (8 digits here,
//                       e.g. "0657 2521").
//
//   --mode live-game -> the "現在開始" immediate self-paced game (student-paced,
//                       classic mode). NO deadline. (This was the old, wrongly
//                       named "homework" path.)
//
//   --mode live      -> the "現在開始" teacher-led live session.
//
// Live-verified 2026-07-22. The agent must confirm mode/deadline with the
// teacher in chat BEFORE running (external write — students can join at once).
// Usage:
//   node scripts/pw/assign.mjs --quiz-url <url> --mode homework [--deadline none|1天|1星期|2週] [--practice-mode practice|accuracy|test] [--anti-cheat] [--no-leaderboard] [--music]
//   node scripts/pw/assign.mjs --quiz-url <url> --mode live-game
//   node scripts/pw/assign.mjs --quiz-url <url> --mode live
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
function has(name) {
  return process.argv.includes(`--${name}`);
}

const quizUrl = arg("quiz-url");
const mode = arg("mode") ?? "homework";
if (!quizUrl || !["homework", "live-game", "live"].includes(mode)) {
  fail("usage", "用法：node scripts/pw/assign.mjs --quiz-url <url> --mode homework|live-game|live [--deadline none|1天|1星期|2週] [--practice-mode practice|accuracy|test]");
  process.exit(1);
}

// Deadline quick-pick label mapping (homework only). Accepts common aliases.
const DEADLINE_LABEL = {
  none: /^沒有最後期限$/,
  "沒有最後期限": /^沒有最後期限$/,
  "1天": /^1天$/,
  "1d": /^1天$/,
  "1day": /^1天$/,
  "1星期": /^1星期$/,
  "1週": /^1星期$/,
  "1w": /^1星期$/,
  "1week": /^1星期$/,
  "2週": /^2週$/,
  "2星期": /^2週$/,
  "2w": /^2週$/,
  "2weeks": /^2週$/,
};
const PRACTICE_LABEL = {
  practice: /^練習$/,
  accuracy: /^答對率$/,
  test: /^測試$/,
};

// Extract a 6–8 digit join code from arbitrary page text (may contain a space,
// e.g. "0657 2521"). Returns digits only.
function extractCode(text) {
  const m = text.match(/\b(\d[\d ]{4,8}\d)\b/);
  return m ? m[1].replace(/\s+/g, "") : undefined;
}

const { context, page } = await openSession(PLATFORM);
try {
  if (mode === "homework") {
    // Derive the homework page URL directly from the quiz detail URL — this is
    // more robust than clicking a "分配" button on the detail page.
    const homeworkUrl = quizUrl.replace(/\/admin\/quiz\/(?!homework\/)/, "/admin/quiz/homework/");
    await page.goto(homeworkUrl, { waitUntil: "domcontentloaded" });
    if (/\/login/.test(page.url())) {
      fail("not-logged-in", "尚未登入。請先執行 node scripts/pw/login.mjs。");
      await context.close();
      process.exit(1);
    }

    // 1) Practice mode card (default 練習).
    const practiceMode = arg("practice-mode") ?? "practice";
    const practiceRegex = PRACTICE_LABEL[practiceMode] ?? PRACTICE_LABEL.practice;
    await page.getByText(practiceRegex).first().click({ timeout: 15000 }).catch(() => {});

    // 2) Deadline quick-pick (default 1星期 for a sensible homework window).
    const deadlineArg = arg("deadline") ?? "1星期";
    const deadlineRegex = DEADLINE_LABEL[deadlineArg];
    const notes = [];
    if (deadlineRegex) {
      await page.getByText(deadlineRegex).first().click({ timeout: 10000 }).catch(() => {
        notes.push(`未能點選期限「${deadlineArg}」，沿用頁面預設。`);
      });
    } else {
      notes.push(`--deadline「${deadlineArg}」不是支援的快選（none/1天/1星期/2週）；自訂日期請人工用「編輯截止日期」設定。`);
    }

    // 3) Optional settings toggles (best-effort; on separate tabs).
    if (has("anti-cheat")) {
      await page.getByRole("tab", { name: /^反作弊$/ }).first().click({ timeout: 5000 }).catch(() => {});
      await page.getByText(/^反作弊監控$/).first().click({ timeout: 5000 }).catch(() => notes.push("未能開啟反作弊監控。"));
    }
    if (has("no-leaderboard") || has("music")) {
      await page.getByRole("tab", { name: /^遊戲化$/ }).first().click({ timeout: 5000 }).catch(() => {});
      if (has("no-leaderboard")) {
        await page.getByText(/^排行榜$/).first().click({ timeout: 5000 }).catch(() => notes.push("未能關閉排行榜。"));
      }
      if (has("music")) {
        await page.getByText(/^播放音樂$/).first().click({ timeout: 5000 }).catch(() => notes.push("未能開啟播放音樂。"));
      }
    }

    // 4) Confirm assignment: top-right pink "分配" action button (unique — the
    // top-left "分配" is a breadcrumb heading, not a button).
    const assignBtn = page.getByRole("button", { name: /^分配$/ }).first();
    await assignBtn.waitFor({ state: "visible", timeout: 15000 });
    await assignBtn.click();

    // Success evidence: lands on the classic activity page with a join code.
    await page.waitForURL(/\/admin\/activity\/classic\//i, { timeout: 30000 });
    const body = (await page.locator("body").innerText()).slice(0, 20000);
    const joinCode = extractCode(body);
    if (joinCode) {
      ok({
        assigned: true,
        mode: "homework",
        deadline: deadlineRegex ? deadlineArg : "頁面預設",
        practiceMode,
        joinCode,
        joinUrl: "https://joinmyquiz.com",
        pageUrl: page.url(),
        notes: notes.length ? notes : undefined,
        note: "作業已指派。學生到 joinmyquiz.com 輸入代碼即可加入，不需帳號。",
      });
    } else {
      await handoff(PLATFORM, page, "join-code-not-found", {
        hint: "作業可能已指派但未擷取到代碼。請開啟 resumeUrl 從畫面複製 joinmyquiz.com 代碼給學生。",
        notes,
      });
    }
    await context.close();
    process.exit(0);
  }

  // mode === "live-game" | "live": the "現在開始" path.
  await page.goto(quizUrl, { waitUntil: "domcontentloaded" });
  if (/\/login/.test(page.url())) {
    fail("not-logged-in", "尚未登入。請先執行 node scripts/pw/login.mjs。");
    await context.close();
    process.exit(1);
  }

  const startNow = page.getByRole("button", { name: /^現在開始$/i }).first();
  await startNow.waitFor({ state: "visible", timeout: 15000 });
  await startNow.click();

  const cardLabel = mode === "live-game" ? /^學生步調$/ : /^老師主導$/;
  const modeCard = page.getByText(cardLabel).first();
  await modeCard.waitFor({ state: "visible", timeout: 10000 });
  await modeCard.click();

  // "選擇會話模式" (game mode) screen. "經典" is always enabled.
  const classicCard = page.getByText(/^經典$/).first();
  await classicCard.waitFor({ state: "visible", timeout: 15000 });
  await classicCard.click();

  const headerStart = page.getByRole("button", { name: /^開始$/i }).first();
  await headerStart.waitFor({ state: "visible", timeout: 15000 });
  await headerStart.click();

  await page.waitForURL(/\/admin\/activity\/classic\//i, { timeout: 30000 }).catch(() => {});
  const body = (await page.locator("body").innerText()).slice(0, 20000);
  const joinCode = extractCode(body);
  if (joinCode) {
    ok({
      assigned: true,
      mode,
      joinCode,
      joinUrl: "https://joinmyquiz.com",
      note: "學生到 joinmyquiz.com 輸入代碼即可加入，不需帳號。",
      pageUrl: page.url(),
    });
  } else {
    await handoff(PLATFORM, page, "join-code-not-found", {
      hint: "指派動作可能已完成但未擷取到加入代碼。請開啟 resumeUrl 從畫面複製 joinmyquiz.com 代碼給學生。",
    });
  }
  await context.close();
} catch (err) {
  const msg = String(err?.message ?? err);
  await failWithDiagnostics(
    PLATFORM,
    page,
    msg,
    mode === "homework"
      ? "指派作業失敗。流程為：導到 /admin/quiz/homework/<id> → 選模式(練習) → 選期限 → 右上「分配」。請確認測驗已發布、登入正常後重試一次。"
      : "指派失敗。流程為：現在開始 → 學生步調/老師主導 → 經典 → 開始。請確認測驗已發布、登入正常後重試一次。",
  );
} finally {
  await context.close().catch(() => {});
}
