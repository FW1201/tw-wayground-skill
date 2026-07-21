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

function mapQuestion(q, idx, warnings) {
  const type = TYPE_LABEL[q.type];
  if (!type) {
    warnings.push(`Q${idx + 1}: type '${q.type}' unsupported by Wayground import — skipped.`);
    return null;
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
    warnings.push(`Q${idx + 1}: fewer than 2 options — skipped.`);
    return null;
  }
  if (q.type === "fill_blank" && usable.length < 1) {
    warnings.push(`Q${idx + 1}: fill_blank has no accepted answers — skipped.`);
    return null;
  }
  if (options.length > MAX_OPTIONS) {
    warnings.push(`Q${idx + 1}: Wayground allows max ${MAX_OPTIONS} options — extras dropped.`);
  }

  let correct = "";
  if (q.type === "multiple_choice" || q.type === "true_false") {
    const i = usable.findIndex((o) => o.correct);
    if (i < 0) {
      warnings.push(`Q${idx + 1}: no correct option marked — skipped.`);
      return null;
    }
    correct = String(i + 1);
  } else if (q.type === "multiple_select") {
    const idxs = usable.map((o, i) => (o.correct ? i + 1 : 0)).filter((n) => n > 0);
    if (idxs.length === 0) {
      warnings.push(`Q${idx + 1}: no correct options marked — skipped.`);
      return null;
    }
    correct = idxs.join(",");
  }
  // fill_blank: accepted answers now live in options (see above), no
  // Correct Answer value needed. open_ended / poll: no correct answer either.

  const image = q.media?.kind === "image" ? q.media.url : "";

  const time = snapTime(q.timeLimitSeconds);
  if (q.timeLimitSeconds !== undefined && time !== q.timeLimitSeconds) {
    warnings.push(
      `Q${idx + 1}: time ${q.timeLimitSeconds}s snapped to ${time}s (Wayground fixed tiers).`,
    );
  }

  return {
    questionText: plain(q.prompt),
    type,
    options: usable.map((o) => plain(o.text)),
    correct,
    time,
    image,
    explanation: q.explanation ? plain(q.explanation) : "",
  };
}

// Header verified against the official template (2026-07-22 live check):
// downloaded from the "試算表" tab's "下載模板" button at
// https://cf.quizizz.com/xlsx/QuizizzSampleSpreadsheetUpdated_v2.xlsx
// (sheet "Create a Quiz"). Column names match exactly; "Answer explanation"
// was missing from the original port and has been added.
export async function buildWaygroundWorkbook(quiz, outPath) {
  const warnings = [];
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
    const r = mapQuestion(q, idx, warnings);
    if (!r) return;
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
  return { path: path.resolve(outPath), warnings, questionCount };
}

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
