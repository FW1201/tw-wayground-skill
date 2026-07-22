import { openSync, writeSync, closeSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { platformDir } from "./session-paths.mjs";
import { redactUrl } from "./contracts.mjs";

const BROWSER_MODES = new Set(["cdp", "playwright", "auto"]);

export function browserModeFromEnv(env = process.env) {
  const mode = String(env.TW_EDU_BROWSER_MODE ?? "cdp").trim().toLowerCase();
  if (!BROWSER_MODES.has(mode)) {
    const error = new Error(`invalid-browser-mode: ${mode}`);
    error.code = "invalid-browser-mode";
    throw error;
  }
  return mode;
}

export function cdpEndpointCandidates(env = process.env) {
  const endpoints = [...new Set([
    env.TW_EDU_CDP_URL,
    "http://127.0.0.1:9222",
    "http://127.0.0.1:9223",
  ].filter(Boolean))];
  for (const endpoint of endpoints) {
    let url;
    try { url = new URL(endpoint); } catch {}
    if (!url || url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
      const error = new Error(`cdp-endpoint-not-local: ${endpoint}`);
      error.code = "cdp-endpoint-not-local";
      throw error;
    }
  }
  return endpoints;
}

function profileLockPath(platform) {
  return path.join(platformDir(platform, "profile"), ".browser.lock");
}

function cdpLockPath() {
  return path.join(platformDir("browser", "cdp"), ".browser.lock");
}

function releaseLock(file) {
  if (!file || file.released) return;
  file.released = true;
  try { closeSync(file.fd); } catch {}
  try { unlinkSync(file.path); } catch {}
}

function readLock(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return undefined; }
}

function isProcessAlive(pid) {
  if (!pid || pid === process.pid) return pid === process.pid;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function acquireLockAt(filePath) {
  const createLock = (recovered = false) => {
    const fd = openSync(filePath, "wx", 0o600);
    writeSync(fd, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), ...(recovered ? { recovered: true } : {}) })}\n`);
    return { fd, path: filePath };
  };
  try {
    return createLock();
  } catch (error) {
    const previous = readLock(filePath);
    if (previous?.pid && !isProcessAlive(previous.pid)) {
      try { unlinkSync(filePath); } catch {}
      return createLock(true);
    }
    if (!previous) {
      // A process can be interrupted between creating the lock and writing its
      // metadata. Treat that exact malformed lock as stale, but never bypass a
      // valid live PID lock.
      try { unlinkSync(filePath); } catch {}
      return createLock(true);
    }
    const lockError = new Error(`profile-in-use: ${previous?.pid ?? "unknown"}`);
    lockError.code = "profile-in-use";
    lockError.cause = error;
    throw lockError;
  }
}

export function acquireProfileLock(platform) {
  return acquireLockAt(profileLockPath(platform));
}

export function releaseProfileLock(lock) {
  releaseLock(lock);
}

export function createManagedCdpContext(rawContext, initialOwnedPages = [], release = () => {}) {
  const ownedPages = new Set(initialOwnedPages);
  let finished = false;
  async function finish({ keepPages = false } = {}) {
    if (finished) return;
    finished = true;
    if (!keepPages) {
      for (const page of ownedPages) await page.close().catch(() => {});
    }
    release();
  }
  return {
    pages: () => rawContext.pages(),
    async newPage() {
      const page = await rawContext.newPage();
      ownedPages.add(page);
      return page;
    },
    close: () => finish(),
    detach: () => finish({ keepPages: true }),
    rawContext,
  };
}

async function openCdpSession(platform, endpoints) {
  const lock = await acquireLockAt(cdpLockPath());
  const failures = [];
  try {
    for (const endpoint of endpoints) {
      try {
        const browser = await chromium.connectOverCDP(endpoint, { timeout: 1500 });
        const rawContext = browser.contexts()[0];
        if (!rawContext) throw new Error("cdp-context-missing");
        const page = await rawContext.newPage();
        const context = createManagedCdpContext(rawContext, [page], () => releaseLock(lock));
        await page.bringToFront().catch(() => {});
        return {
          context,
          page,
          browserMode: "cdp",
          cdpEndpoint: endpoint,
          close: () => context.close(),
          detach: () => context.detach(),
        };
      } catch (error) {
        failures.push(`${endpoint}: ${String(error?.message ?? error).split("\n")[0]}`);
      }
    }
    const error = new Error(`cdp-unavailable: ${failures.join("; ")}`);
    error.code = "cdp-unavailable";
    error.endpoints = endpoints;
    throw error;
  } catch (error) {
    releaseLock(lock);
    throw error;
  }
}

async function openPlaywrightSession(platform, { headless, viewport }) {
  const lock = await acquireProfileLock(platform);
  try {
    const context = await chromium.launchPersistentContext(platformDir(platform, "profile"), {
      headless,
      viewport,
      locale: "zh-TW",
      colorScheme: "light",
    });
    const page = await context.newPage();
    await page.bringToFront().catch(() => {});
    context.on("close", () => releaseLock(lock));
    return {
      context,
      page,
      browserMode: "playwright",
      profileDir: platformDir(platform, "profile"),
      close: () => context.close(),
    };
  } catch (error) {
    releaseLock(lock);
    throw error;
  }
}

export async function openSession(platform, {
  mode = browserModeFromEnv(),
  cdpEndpoints = cdpEndpointCandidates(),
  headless = false,
  viewport = { width: 1440, height: 900 },
} = {}) {
  if (!BROWSER_MODES.has(mode)) {
    const error = new Error(`invalid-browser-mode: ${mode}`);
    error.code = "invalid-browser-mode";
    throw error;
  }
  if (mode === "cdp") return openCdpSession(platform, cdpEndpoints);
  if (mode === "playwright") return openPlaywrightSession(platform, { headless, viewport });
  try {
    return await openCdpSession(platform, cdpEndpoints);
  } catch (error) {
    if (error?.code === "profile-in-use") throw error;
    return openPlaywrightSession(platform, { headless, viewport });
  }
}

export function platformDirCompat(platform, sub) {
  return platformDir(platform, sub);
}

export { platformDir };

export function ok(data = {}) {
  console.log(JSON.stringify({ ok: true, ...data }));
}

export function fail(error, hint, extra = {}) {
  console.log(JSON.stringify({ ok: false, error: String(error?.code ?? error?.message ?? error), hint, ...extra }));
  process.exitCode = 1;
}

export function safeUrl(page) {
  return redactUrl(page?.url?.());
}
