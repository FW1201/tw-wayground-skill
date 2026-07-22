import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { platformDir } from "./session-paths.mjs";

export function chromeLaunchArgs({ port = 9222, userDataDir = platformDir("browser", "chrome-profile") } = {}) {
  return [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ];
}

export function resolveChromePath({ env = process.env, platform = process.platform, exists = existsSync } = {}) {
  if (env.TW_EDU_CHROME_PATH) return env.TW_EDU_CHROME_PATH;
  const candidates = platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
      ]
    : platform === "win32"
      ? [
          path.join(env.PROGRAMFILES ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
          path.join(env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
        ]
      : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];
  const found = candidates.find((candidate) => candidate && exists(candidate));
  if (found) return found;
  const error = new Error("chrome-not-found");
  error.code = "chrome-not-found";
  throw error;
}

export function startChrome({ env = process.env, port = Number(env.TW_EDU_CDP_PORT ?? 9222), userDataDir } = {}) {
  const chromePath = resolveChromePath({ env });
  const profileDir = userDataDir ?? platformDir("browser", "chrome-profile");
  const child = spawn(chromePath, chromeLaunchArgs({ port, userDataDir: profileDir }), {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return { pid: child.pid, port, profileDir, endpoint: `http://127.0.0.1:${port}` };
}
