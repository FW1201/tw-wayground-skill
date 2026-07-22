#!/usr/bin/env node
// One-command orchestrator for the Wayground chain. Sequences the existing
// single-purpose scripts and stops at the FIRST failure — it does not
// re-implement any step, so every script's stop-on-mismatch safety is
// preserved. Two stages keep the one intentional human checkpoint (confirming
// what will be published/assigned) as a single interaction:
//
//   node scripts/run.mjs <quiz.json> --stage prepare
//     build-xlsx -> import-xlsx (needs login). Prints editorUrl + a summary of
//     what WILL be published/assigned. NO external write happens yet.
//
//   node scripts/run.mjs <quiz.json> --stage deliver --editor-url <url> \
//     --name "..." [--subject 科學] [--grade 7年級] [--visibility restricted] \
//     --mode homework [--deadline 1週]
//     publish -> assign. Prints the final join code / share link.
//
// The agent runs `prepare`, relays the summary to the teacher for confirmation
// (external-write gate), then runs `deliver` with the confirmed parameters.
// File upload inside import-xlsx is fully automated (setInputFiles) — no manual
// drag. The only manual steps are login (preflight) and this confirmation.
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { platformDir, createRunState, inputFingerprint } from "./lib/session.mjs";
import { createTrackedRunner } from "./lib/browser-core/orchestrator.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM = "wayground";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(name) {
  return process.argv.includes(`--${name}`);
}
function out(obj) {
  console.log(JSON.stringify(obj));
}

let runState;
const runTracked = createTrackedRunner({ here: HERE, platform: PLATFORM, getState: () => runState });

// Run a sibling script with node, return the parsed last JSON line of stdout.
function runScript(relPath, args) {
  const res = spawnSync(process.execPath, [path.join(HERE, relPath), ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const stdout = (res.stdout ?? "").trim();
  const lines = stdout.split("\n").filter(Boolean);
  let parsed;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      parsed = JSON.parse(lines[i]);
      break;
    } catch {
      // not a JSON line, keep scanning upward
    }
  }
  if (!parsed) {
    return {
      ok: false,
      error: "no-json-output",
      hint: `子腳本 ${relPath} 未輸出可解析的 JSON（exit ${res.status}）。stderr: ${(res.stderr ?? "").slice(0, 400)}`,
    };
  }
  return parsed;
}

const quizPath = process.argv[2];
const stage = arg("stage");
if (!quizPath || !["prepare", "deliver"].includes(stage)) {
  out({
    ok: false,
    error: "usage",
    hint: "node scripts/run.mjs <quiz.json> --stage prepare | --stage deliver --editor-url <url> --name \"...\" [--subject][--grade][--visibility][--mode][--deadline]",
  });
  process.exit(1);
}

try {
  const quiz = JSON.parse(await fs.readFile(quizPath, "utf8"));

  if (stage === "prepare") {
    const xlsxPath = path.join(platformDir(PLATFORM, "tmp"), `quiz-${Date.now()}.xlsx`);

    runState = await createRunState(PLATFORM, { id: "wayground-prepare", version: 1 }, inputFingerprint(quiz));
    const built = await runTracked("build-xlsx", "build-xlsx.mjs", [quizPath, xlsxPath]);
    if (!built.ok) {
      out({ ok: false, stage, step: "build-xlsx", ...built });
      process.exit(1);
    }

    const imported = await runTracked("import-xlsx", "pw/import-xlsx.mjs", [
      xlsxPath,
      "--expect-questions",
      String(built.questionCount ?? quiz.questions?.length ?? ""),
    ]);
    if (!imported.ok) {
      out({ ok: false, stage, step: "import-xlsx", ...imported });
      process.exit(1);
    }

    out({
      ok: true,
      stage: "prepare",
      runId: runState.runId,
      editorUrl: imported.editorUrl,
      title: quiz.title,
      questionCount: built.questionCount,
      warnings: built.warnings?.length ? built.warnings : undefined,
      confirm: {
        name: quiz.title,
        visibilityDefault: "restricted",
        modeDefault: "homework",
        note: "科目/年級/能見度/指派模式/期限由老師確認後再帶入 deliver。",
      },
      next: `老師確認後執行：node scripts/run.mjs ${quizPath} --stage deliver --editor-url ${imported.editorUrl} --name "${quiz.title}" --mode homework --deadline 1週`,
    });
    process.exit(0);
  }

  // stage === "deliver"
  const editorUrl = arg("editor-url");
  const name = arg("name") ?? quiz.title;
  if (!editorUrl) {
    out({ ok: false, stage, error: "missing-editor-url", hint: "deliver 需要 --editor-url（來自 prepare 的輸出）。" });
    process.exit(1);
  }

  const publishArgs = ["--editor-url", editorUrl, "--name", name];
  for (const k of ["subject", "grade", "visibility"]) {
    const v = arg(k);
    if (v) publishArgs.push(`--${k}`, v);
  }
  runState = await createRunState(PLATFORM, { id: "wayground-deliver", version: 1 }, inputFingerprint({ editorUrl, name, mode: arg("mode") }));
  const published = await runTracked("publish", "pw/publish.mjs", publishArgs);
  if (!published.ok) {
    out({ ok: false, stage, step: "publish", ...published });
    process.exit(1);
  }

  const mode = arg("mode") ?? "homework";
  const assignArgs = ["--quiz-url", published.quizUrl, "--mode", mode];
  const deadline = arg("deadline");
  if (deadline) assignArgs.push("--deadline", deadline);
  const practiceMode = arg("practice-mode");
  if (practiceMode) assignArgs.push("--practice-mode", practiceMode);
  for (const flag of ["anti-cheat", "no-leaderboard", "music"]) {
    if (has(flag)) assignArgs.push(`--${flag}`);
  }
  const assigned = await runTracked("assign", "pw/assign.mjs", assignArgs);
  if (!assigned.ok) {
    out({ ok: false, stage, step: "assign", quizUrl: published.quizUrl, ...assigned });
    process.exit(1);
  }

  out({
    ok: true,
    stage: "deliver",
    runId: runState.runId,
    quizUrl: published.quizUrl,
    mode: assigned.mode,
    joinCode: assigned.joinCode,
    joinUrl: assigned.joinUrl,
    shareUrl: assigned.shareUrl,
    deadline: assigned.deadline,
    visibilityWarning: published.visibilityWarning,
    note: "完整鏈完成。把 joinUrl + joinCode（或 shareUrl）交給學生即可。",
  });
} catch (err) {
  out({
    ok: false,
    stage,
    error: String(err?.message ?? err),
    hint: "請確認 quiz.json 路徑與內容，以及先跑過 preflight 確認登入。",
  });
  process.exit(1);
}
