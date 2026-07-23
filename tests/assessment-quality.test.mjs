import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAssessmentQuiz } from "../scripts/lib/assessment-quality.mjs";

test("quality validator requires a complete assessment brief before import generation", () => {
  const result = validateAssessmentQuiz({ title: "t", questions: [] });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((b) => b.code === "assessment-missing"));
});

test("quality validator rejects malformed blueprint rows", () => {
  const result = validateAssessmentQuiz({ title: "t", assessment: { version: 1, sources: [{ id: "s", title: "t", locator: "p1" }], audience: { gradeLevel: "五年級", proficiency: "基礎", language: "zh-TW", prerequisites: [""] }, objectives: [{ id: "o", text: "目標" }], purpose: "formative", blueprint: [{ objectiveId: "x", cognitiveLevel: "bad", difficulty: "bad", count: 0 }] }, questions: [] });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((b) => b.code === "blueprint-row-invalid"));
});
