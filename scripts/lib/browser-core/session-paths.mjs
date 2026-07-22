import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const BASE = path.join(os.homedir(), ".tw-edu-skills");

export function platformDir(platform, sub = "") {
  const dir = path.join(BASE, platform, sub);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
