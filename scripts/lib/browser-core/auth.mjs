import { AUTH_STATES, redactUrl } from "./contracts.mjs";

async function visible(locator, timeout = 800) {
  try {
    return (await locator.count()) > 0 && await locator.first().isVisible({ timeout });
  } catch {
    return false;
  }
}

function matchesUrl(page, patterns = []) {
  const url = page.url();
  return patterns.some((pattern) => pattern instanceof RegExp ? pattern.test(url) : url.includes(pattern));
}

export async function inspectAuth(page, manifest) {
  const url = page.url();
  if (!url || url === "about:blank") return { state: "unknown", url };

  if (/accounts\.google\.com\/(?:v\d+\/)?signin\/rejected/i.test(url) ||
      await visible(page.getByText(/目前無法登入帳戶|couldn['’]t sign you in|browser or app may not be secure/i).first())) {
    return { state: "user-action-required", reason: "oauth-browser-rejected", url: redactUrl(url) };
  }

  if (await visible(page.getByText(manifest.challengeText ?? /captcha|verify you are human|two-factor|驗證碼|雙重驗證/i).first())) {
    return { state: "user-action-required", reason: "challenge", url: redactUrl(url) };
  }
  if (await visible(page.getByText(manifest.expiredText ?? /session expired|sign in again|登入已過期|重新登入/i).first())) {
    return { state: "expired", reason: "expired-message", url: redactUrl(url) };
  }
  if (matchesUrl(page, manifest.loginUrls ?? []) || await visible(page.getByText(manifest.loginText ?? /sign in|log in|登入/i).first())) {
    return { state: "login-required", reason: "login-evidence", url: redactUrl(url) };
  }

  const authenticated = matchesUrl(page, manifest.authenticatedUrlPatterns ?? []) &&
    await Promise.all((manifest.authenticatedLocators ?? []).map((make) => visible(make(page), 1200))).then((values) => values.some(Boolean));
  if (authenticated) return { state: "authenticated", url: redactUrl(url) };
  if (matchesUrl(page, manifest.authenticatedUrlPatterns ?? [])) return { state: "checking", reason: "url-without-dom-evidence", url: redactUrl(url) };
  return { state: "unknown", url: redactUrl(url) };
}

export async function inspectAuthAcrossPages(context, preferredPage, manifest) {
  const pages = [preferredPage, ...context.pages().filter((page) => page !== preferredPage)].filter(Boolean);
  const inspected = [];
  for (const page of pages) inspected.push({ page, ...(await inspectAuth(page, manifest)) });
  const priority = ["authenticated", "user-action-required", "expired", "login-required", "checking", "unknown"];
  for (const state of priority) {
    const matches = inspected.filter((item) => item.state === state);
    if (!matches.length) continue;
    if (state === "user-action-required") {
      return matches.find((item) => item.reason === "oauth-browser-rejected") ?? matches[0];
    }
    return matches[0];
  }
  return { page: preferredPage, state: "unknown", url: redactUrl(preferredPage?.url?.()) };
}

export async function waitForAuthenticated(context, page, manifest, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const inspected = await inspectAuthAcrossPages(context, page, manifest);
    last = inspected;
    if (inspected.state === "authenticated") return inspected;
    if (inspected.reason === "oauth-browser-rejected") {
      const error = new Error("oauth-browser-rejected");
      error.code = "oauth-browser-rejected";
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const error = new Error(`login-timeout: ${last?.state ?? "unknown"}`);
  error.code = last?.state === "user-action-required" ? "user-action-required" : "login-timeout";
  throw error;
}

export async function requireAuthenticated(page, manifest) {
  const result = await inspectAuth(page, manifest);
  if (result.state !== "authenticated") {
    const error = new Error(`not-authenticated: ${result.state}`);
    error.code = result.state;
    throw error;
  }
  return result;
}

export function authManifest({ entryUrl, loginUrls, authenticatedUrlPatterns, authenticatedLocators, loginText, challengeText, expiredText }) {
  return { entryUrl, loginUrls, authenticatedUrlPatterns, authenticatedLocators, loginText, challengeText, expiredText, states: AUTH_STATES };
}

export function platformAuthManifest(platform) {
  const manifests = {
    nearpod: {
      loginUrls: [/nearpod\.com\/login/i],
      authenticatedUrlPatterns: [/nearpod\.com\/(?:t\/)?(?:library|my-library|home)/i, /cc\.nearpod\.com\//i],
      authenticatedLocators: [
        (page) => page.getByText(/launch the lesson builder|my library|library|save & exit|teach/i).first(),
      ],
    },
    wayground: {
      loginUrls: [/wayground\.com\/login/i, /quizizz\.com\/login/i],
      authenticatedUrlPatterns: [/wayground\.com\/(?:admin|dashboard|quiz)/i, /quizizz\.com\/(?:admin|dashboard|quiz)/i],
      authenticatedLocators: [
        (page) => page.getByText(/建立|create|assessment|測驗|發布|publish/i).first(),
      ],
    },
    padlet: {
      loginUrls: [/padlet\.com\/(?:auth\/)?login/i],
      authenticatedUrlPatterns: [/padlet\.com\/(?:dashboard|home|w\/|[a-z0-9_-]+\/[^/]+)/i],
      authenticatedLocators: [
        (page) => page.getByText(/製作|make|dashboard|看板|分享|share|設定|settings/i).first(),
      ],
    },
    wordwall: {
      loginUrls: [/wordwall\.net\/login/i],
      authenticatedUrlPatterns: [/wordwall\.net\/(?:myactivities|community|create|resource|play|myresults)/i],
      authenticatedLocators: [
        (page) => page.getByText(/create|my activities|我的活動|建立|switch template|set assignment/i).first(),
      ],
    },
  };
  const manifest = manifests[platform];
  if (!manifest) throw new Error(`unknown-platform-auth-manifest: ${platform}`);
  return authManifest(manifest);
}
