/**
 * Measure and complete micro-experiments from persisted meals/sessions.
 */
import { completeExperiment, proposeExperiments } from "@/lib/engine/behavior/experiments";
import type { BehaviorExperiment, BehaviorTrigger } from "@/lib/engine/behavior/types";
import { todayKey, type AppState } from "@/lib/types";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 31) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

const PROTEIN_BREAKFAST_G = 20;

export function proteinBreakfastAdherence(state: AppState, start: string, end: string): number {
  const days = enumerateDays(start, end);
  if (!days.length) return 0;
  let hits = 0;
  for (const d of days) {
    const protein = (state.meals ?? [])
      .filter((m) => m.date.slice(0, 10) === d && m.slot === "cafe")
      .reduce((s, m) => s + m.proteinG, 0);
    if (protein >= PROTEIN_BREAKFAST_G) hits += 1;
  }
  return Math.round((hits / days.length) * 100) / 100;
}

export function expressWeekAdherence(state: AppState, start: string, end: string): number {
  const hits = (state.sessions ?? []).filter((s) => {
    const d = s.date.slice(0, 10);
    return d >= start && d <= end && (s.durationMin <= 35 || s.express === true);
  }).length;
  return Math.min(1, Math.round((hits / 3) * 100) / 100);
}

export function evaluateExperiment(state: AppState, exp: BehaviorExperiment, date: string): number {
  const end = minDate(date, exp.end);
  const target = exp.target.toLowerCase();
  if (target.includes("prote") || target.includes("caf")) {
    return proteinBreakfastAdherence(state, exp.start, end);
  }
  return expressWeekAdherence(state, exp.start, end);
}

export function settleExperiments(
  state: AppState,
  experiments: BehaviorExperiment[],
  date: string,
): BehaviorExperiment[] {
  return experiments.map((exp) => {
    if (exp.status !== "active") return exp;
    if (date < exp.end) return exp;
    const result = evaluateExperiment(state, exp, date);
    return completeExperiment(exp, result);
  });
}

export function resolveExperiments(
  state: AppState,
  triggers: BehaviorTrigger[],
  prior: BehaviorExperiment[] | undefined,
  date: string,
): BehaviorExperiment[] {
  const proposed = proposeExperiments(triggers, prior ?? [], date);
  return settleExperiments(state, proposed, date);
}

export function experimentLinkedIntervention(
  exp: BehaviorExperiment,
): "meal_swap" | "express_workout" {
  const target = exp.target.toLowerCase();
  if (target.includes("prote") || target.includes("caf")) return "meal_swap";
  return "express_workout";
}
