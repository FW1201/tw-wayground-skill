import { redactUrl } from "./contracts.mjs";

export async function gotoReady(page, url, { ready, timeoutMs = 60000, waitUntil = "domcontentloaded" } = {}) {
  await page.goto(url, { waitUntil, timeout: timeoutMs });
  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs }).catch(() => {});
  if (ready) await waitForCondition(ready, { timeoutMs, description: `page-ready:${redactUrl(url)}` });
  return page;
}

export async function waitForCondition(predicate, { timeoutMs = 30000, intervalMs = 100, description = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return true;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const error = new Error(`condition-timeout: ${description}`);
  error.cause = lastError;
  throw error;
}

export async function waitForLocator(locator, options = {}) {
  const { state = "visible", timeoutMs = 30000, description = "locator" } = options;
  await locator.waitFor({ state, timeout: timeoutMs });
  return locator;
}

export async function waitForStable(locator, { state = "visible", timeoutMs = 30000, stableForMs = 300, description = "stable-locator" } = {}) {
  await waitForLocator(locator, { state, timeoutMs, description });
  const initial = await locator.count();
  await waitForCondition(async () => (await locator.count()) === initial, { timeoutMs, intervalMs: 100, description });
  if (stableForMs > 0) await new Promise((resolve) => setTimeout(resolve, stableForMs));
  return locator;
}
