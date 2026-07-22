import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { platformDir } from "./session-paths.mjs";
import { STEP_STATES, redactUrl } from "./contracts.mjs";

export function createRunId() {
  return `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
}

export function runDir(platform, runId) {
  return platformDir(platform, path.join("runs", runId));
}

export async function createRunState(platform, flow, inputFingerprint = undefined) {
  const runId = createRunId();
  const state = {
    runId,
    platform,
    flow,
    flowVersion: flow?.version ?? "unknown",
    inputFingerprint,
    status: "running",
    currentStep: null,
    completedSteps: [],
    externalEffects: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveRunState(platform, state);
  return state;
}

export async function saveRunState(platform, state) {
  const dir = runDir(platform, state.runId);
  const safe = {
    ...state,
    resumeUrl: redactUrl(state.resumeUrl),
    updatedAt: new Date().toISOString(),
  };
  const file = path.join(dir, "state.json");
  const temp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temp, `${JSON.stringify(safe, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temp, file);
  return safe;
}

export async function updateRunState(platform, state, patch = {}) {
  Object.assign(state, patch);
  return saveRunState(platform, state);
}

export async function recordStep(platform, state, stepId, status, extra = {}) {
  if (!STEP_STATES.includes(status)) throw new Error(`invalid-step-state: ${status}`);
  Object.assign(state, extra);
  state.currentStep = stepId;
  state.stepStatus = status;
  if (status === "success-confirmed" && !state.completedSteps.includes(stepId)) {
    state.completedSteps.push(stepId);
  }
  await saveRunState(platform, state);
  return state;
}

export function inputFingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
