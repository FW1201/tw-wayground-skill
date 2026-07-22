import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = ["auth.mjs", "chrome-launch.mjs", "contracts.mjs", "diagnostics.mjs", "navigation.mjs", "orchestrator.mjs", "run-state.mjs", "selectors.mjs", "session-paths.mjs", "session.mjs"];
const missing = required.filter((name) => !existsSync(path.join(root, "scripts", "lib", "browser-core", name)));
const scriptRoot = path.join(root, "scripts");
const mjsFiles = [];
const forbiddenWaitMethod = "waitFor" + "Timeout";
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.isFile() && entry.name.endsWith(".mjs")) mjsFiles.push(full);
  }
}
collect(scriptRoot);
const unwrappedWaits = mjsFiles.flatMap((file) => {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  return lines.flatMap((line, index) => new RegExp(`${forbiddenWaitMethod}\\s*\\(`).test(line) ? [`${path.relative(root, file)}:${index + 1}`] : []);
});
const ok = missing.length === 0 && unwrappedWaits.length === 0;
console.log(JSON.stringify({ ok, browserCoreFiles: required.length - missing.length, requiredFiles: required.length, missing, unwrappedWaits }));
if (!ok) process.exitCode = 1;
