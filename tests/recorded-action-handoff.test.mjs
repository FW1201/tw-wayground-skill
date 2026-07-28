import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("recorded Wayground handoff documents a draft-only workflow", async () => {
  const skill = await fs.readFile(path.join(root, "SKILL.md"), "utf8");
  const handoff = await fs.readFile(path.join(root, "references/recorded-action-handoff.md"), "utf8");
  const oauth = await fs.readFile(path.join(root, "references/google-oauth-handoff.md"), "utf8");
  const text = `${skill}\n${handoff}\n${oauth}`;

  for (const phrase of ["quality.status=ready", "試算表", "簡報教材分支", "50 MB", "No file chosen", "Create resource", "/presentation/<id>/edit", "繼續", "Publish", "Assign", "Live"]) {
    assert.ok(text.includes(phrase), `missing documented guardrail: ${phrase}`);
  }
  assert.match(text, /發布控制前停止/);
  assert.match(text, /不能把錄製觸及發布按鈕當作發布成功/);
  assert.match(text, /正常 Chrome/);
  assert.match(text, /localhost CDP/);
  assert.match(text, /This browser or app may not be secure/);
  assert.match(text, /不再輸入任何憑證/);
  assert.match(text, /正常 Chrome 帳戶提示分支/);
  assert.match(text, /Sign in to wayground\.com with google\.com/);
  assert.match(text, /重新讀取頁面/);
  assert.match(text, /沒有「登入／註冊」/);
  assert.match(text, /6a681d45b9b859b2c15d6099/);
});
