#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Quiz } from "./lib/models.mjs";
import { validateAssessmentQuiz } from "./lib/assessment-quality.mjs";
import { runLessonCommand } from "./portable-core/lesson-command.mjs";
import { runRuntimeCommand } from "./portable-core/runtime-command.mjs";
import { runEdtechCli } from "./lib/edtech-cli.mjs";
import { guardStudentRosterPlan } from "./lib/student-roster-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const needsProtectedRoster = async () => {
  const [command, ...args] = process.argv.slice(2);
  const action = args[args.indexOf("--action") + 1];
  const rosterIndex = args.indexOf("--roster");
  const roster = rosterIndex >= 0 ? args[rosterIndex + 1] : undefined;
  const catalog = JSON.parse(await readFile(path.join(root, "capability-catalog.json"), "utf8"));
  return ["plan", "run"].includes(command) && catalog.actions.find((item) => item.id === action)?.requiresStudentData && !roster;
};
if (process.argv[2] === "lesson") {
  const report = await runLessonCommand(process.argv.slice(3));
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
} else if (process.argv[2] === "runtime") {
  const report = await runRuntimeCommand("wayground", process.argv.slice(3));
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
} else if (await guardStudentRosterPlan({ platform: "wayground", root })) {
  // The guard emitted a roster-bound plan or a fail-closed diagnostic.
} else if (await needsProtectedRoster()) {
  console.log(JSON.stringify({ ok: false, error: "roster-required", hint: "此動作涉及學生資料；請提供已受保護且不納入 Git 的 --roster 檔案。", externalWriteAttempted: false }));
  process.exitCode = 1;
} else await runEdtechCli({
  platform: "wayground",
  root,
  validate: async (input) => {
    const quiz = Quiz.parse(JSON.parse(await readFile(input, "utf8")));
    return { title: quiz.title, quality: validateAssessmentQuiz(quiz) };
  },
});
