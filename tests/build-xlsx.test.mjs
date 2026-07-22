// Generator-correctness tests (replaces the pre-reduction browser-automation
// test suite — there is no more browser layer to test; the xlsx generator is
// now the entire product surface).
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildWaygroundWorkbook, LONG_TEXT_WARN_CHARS } from "../scripts/build-xlsx.mjs";
import { Quiz } from "../scripts/lib/models.mjs";

function tmpXlsx() {
  return path.join(os.tmpdir(), `wg-test-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
}

test("well-formed quiz: all questions ready, no warnings", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: "1+1=?", options: [{ text: "2", correct: true }, { text: "3", correct: false }] },
    ],
  });
  const outPath = tmpXlsx();
  const result = await buildWaygroundWorkbook(quiz, outPath);
  assert.equal(result.questionCount, 1);
  assert.deepEqual(result.warnings, []);
  const readiness = JSON.parse(await fs.readFile(result.readinessReportPath, "utf8"));
  assert.equal(readiness.readyQuestions, 1);
  assert.equal(readiness.skippedQuestions, 0);
});

test("unsupported type (matching) is skipped with a reason, not silently dropped", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [{ type: "matching", prompt: "match these", options: [] }],
  });
  const result = await buildWaygroundWorkbook(quiz, tmpXlsx());
  assert.equal(result.questionCount, 0);
  assert.ok(result.warnings[0].includes("unsupported by Wayground import"));
  const readiness = JSON.parse(await fs.readFile(result.readinessReportPath, "utf8"));
  assert.equal(readiness.perQuestion[0].status, "skipped");
});

test("non-image media produces an explicit warning instead of silently dropping", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      {
        type: "multiple_choice",
        prompt: "watch this",
        options: [{ text: "a", correct: true }, { text: "b", correct: false }],
        media: { kind: "video", url: "https://example.com/v.mp4" },
      },
    ],
  });
  const result = await buildWaygroundWorkbook(quiz, tmpXlsx());
  assert.ok(result.warnings.some((w) => w.includes("media 類型 'video' 不支援匯入")));
});

test("long question text triggers a truncation advisory", async () => {
  const longPrompt = "字".repeat(LONG_TEXT_WARN_CHARS + 1);
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "multiple_choice", prompt: longPrompt, options: [{ text: "a", correct: true }, { text: "b", correct: false }] },
    ],
  });
  const result = await buildWaygroundWorkbook(quiz, tmpXlsx());
  assert.ok(result.warnings.some((w) => w.includes("可能被 Wayground 匯入截斷")));
});

test("fill_blank with multiple blank markers warns that only one blank is representable", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "fill_blank", prompt: "光合作用需要 ___ 和 ___。", options: [], acceptedAnswers: ["陽光"] },
    ],
  });
  const result = await buildWaygroundWorkbook(quiz, tmpXlsx());
  assert.ok(result.warnings.some((w) => w.includes("無法表示多個空格")));
});

test("fill_blank with a single blank marker does not trigger the multi-blank warning", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "fill_blank", prompt: "光合作用需要 ___。", options: [], acceptedAnswers: ["陽光"] },
    ],
  });
  const result = await buildWaygroundWorkbook(quiz, tmpXlsx());
  assert.ok(!result.warnings.some((w) => w.includes("無法表示多個空格")));
});
