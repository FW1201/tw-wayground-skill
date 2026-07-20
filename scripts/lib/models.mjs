// Ported from edu-agent-kit packages/core/src/models/{common,question,quiz}.ts @ a7eaa0f
// Keep field-compatible; edu-agent-kit remains the source of truth.
// Top-level .strict() relaxed to .passthrough() so JSON from newer
// edu-agent-kit versions with extra fields still validates.
import { z } from "zod";

export const MediaRef = z
  .object({
    kind: z.enum(["image", "video", "audio", "link", "drive_file", "youtube"]),
    url: z.string().url(),
    title: z.string().max(300).optional(),
    altText: z.string().max(500).optional(),
  })
  .passthrough();

export const QuestionType = z.enum([
  "multiple_choice",
  "multiple_select",
  "true_false",
  "fill_blank",
  "short_answer",
  "open_ended",
  "poll",
  "word_cloud",
  "matching",
  "ordering",
  "draw",
]);

export const AnswerOption = z
  .object({
    text: z.string().min(1).max(1000),
    correct: z.boolean().default(false),
    rationale: z.string().max(1000).optional(),
    media: MediaRef.optional(),
  })
  .passthrough();

export const Question = z
  .object({
    type: QuestionType,
    prompt: z.string().min(1).max(4000),
    options: z.array(AnswerOption).default([]),
    acceptedAnswers: z.array(z.string().min(1).max(1000)).default([]),
    explanation: z.string().max(4000).optional(),
    points: z.number().min(0).max(1000).default(1),
    timeLimitSeconds: z.number().int().min(5).max(7200).optional(),
    media: MediaRef.optional(),
    tags: z.array(z.string().max(60)).default([]),
  })
  .passthrough();

export const Quiz = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional(),
    subject: z.string().max(120).optional(),
    gradeLevel: z.string().min(1).max(40).optional(),
    language: z.string().min(2).max(10).default("zh-TW"),
    questions: z.array(Question).min(1),
  })
  .passthrough();
