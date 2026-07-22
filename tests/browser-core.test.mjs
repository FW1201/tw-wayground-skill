import test from "node:test";
import assert from "node:assert/strict";
import { redactUrl, normalizeError } from "../scripts/lib/browser-core/contracts.mjs";
import { clickFirst, resolveLocator } from "../scripts/lib/browser-core/selectors.mjs";
import { waitForCondition } from "../scripts/lib/browser-core/navigation.mjs";
import { inspectAuth, inspectAuthAcrossPages, authManifest } from "../scripts/lib/browser-core/auth.mjs";
import { createRunState, recordStep, inputFingerprint } from "../scripts/lib/browser-core/run-state.mjs";
import {
  acquireProfileLock,
  releaseProfileLock,
  browserModeFromEnv,
  cdpEndpointCandidates,
  createManagedCdpContext,
} from "../scripts/lib/browser-core/session.mjs";
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
  assert.equal(
    redactUrl("https://accounts.google.com/v3/signin/rejected?client_id=public-id&login_hint=teacher%40example.com&continue=https%3A%2F%2Fexample.test"),
    "https://accounts.google.com/v3/signin/rejected",
  );
  assert.equal(normalizeError(Object.assign(new Error("profile-in-use: 123"), { code: "profile-in-use" })), "profile-in-use");
});

test("browser mode defaults to CDP and rejects unknown modes", () => {
  assert.equal(browserModeFromEnv({}), "cdp");
  assert.equal(browserModeFromEnv({ TW_EDU_BROWSER_MODE: "playwright" }), "playwright");
  assert.throws(() => browserModeFromEnv({ TW_EDU_BROWSER_MODE: "stealth" }), /invalid-browser-mode/);
  assert.deepEqual(
    cdpEndpointCandidates({ TW_EDU_CDP_URL: "http://127.0.0.1:9333" }),
    ["http://127.0.0.1:9333", "http://127.0.0.1:9222", "http://127.0.0.1:9223"],
  );
  assert.throws(
    () => cdpEndpointCandidates({ TW_EDU_CDP_URL: "https://remote-browser.example" }),
    /cdp-endpoint-not-local/,
  );
});

test("managed CDP context closes only owned pages and can detach without closing them", async () => {
  let existingClosed = 0;
  let ownedClosed = 0;
  let releases = 0;
  const existingPage = { close: async () => { existingClosed += 1; } };
  const ownedPage = { close: async () => { ownedClosed += 1; } };
  const rawContext = { pages: () => [existingPage, ownedPage] };
  const managed = createManagedCdpContext(rawContext, [ownedPage], () => { releases += 1; });
  await managed.close();
  assert.equal(existingClosed, 0);
  assert.equal(ownedClosed, 1);
  assert.equal(releases, 1);

  const secondOwned = { close: async () => { ownedClosed += 1; } };
  const detached = createManagedCdpContext({ pages: () => [existingPage, secondOwned] }, [secondOwned], () => { releases += 1; });
  await detached.detach();
  assert.equal(ownedClosed, 1);
  assert.equal(releases, 2);
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

test("Google rejected sign-in is classified as a manual OAuth handoff", async () => {
  const page = {
    url: () => "https://accounts.google.com/v3/signin/rejected?client_id=public-id&login_hint=teacher%40example.com",
    getByText: () => locator({ visible: false }),
  };
  const auth = await inspectAuth(page, authManifest({ authenticatedUrlPatterns: [], authenticatedLocators: [] }));
  assert.equal(auth.state, "user-action-required");
  assert.equal(auth.reason, "oauth-browser-rejected");
  assert.equal(auth.url, "https://accounts.google.com/v3/signin/rejected");
});

test("context auth inspection prioritizes authenticated and OAuth rejection pages", async () => {
  const unknownPage = { url: () => "about:blank", getByText: () => locator({ visible: false }) };
  const rejectedPage = {
    url: () => "https://accounts.google.com/v3/signin/rejected?client_id=id",
    getByText: () => locator({ visible: false }),
  };
  const rejected = await inspectAuthAcrossPages({ pages: () => [unknownPage, rejectedPage] }, unknownPage, authManifest({}));
  assert.equal(rejected.state, "user-action-required");
  assert.equal(rejected.reason, "oauth-browser-rejected");

  const authenticatedPage = {
    url: () => "https://app.example.test/home",
    getByText: (pattern) => locator({ visible: pattern?.source?.includes("home") ?? false }),
  };
  const authenticated = await inspectAuthAcrossPages(
    { pages: () => [rejectedPage, authenticatedPage] },
    rejectedPage,
    authManifest({ authenticatedUrlPatterns: [/app\.example\.test\/home/], authenticatedLocators: [(page) => page.getByText(/home/i)] }),
  );
  assert.equal(authenticated.state, "authenticated");
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
