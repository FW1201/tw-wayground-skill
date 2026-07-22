import { waitForLocator } from "./navigation.mjs";

export function selectorError(code, description, details = {}) {
  const error = new Error(`${code}: ${description}`);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export async function resolveLocator(page, candidate, description, { timeoutMs = 8000, allowMultiple = false } = {}) {
  const locator = typeof candidate === "function" ? candidate(page) : candidate;
  const count = await locator.count();
  if (count === 0) throw selectorError("selector-not-found", description);
  if (count > 1 && !allowMultiple) throw selectorError("selector-ambiguous", description, { count });
  await waitForLocator(locator.first(), { state: "visible", timeoutMs, description });
  return locator.first();
}

export async function clickFirst(page, candidates, description, timeoutMs = 8000) {
  const failures = [];
  for (const candidate of candidates) {
    try {
      const locator = await resolveLocator(page, candidate, description, { timeoutMs });
      await locator.click({ timeout: timeoutMs });
      return true;
    } catch (error) {
      failures.push({ code: error.code ?? "click-failure", message: String(error.message) });
      if (error.code === "selector-ambiguous") throw error;
    }
  }
  throw selectorError("selector-failure", description, { failures });
}

export async function fillStrict(page, candidate, value, description, options = {}) {
  const locator = await resolveLocator(page, candidate, description, options);
  await locator.fill(value);
  return locator;
}

export async function countVisible(locator) {
  const count = await locator.count();
  let visibleCount = 0;
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) visibleCount += 1;
  }
  return visibleCount;
}
