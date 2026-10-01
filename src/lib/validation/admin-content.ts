import { z } from "zod";
import { sanitizeBio, sanitizePlainText } from "@/lib/validation/common";
import type { TrainingRules } from "@/lib/training/training-rules";
import type { ContentCollection, ContentProgram, Expert } from "@/lib/content/types";

const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((u) => u.startsWith("https://") || u.startsWith("/"), "URL deve ser https");

export const ExpertSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((s) => sanitizePlainText(s, 80)),
  bio: z
    .string()
    .max(2000)
    .transform((s) => sanitizeBio(s)),
  specialty: z
    .string()
    .trim()
    .max(120)
    .transform((s) => sanitizePlainText(s, 120)),
  verified: z.boolean(),
  active: z.boolean(),
  photoMediaId: z.string().trim().max(128).optional(),
  social: z.record(z.string().max(500)).optional(),
});

export const ContentProgramSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((s) => sanitizePlainText(s, 120)),
  description: z
    .string()
    .max(4000)
    .transform((s) => sanitizePlainText(s, 4000)),
  durationWeeks: z.number().int().min(1).max(52),
  sessionsPerWeek: z.number().int().min(1).max(7),
  expertIds: z.array(z.string().max(64)).max(20),
  published: z.boolean(),
  goal: z.string().max(40).optional(),
  level: z.string().max(40).optional(),
  coverMediaId: z.string().max(128).optional(),
  publishAt: z.string().max(40).optional(),
});

export const ContentCollectionSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((s) => sanitizePlainText(s, 120)),
  kind: z.string().trim().min(1).max(64),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
  expertId: z.string().max(64).optional(),
  coverMediaId: z.string().max(128).optional(),
});

const MuscleGroupSchema = z.enum([
  "peito",
  "costas",
  "pernas",
  "ombros",
  "biceps",
  "triceps",
  "core",
  "cardio",
]);

const SplitDaySchema = z.object({
  title: z.string().max(80),
  focus: z.string().max(120),
  groups: z.array(MuscleGroupSchema).min(1).max(8),
});

const GoalSchemeSchema = z.object({
  sets: z.number().int().min(1).max(20),
  reps: z.string().max(40),
  restSec: z.number().int().min(0).max(600),
  loadFactor: z.number().finite().min(0).max(5),
});

export const TrainingRulesSchema = z.object({
  splits: z.record(z.array(SplitDaySchema).max(14)),
  goalScheme: z.object({
    massa: GoalSchemeSchema,
    gordura: GoalSchemeSchema,
    performance: GoalSchemeSchema,
    saude: GoalSchemeSchema,
  }),
  levelFactor: z.object({
    iniciante: z.number().finite().min(0).max(5),
    intermediario: z.number().finite().min(0).max(5),
    avancado: z.number().finite().min(0).max(5),
  }),
});

export function parseExpert(input: unknown): Expert {
  return ExpertSchema.parse(input);
}

export function parseContentProgram(input: unknown): ContentProgram {
  return ContentProgramSchema.parse(input);
}

export function parseContentCollection(input: unknown): ContentCollection {
  return ContentCollectionSchema.parse(input);
}

export function parseTrainingRules(input: unknown): TrainingRules {
  const parsed = TrainingRulesSchema.parse(input);
  const splits: TrainingRules["splits"] = {};
  for (const [k, v] of Object.entries(parsed.splits)) {
    const n = Number(k);
    if (Number.isFinite(n)) splits[n] = v;
  }
  return {
    splits,
    goalScheme: parsed.goalScheme,
    levelFactor: parsed.levelFactor,
  };
}

/** Optional https helper for CMS URL maps (unused keys stripped elsewhere). */
export const OptionalHttpsUrlSchema = httpsUrl.optional();
