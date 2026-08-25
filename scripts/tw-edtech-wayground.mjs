#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Quiz } from "./lib/models.mjs";
import { validateAssessmentQuiz } from "./lib/assessment-quality.mjs";
import { runEdtechCli } from "./lib/edtech-cli.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await runEdtechCli({
  platform: "wayground",
  root,
  validate: async (input) => {
    const quiz = Quiz.parse(JSON.parse(await readFile(input, "utf8")));
    return { title: quiz.title, quality: validateAssessmentQuiz(quiz) };
  },
});
