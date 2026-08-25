import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const value = (args, name) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const code = (plan) => createHash("sha256").update(JSON.stringify(plan)).digest("hex").slice(0, 16);
const maskName = (name = "") => name ? `${String(name).slice(0, 1)}**` : "（未提供姓名）";
const maskEmail = (email = "") => { const [local = "", domain = ""] = String(email).split("@"); return domain ? `${local.slice(0, 1) || "*"}***@${domain}` : "（未提供信箱）"; };
const emit = (payload) => { console.log(JSON.stringify(payload)); process.exitCode = 1; };

export async function guardStudentRosterPlan({ platform, root }) {
  const [command, ...args] = process.argv.slice(2);
  if (!['plan', 'run'].includes(command)) return false;
  const action = value(args, 'action'); const resource = value(args, 'resource');
  const catalog = JSON.parse(await readFile(path.join(root, 'capability-catalog.json'), 'utf8'));
  const definition = catalog.actions.find((item) => item.id === action);
  if (!definition?.requiresStudentData) return false;
  const roster = value(args, 'roster');
  if (!roster) { emit({ ok: false, error: 'roster-required', action, hint: '此動作涉及學生資料；請提供已受保護且不納入 Git 的 --roster 檔案。', externalWriteAttempted: false }); return true; }
  if (!path.basename(roster).endsWith('.roster.json')) { emit({ ok: false, error: 'roster-path-required', action, hint: '學生名單必須使用受 Git 忽略的 *.roster.json 檔案。', externalWriteAttempted: false }); return true; }
  let raw; let students;
  try { raw = await readFile(roster, 'utf8'); const parsed = JSON.parse(raw); students = Array.isArray(parsed) ? parsed : parsed.students; if (!Array.isArray(students)) throw new Error('名單 JSON 必須是陣列或 { students: [...] }。'); } catch (error) { emit({ ok: false, error: 'invalid-roster', hint: String(error.message ?? error) }); return true; }
  const base = { contractVersion: 1, platform, catalogVersion: catalog.version, action, resource, risk: definition.risk, studentDataPresent: true, studentCount: students.length };
  const rosterFingerprint = createHash('sha256').update(raw).digest('hex').slice(0, 16); const guardedCode = code({ ...base, rosterFingerprint });
  if (command === 'plan') { console.log(JSON.stringify({ ok: true, ...base, confirmationCode: guardedCode, rosterFingerprint, studentData: { present: true, count: students.length, preview: students.slice(0, 3).map((student) => `${maskName(student.name)} <${maskEmail(student.email ?? student.platformId)}>`), }, externalWriteAttempted: false })); return true; }
  if (value(args, 'confirm-plan') !== guardedCode) { emit({ ok: false, error: 'plan-confirmation-required', confirmationCode: guardedCode, rosterFingerprint, hint: '動作、資源或名單內容已變更；重新檢視 plan 後，以 --confirm-plan 提供確認碼。', externalWriteAttempted: false }); return true; }
  args[args.indexOf('--confirm-plan') + 1] = code(base); process.argv = [process.argv[0], process.argv[1], command, ...args]; return false;
}
