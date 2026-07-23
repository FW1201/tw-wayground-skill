// Deterministic, platform-neutral checks; duplicated deliberately so this
// standalone Skill remains portable without a sibling checkout.
const LEVELS = new Set(["remember", "understand", "apply", "analyze", "evaluate", "create"]);
const DIFFICULTIES = new Set(["basic", "developing", "proficient", "advanced"]);
const add = (list, code, message, questionIndex) => list.push({ code, message, ...(questionIndex ? { questionIndex } : {}) });
const text = (v) => String(v ?? "").trim();
export function legacyQualityReport(quiz) { return { ok: true, status: "legacy-unverified", blockers: [], warnings: [{ code: "legacy-input", message: "使用 --legacy：未提供命題 brief，來源、對象與藍圖均未驗證。" }], totalQuestions: quiz.questions.length, perQuestion: quiz.questions.map((q, i) => ({ index: i + 1, status: "unverified", type: q.type })) }; }
export function validateAssessmentQuiz(quiz) {
  const blockers = [], warnings = [], assessment = quiz.assessment;
  if (!assessment || assessment.version !== 1) { add(blockers, "assessment-missing", "需要 assessment.version=1 的命題 brief（來源、對象、目標與藍圖）。"); return { ok: false, status: "blocked", blockers, warnings, totalQuestions: quiz.questions.length, perQuestion: [] }; }
  const sources = Array.isArray(assessment.sources) ? assessment.sources : [], objectives = Array.isArray(assessment.objectives) ? assessment.objectives : [], blueprint = Array.isArray(assessment.blueprint) ? assessment.blueprint : [], audience = assessment.audience ?? {};
  if (!sources.length || sources.some((s) => !text(s.id) || !text(s.title) || !text(s.locator))) add(blockers, "sources-invalid", "每個來源都需要 id、title、locator。");
  if (!text(audience.gradeLevel) || !text(audience.proficiency) || !text(audience.language) || !Array.isArray(audience.prerequisites) || !audience.prerequisites.length || audience.prerequisites.some((item) => !text(item))) add(blockers, "audience-incomplete", "受測者需要年級、程度、語言與至少一項有效先備能力。");
  if (!objectives.length || objectives.some((o) => !text(o.id) || !text(o.text))) add(blockers, "objectives-invalid", "至少要有一個具 id 與文字的學習目標。");
  if (!text(assessment.purpose)) add(blockers, "purpose-missing", "命題 brief 必須說明測驗用途。");
  const expected = blueprint.reduce((n, row) => n + (Number.isInteger(row.count) && row.count > 0 ? row.count : 0), 0);
  if (!blueprint.length || expected !== quiz.questions.length) add(blockers, "blueprint-count-mismatch", `藍圖題數 ${expected} 必須等於測驗題數 ${quiz.questions.length}。`);
  const sourceIds = new Set(sources.map((s) => s.id)), objectiveIds = new Set(objectives.map((o) => o.id)), expectedCells = new Map(blueprint.map((b) => [`${b.objectiveId}|${b.cognitiveLevel}|${b.difficulty}`, b.count])), actualCells = new Map();
  for (const row of blueprint) if (!objectiveIds.has(row.objectiveId) || !LEVELS.has(row.cognitiveLevel) || !DIFFICULTIES.has(row.difficulty) || !Number.isInteger(row.count) || row.count <= 0) add(blockers, "blueprint-row-invalid", "每個藍圖列都需要已登錄目標、有效認知層次／難度與正整數題數。");
  const perQuestion = quiz.questions.map((q, i) => { const issues = [], sourceRefs = Array.isArray(q.sourceRefIds) ? q.sourceRefIds : [], objectiveRefs = Array.isArray(q.objectiveIds) ? q.objectiveIds : [];
    if (!sourceRefs.length || sourceRefs.some((id) => !sourceIds.has(id))) add(issues, "source-untraceable", "題目必須對應已登錄的來源。", i + 1);
    if (!objectiveRefs.length || objectiveRefs.some((id) => !objectiveIds.has(id))) add(issues, "objective-untraceable", "題目必須對應已登錄的學習目標。", i + 1);
    if (!LEVELS.has(q.cognitiveLevel)) add(issues, "cognitive-level-invalid", "題目需要有效的 cognitiveLevel。", i + 1);
    if (!DIFFICULTIES.has(q.difficulty)) add(issues, "difficulty-invalid", "題目需要有效的 difficulty。", i + 1);
    const correct = (q.options ?? []).filter((o) => o.correct).length;
    if (["multiple_choice", "true_false", "multiple_select"].includes(q.type) && correct === 0) add(issues, "answer-key-missing", "選擇題至少需要一個正解。", i + 1);
    if (q.type === "multiple_choice" && correct !== 1) add(issues, "multiple-choice-key-invalid", "單選題必須剛好一個正解。", i + 1);
    if (["multiple_choice", "multiple_select", "true_false"].includes(q.type) && !text(q.explanation)) warnings.push({ code: "explanation-missing", message: "建議每題提供 explanation，供教師複核與回饋。", questionIndex: i + 1 });
    const cell = `${objectiveRefs[0]}|${q.cognitiveLevel}|${q.difficulty}`; actualCells.set(cell, (actualCells.get(cell) ?? 0) + 1); blockers.push(...issues);
    return { index: i + 1, type: q.type, status: issues.length ? "blocked" : "ready", sourceRefIds: sourceRefs, objectiveIds: objectiveRefs, cognitiveLevel: q.cognitiveLevel, difficulty: q.difficulty, issues };
  });
  for (const [cell, count] of expectedCells) if ((actualCells.get(cell) ?? 0) !== count) add(blockers, "blueprint-cell-mismatch", `藍圖格 ${cell} 預期 ${count} 題，實際 ${(actualCells.get(cell) ?? 0)} 題。`);
  return { ok: blockers.length === 0, status: blockers.length ? "blocked" : "ready", blockers, warnings, totalQuestions: quiz.questions.length, perQuestion, blueprint: { expected: Object.fromEntries(expectedCells), actual: Object.fromEntries(actualCells) } };
}
