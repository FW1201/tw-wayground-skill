import test from "node:test";
import assert from "node:assert/strict";
import { redactUrl, normalizeError } from "../scripts/lib/browser-core/contracts.mjs";
import { clickFirst, resolveLocator } from "../scripts/lib/browser-core/selectors.mjs";
import { waitForCondition } from "../scripts/lib/browser-core/navigation.mjs";
import { inspectAuth, authManifest } from "../scripts/lib/browser-core/auth.mjs";
import { createRunState, recordStep, inputFingerprint } from "../scripts/lib/browser-core/run-state.mjs";
import { acquireProfileLock, releaseProfileLock } from "../scripts/lib/browser-core/session.mjs";
import { platformDir } from "../scripts/lib/browser-core/session-paths.mjs";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

function locator({ count = 1, visible = true } = {}) {
  return {
    count: async () => count,
    first() { return this; },
    nth() { return this; },
    isVisible: async () => visible,
    click: async () => {},
  };
}

test("redacts credentials from URLs and classifies common failures", () => {
  assert.equal(redactUrl("https://example.test/?token=secret&x=1#frag"), "https://example.test/?x=1");
  assert.equal(normalizeError(Object.assign(new Error("profile-in-use: 123"), { code: "profile-in-use" })), "profile-in-use");
});

test("selector resolution rejects ambiguous candidates", async () => {
  await assert.rejects(
    resolveLocator({}, () => locator({ count: 2 }), "ambiguous button"),
    /selector-ambiguous/,
  );
  await assert.rejects(
    clickFirst({}, [() => locator({ count: 0 })], "missing button", 10),
    /selector-failure/,
  );
});

test("condition wait retries until a state becomes true", async () => {
  let attempts = 0;
  await waitForCondition(() => ++attempts >= 3, { timeoutMs: 500, intervalMs: 1 });
  assert.equal(attempts, 3);
});

test("auth requires both authenticated URL and DOM evidence", async () => {
  const page = {
    url: () => "https://app.example.test/home",
    getByText: (pattern) => locator({ visible: pattern?.source?.includes("home") ?? false }),
  };
  const auth = await inspectAuth(page, authManifest({
    authenticatedUrlPatterns: [/app\.example\.test\/home/],
    authenticatedLocators: [(p) => p.getByText(/home/i)],
  }));
  assert.equal(auth.state, "authenticated");
});

test("run state records confirmed steps and fingerprints input", async () => {
  const state = await createRunState("nearpod-test", { id: "unit-flow", version: 1 }, inputFingerprint({ a: 1 }));
  await recordStep("nearpod-test", state, "open", "success-confirmed");
  assert.deepEqual(state.completedSteps, ["open"]);
  assert.equal(state.inputFingerprint.length, 16);
});

test("profile lock rejects contention and recovers stale metadata", async () => {
  const platform = `unit-lock-${process.pid}`;
  const lockPath = path.join(platformDir(platform, "profile"), ".browser.lock");
  const first = await acquireProfileLock(platform);
  try {
    await assert.rejects(acquireProfileLock(platform), /profile-in-use/);
  } finally {
    releaseProfileLock(first);
  }
  writeFileSync(lockPath, JSON.stringify({ pid: 999999999, startedAt: new Date().toISOString() }));
  const recovered = await acquireProfileLock(platform);
  releaseProfileLock(recovered);
  try { unlinkSync(lockPath); } catch {}
});
