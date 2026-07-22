import { openSync, writeSync, closeSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { platformDir } from "./session-paths.mjs";
import { redactUrl } from "./contracts.mjs";

function lockPath(platform) {
  return path.join(platformDir(platform, "profile"), ".browser.lock");
}

function releaseLock(file) {
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

async function acquireLock(platform) {
  const filePath = lockPath(platform);
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

export const acquireProfileLock = acquireLock;
export function releaseProfileLock(lock) {
  releaseLock(lock);
}

export async function openSession(platform, { headless = false, viewport = { width: 1440, height: 900 } } = {}) {
  const lock = await acquireLock(platform);
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
    return { context, page, profileDir: platformDir(platform, "profile"), release: () => releaseLock(lock) };
  } catch (error) {
    releaseLock(lock);
    throw error;
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
