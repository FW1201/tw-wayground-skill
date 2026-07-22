import path from "node:path";
import { spawnSync } from "node:child_process";
import { recordStep } from "./run-state.mjs";

function parseJsonOutput(stdout) {
  const lines = String(stdout ?? "").trim().split("\n").filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines[index]); } catch {}
  }
  return undefined;
}

export function createTrackedRunner({ here, platform, getState }) {
  const externalWriteSteps = new Set([
    "upload-pptx", "add-activities", "save-and-code", "import-xlsx", "publish", "assign",
    "create-board", "seed-posts", "set-sharing", "create-activity", "set-assignment", "switch-template",
  ]);
  return async function runTracked(stepId, relPath, args) {
    const state = getState();
    const externalWrite = externalWriteSteps.has(stepId);
    if (state) {
      await recordStep(platform, state, stepId, "planned", { externalWrite });
      await recordStep(platform, state, stepId, "started", { externalWrite });
    }
    const res = spawnSync(process.execPath, [path.join(here, relPath), ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, ...(state ? { TW_EDU_RUN_ID: state.runId } : {}) },
    });
    const parsed = parseJsonOutput(res.stdout);
    const result = parsed ?? {
      ok: false,
      error: "no-json-output",
      hint: `子腳本 ${relPath} 未輸出可解析的 JSON（exit ${res.status}）。stderr: ${(res.stderr ?? "").slice(0, 400)}`,
    };
    if (state) {
      const status = result.ok
        ? "success-confirmed"
        : result.handoff || /ambiguous|timeout|browser-closed/i.test(String(result.error ?? ""))
          ? "ambiguous"
          : "failed-before-write";
      const effects = externalWrite && result.ok
        ? [...state.externalEffects, { stepId, status: "success-confirmed" }]
        : state.externalEffects;
      await recordStep(platform, state, stepId, status, {
        status: result.ok ? "running" : "failed",
        resumeUrl: result.resumeUrl,
        externalEffects: effects,
      });
    }
    return result;
  };
}
