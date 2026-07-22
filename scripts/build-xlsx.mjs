#!/usr/bin/env node
// Build a Wayground/Quizizz-importable .xlsx from a quiz.json.
// Ported from edu-agent-kit packages/adapters/wayground/src/workbook.ts @ a7eaa0f
// Live-verified 2026-07-22 by real upload: edu-agent-kit's original
// "Fill in the Blank" (space-separated) does NOT match Wayground's parser,
// which silently defaults unrecognized Question Type strings to Multiple
// Choice — producing a "缺少答案選項"/"missing answer options" error since
// options 1-2 are left blank for fill_blank rows. Fixed to the exact string
// from the official template's own instructions: "Fill-in-the-Blank"
// (hyphenated). This diverges from edu-agent-kit's workbook.ts — flag this
// upstream if porting fixes back.
// Usage: node scripts/build-xlsx.mjs <quiz.json> <out.xlsx>
import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Quiz } from "./lib/models.mjs";

export const VALID_TIMES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300];
export const DEFAULT_TIME = 30;
export const MAX_OPTIONS = 5;
// Conservative thresholds for the "may be truncated on import" warning — not
// an official documented limit (Wayground doesn't publish per-cell character
// caps for the spreadsheet importer), so these are a deliberately cautious
// heuristic rather than a hard platform rule. Flag, don't guess a fix.
export const LONG_TEXT_WARN_CHARS = 500;

const TYPE_LABEL = {
  multiple_choice: "Multiple Choice",
  true_false: "Multiple Choice",
  multiple_select: "Checkbox",
  fill_blank: "Fill-in-the-Blank",
  short_answer: "Open-Ended",
  open_ended: "Open-Ended",
  poll: "Poll",
};

const plain = (text) => text.replace(/\s+/g, " ").trim();

function snapTime(seconds) {
  const t = seconds ?? DEFAULT_TIME;
  let best = VALID_TIMES[0];
  for (const v of VALID_TIMES) {
    if (Math.abs(v - t) < Math.abs(best - t)) best = v;
  }
  return best;
}

// Returns { ok, reason? } for a skipped question, or { ok: true, ...row
// fields, notes } for a mapped one. `notes` are non-fatal advisories (media
// type, long text, multi-blank) surfaced in both `warnings` and the readiness
// report — this is the safety net standing in for the removed
// import-and-preview Playwright step.
function mapQuestion(q, idx) {
  const notes = [];
  const type = TYPE_LABEL[q.type];
  if (!type) {
    return { ok: false, reason: `type '${q.type}' unsupported by Wayground import — skipped.` };
  }

  let options = q.options;
  if (q.type === "true_false") {
    const correctIsTrue = q.options.some(
      (o) => o.correct && /^(true|t|是|對|正確)$/i.test(o.text.trim()),
    );
    options = [
      { text: "True", correct: correctIsTrue },
      { text: "False", correct: !correctIsTrue },
    ];
  }
  // Fill-in-the-Blank does NOT use the "正確答案"/Correct Answer column.
  // Live-verified 2026-07-22 by real upload: Option 1 is required for every
  // question type except Open-Ended/Draw (per the official template's own
  // per-cell instructions), so accepted answers go into Option 1..5 instead.
  if (q.type === "fill_blank") {
    options = q.acceptedAnswers.map((a) => ({ text: a, correct: false }));
  }

  const isChoice =
    q.type === "multiple_choice" ||
    q.type === "multiple_select" ||
    q.type === "true_false" ||
    q.type === "poll";

  const usable = options.slice(0, MAX_OPTIONS);
  if (isChoice && usable.length < 2 && q.type !== "poll") {
    return { ok: false, reason: "fewer than 2 options — skipped." };
  }
  if (q.type === "fill_blank" && usable.length < 1) {
    return { ok: false, reason: "fill_blank has no accepted answers — skipped." };
  }
  if (options.length > MAX_OPTIONS) {
    notes.push(`Wayground allows max ${MAX_OPTIONS} options — extras dropped.`);
  }

  let correct = "";
  if (q.type === "multiple_choice" || q.type === "true_false") {
    const i = usable.findIndex((o) => o.correct);
    if (i < 0) {
      return { ok: false, reason: "no correct option marked — skipped." };
    }
    correct = String(i + 1);
  } else if (q.type === "multiple_select") {
    const idxs = usable.map((o, i) => (o.correct ? i + 1 : 0)).filter((n) => n > 0);
    if (idxs.length === 0) {
      return { ok: false, reason: "no correct options marked — skipped." };
    }
    correct = idxs.join(",");
  }
  // fill_blank: accepted answers now live in options (see above), no
  // Correct Answer value needed. open_ended / poll: no correct answer either.

  // Media: the xlsx importer only has an "Image Link" column. Video/audio/
  // link/drive_file/youtube media were previously dropped silently — now
  // flagged so the teacher knows to add it manually in the editor.
  const image = q.media?.kind === "image" ? q.media.url : "";
  if (q.media && q.media.kind !== "image") {
    notes.push(`media 類型 '${q.media.kind}' 不支援匯入（僅圖片有 Image Link 欄位）；需老師在編輯器手動補加。`);
  }

  const time = snapTime(q.timeLimitSeconds);
  if (q.timeLimitSeconds !== undefined && time !== q.timeLimitSeconds) {
    notes.push(`time ${q.timeLimitSeconds}s snapped to ${time}s (Wayground fixed tiers).`);
  }

  // Conservative long-text advisory — no documented per-cell limit exists to
  // check against, so this is a heuristic flag, not a hard validation.
  if (q.prompt.length > LONG_TEXT_WARN_CHARS) {
    notes.push(`題幹長度 ${q.prompt.length} 字，可能被 Wayground 匯入截斷，建議精簡。`);
  }
  usable.forEach((o, i) => {
    if (o.text.length > LONG_TEXT_WARN_CHARS) {
      notes.push(`選項 ${i + 1} 長度 ${o.text.length} 字，可能被 Wayground 匯入截斷，建議精簡。`);
    }
  });

  // Multi-blank fill_blank prompts: Wayground's single-row xlsx format can
  // only represent one blank per question (accepted answers all fill the
  // SAME blank). A prompt with more than one blank marker would silently
  // lose the extra blanks' distinctness on import.
  if (q.type === "fill_blank") {
    const blankCount = (q.prompt.match(/_{2,}|\[blank\]/gi) ?? []).length;
    if (blankCount > 1) {
      notes.push(`題幹含 ${blankCount} 個空格標記；Wayground 單列 xlsx 格式無法表示多個空格，匯入後僅會被視為單一填空題。`);
    }
  }

  return {
    ok: true,
    questionText: plain(q.prompt),
    type,
    options: usable.map((o) => plain(o.text)),
    correct,
    time,
    image,
    explanation: q.explanation ? plain(q.explanation) : "",
    notes,
  };
}

// Header verified against the official template (2026-07-22 live check):
// downloaded from the "試算表" tab's "下載模板" button at
// https://cf.quizizz.com/xlsx/QuizizzSampleSpreadsheetUpdated_v2.xlsx
// (sheet "Create a Quiz"). Column names match exactly; "Answer explanation"
// was missing from the original port and has been added.
export async function buildWaygroundWorkbook(quiz, outPath) {
  const warnings = [];
  const perQuestion = [];
  const wb = new ExcelJS.Workbook();
  wb.creator = "tw-wayground-skill";
  const ws = wb.addWorksheet("Quiz");

  ws.getRow(1).values = [
    "Question Text",
    "Question Type",
    "Option 1",
    "Option 2",
    "Option 3",
    "Option 4",
    "Option 5",
    "Correct Answer",
    "Time in seconds",
    "Image Link",
    "Answer explanation",
  ];
  ws.getRow(1).font = { bold: true };

  let rowNum = 2;
  let questionCount = 0;
  quiz.questions.forEach((q, idx) => {
    const r = mapQuestion(q, idx);
    if (!r.ok) {
      warnings.push(`Q${idx + 1}: ${r.reason}`);
      perQuestion.push({ index: idx + 1, status: "skipped", type: q.type, reason: r.reason });
      return;
    }
    r.notes.forEach((n) => warnings.push(`Q${idx + 1}: ${n}`));
    perQuestion.push({
      index: idx + 1,
      status: "ready",
      type: q.type,
      notes: r.notes.length ? r.notes : undefined,
    });

    const o = r.options;
    ws.getRow(rowNum).values = [
      r.questionText,
      r.type,
      o[0] ?? "",
      o[1] ?? "",
      o[2] ?? "",
      o[3] ?? "",
      o[4] ?? "",
      r.correct,
      r.time,
      r.image,
      r.explanation,
    ];
    rowNum += 1;
    questionCount += 1;
  });

  if (questionCount === 0) {
    warnings.push("No questions could be mapped to Wayground's supported types.");
  }

  ws.columns.forEach((col) => {
    col.width = 22;
  });

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);

  // Import readiness report: a structured, pre-upload checklist standing in
  // for the removed "auto-import and check the preview" Playwright step. The
  // teacher (or the agent, on their behalf) should read this before uploading
  // the xlsx, not discover skipped/flagged questions only after import fails.
  const skippedCount = perQuestion.filter((p) => p.status === "skipped").length;
  const flaggedCount = perQuestion.filter((p) => p.status === "ready" && p.notes).length;
  const readiness = {
    totalQuestions: quiz.questions.length,
    readyQuestions: questionCount,
    skippedQuestions: skippedCount,
    flaggedQuestions: flaggedCount,
    checklist: [
      `${questionCount}/${quiz.questions.length} 題已就緒可匯入。`,
      ...(skippedCount ? [`${skippedCount} 題因型別/欄位不足被跳過，需在編輯器手動補建（見 perQuestion 的 skipped 項目）。`] : []),
      ...(flaggedCount ? [`${flaggedCount} 題有非致命提醒（media 類型/長度/多空格等），上傳前建議先看過。`] : []),
    ],
    perQuestion,
  };
  const readinessPath = outPath.replace(/\.xlsx$/i, "") + ".readiness.json";
  await fs.writeFile(readinessPath, JSON.stringify(readiness, null, 2), "utf8");

  return { path: path.resolve(outPath), readinessReportPath: path.resolve(readinessPath), warnings, questionCount };
}

// CLI entry point only — guarded so buildWaygroundWorkbook can be imported
// (e.g. by tests/build-xlsx.test.mjs) without triggering argv parsing.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [, , input, output] = process.argv;
  if (!input || !output) {
    console.log(JSON.stringify({ ok: false, error: "usage", hint: "node scripts/build-xlsx.mjs <quiz.json> <out.xlsx>" }));
    process.exit(1);
  }
  try {
    const quiz = Quiz.parse(JSON.parse(await fs.readFile(input, "utf8")));
    const result = await buildWaygroundWorkbook(quiz, output);
    console.log(JSON.stringify({ ok: true, ...result, title: quiz.title }));
  } catch (err) {
    console.log(
      JSON.stringify({
        ok: false,
        error: String(err?.message ?? err),
        hint: "請確認 quiz.json 符合 Quiz schema（title + questions[]，每題 type/prompt/options）。",
      }),
    );
    process.exit(1);
  }
}
