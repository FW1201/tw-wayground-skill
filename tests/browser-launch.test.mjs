import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { chromeLaunchArgs, resolveChromePath } from "../scripts/lib/browser-core/chrome-launch.mjs";

test("Chrome launch uses a dedicated profile without automation evasion flags", () => {
  const profile = path.join("/tmp", "tw-edu-chrome-test");
  const args = chromeLaunchArgs({ port: 9333, userDataDir: profile });
  assert.ok(args.includes("--remote-debugging-port=9333"));
  assert.ok(args.includes(`--user-data-dir=${profile}`));
  assert.equal(args.some((arg) => /enable-automation|disable-blink-features|no-sandbox/i.test(arg)), false);
});

test("Chrome path can be explicitly configured", () => {
  assert.equal(
    resolveChromePath({ env: { TW_EDU_CHROME_PATH: "/Applications/Custom Chrome" }, platform: "darwin", exists: () => true }),
    "/Applications/Custom Chrome",
  );
});
