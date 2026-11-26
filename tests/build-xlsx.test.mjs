// Generator-correctness tests (replaces the pre-reduction browser-automation
// test suite — there is no more browser layer to test; the xlsx generator is
// now the entire product surface).
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildWaygroundWorkbook as rawBuildWaygroundWorkbook, LONG_TEXT_WARN_CHARS } from "../scripts/build-xlsx.mjs";
import { Quiz } from "../scripts/lib/models.mjs";
const buildWaygroundWorkbook = (quiz, outPath) => rawBuildWaygroundWorkbook(quiz, outPath, { legacy: true });

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

test("fill_blank with multiple blank markers is skipped instead of losing meaning", async () => {
  const quiz = Quiz.parse({
    title: "t",
    questions: [
      { type: "fill_blank", prompt: "光合作用需要 ___ 和 ___。", options: [], acceptedAnswers: ["陽光"] },
    ],
  });
  const result = await buildWaygroundWorkbook(quiz, tmpXlsx());
  assert.equal(result.questionCount, 0);
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


test("true_false preserves source labels and correct index",async()=>{const q=Quiz.parse({title:"t",questions:[{type:"true_false",prompt:"判斷",options:[{text:"錯誤",correct:false},{text:"正確",correct:true}]}]});const out=tmpXlsx();const result=await buildWaygroundWorkbook(q,out);const ExcelJS=(await import("exceljs")).default;const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(out);const row=wb.worksheets[0].getRow(2);assert.equal(row.getCell(3).value,"錯誤");assert.equal(row.getCell(4).value,"正確");assert.equal(row.getCell(8).value,"2");assert.match(result.warnings.join(),/非原生/)});
test("sixth option is not silently dropped",async()=>{const q=Quiz.parse({title:"t",questions:[{type:"multiple_choice",prompt:"p",options:[1,2,3,4,5,6].map(n=>({text:String(n),correct:n===6}))}]});const r=await buildWaygroundWorkbook(q,tmpXlsx());assert.equal(r.questionCount,0);assert.match(r.warnings.join(),/skipped/)});
test("CLI legacy output reports partial when source items are skipped",async()=>{const {spawnSync}=await import("node:child_process");const cli=new URL("../scripts/build-xlsx.mjs",import.meta.url);const fixture=new URL("./fixtures/quiz.json",import.meta.url);const r=spawnSync(process.execPath,[cli.pathname,fixture.pathname,tmpXlsx(),"--legacy"],{encoding:"utf8"});assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).status,"partial")});
