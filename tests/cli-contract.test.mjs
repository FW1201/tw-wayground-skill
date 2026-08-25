import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "scripts", "tw-edtech-wayground.mjs");
const run = (args) => spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });

test("doctor reports the local capability catalog without contacting a teaching platform", () => { const result = run(["doctor"]); assert.equal(result.status, 0, result.stderr); const out = JSON.parse(result.stdout); assert.equal(out.platform, "wayground"); assert.equal(out.catalogVersion, 1); assert.equal(out.chrome.checked, false); });
test("plan masks roster identities and returns a confirmation code", async () => { const dir = await mkdtemp(path.join(os.tmpdir(), "wayground-roster-")); const roster = path.join(dir, "students.roster.json"); await writeFile(roster, JSON.stringify([{ name: "王小明", email: "student@example.edu" }])); const result = run(["plan", "--action", "assignment.create", "--resource", "CANARY-assessment", "--roster", roster]); assert.equal(result.status, 0, result.stderr); const out = JSON.parse(result.stdout); assert.equal(out.risk, "high"); assert.match(out.confirmationCode, /^[a-f0-9]{16}$/); assert.deepEqual(out.studentData, { present: true, count: 1, preview: ["王** <s***@example.edu>"] }); assert.doesNotMatch(JSON.stringify(out), /student@example\.edu/); });
test("student-data action refuses a plan without a roster file", () => { const result = run(["plan", "--action", "assignment.create", "--resource", "CANARY-assessment"]); assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).error, "roster-required"); });
test("run refuses an unconfirmed external action before trying Chrome", () => { const result = run(["run", "--action", "assessment.import", "--resource", "CANARY-assessment"]); assert.equal(result.status, 1); const out = JSON.parse(result.stdout); assert.equal(out.error, "confirmation-required"); assert.equal(out.chromeChecked, false); });
test("high-risk run needs the plan confirmation and explicit impact acknowledgement", () => { const plan = JSON.parse(run(["plan", "--action", "assessment.publish", "--resource", "CANARY-assessment"]).stdout); const result = run(["run", "--action", "assessment.publish", "--resource", "CANARY-assessment", "--confirm-write", "--confirm-plan", plan.confirmationCode]); assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).error, "high-risk-confirmation-required"); });
test("run stops safely when the requested UI action has no recording", () => { const plan = JSON.parse(run(["plan", "--action", "assessment.import", "--resource", "CANARY-assessment"]).stdout); const result = run(["run", "--action", "assessment.import", "--resource", "CANARY-assessment", "--confirm-write", "--confirm-plan", plan.confirmationCode]); assert.equal(result.status, 1); const out = JSON.parse(result.stdout); assert.equal(out.error, "requires-recording"); assert.equal(out.externalWriteAttempted, false); });
