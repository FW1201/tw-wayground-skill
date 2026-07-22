// Backward-compatible facade for the shared Browser Core.
// Keep platform scripts importing this file while the implementation lives in
// browser-core so the four Skills can stay structurally aligned.
export { openSession, platformDir, ok, fail } from "./browser-core/session.mjs";
export { clickFirst, fillStrict, resolveLocator, countVisible } from "./browser-core/selectors.mjs";
export { gotoReady, waitForCondition, waitForLocator, waitForStable } from "./browser-core/navigation.mjs";
export { inspectAuth, requireAuthenticated, waitForAuthenticated, authManifest, platformAuthManifest } from "./browser-core/auth.mjs";
import { inspectAuth, platformAuthManifest } from "./browser-core/auth.mjs";
export { failWithDiagnostics, handoff, captureDiagnostics } from "./browser-core/diagnostics.mjs";
export { createRunState, updateRunState, recordStep, inputFingerprint } from "./browser-core/run-state.mjs";

export async function assertPlatformAuthenticated(page, platform) {
  const result = await inspectAuth(page, platformAuthManifest(platform));
  if (result.state !== "authenticated") {
    const error = new Error(`not-authenticated: ${result.state}`);
    error.code = result.state;
    error.auth = result;
    throw error;
  }
  return result;
}

export async function waitForUrl(page, pattern, timeoutMs = 30000) {
  await page.waitForURL(pattern, { timeout: timeoutMs });
}
