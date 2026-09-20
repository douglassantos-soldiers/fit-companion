/**
 * Typed behavioral patterns for Learning Loop (FASE 5).
 * Rule-based / statistical thresholds — no ML. Isolated observations stay candidate.
 */
import {
  evidenceLooksClinical,
  isAllowedPatternKind,
  sanitizeEvidenceNote,
} from "@/lib/engine/learning-guardrails";
import { extractUserPatterns, type UserPatterns } from "@/lib/engine/user-patterns";
import { todayKey, type AppState } from "@/lib/types";

export type PatternKind =
  | "weekday_skip"
  | "avoids_long_workouts"
  | "weekend_protein_drop"
  | "sunday_meal_gap"
  | "prefers_short_sessions"
  | "poor_sleep_after_late_train"
  | "volume_reduction_helps";

export type PatternStatus = "candidate" | "active" | "decayed" | "blocked";

export type PatternEvidence = {
  date: string;
  note: string;
};

export type LearnedPattern = {
  kind: PatternKind;
  status: PatternStatus;
  confidence: number;
  evidenceCount: number;
  minObservations: number;
  lastObservedAt: string;
  evidence: PatternEvidence[];
  successfulOutcomes: number;
  failedOutcomes: number;
};

export type PatternsBlobV2 = {
  version: 2;
  legacy: UserPatterns;
  patterns: LearnedPattern[];
};

export const PATTERN_MIN_OBS: Record<PatternKind, number> = {
  weekday_skip: 8,
  avoids_long_workouts: 6,
  prefers_short_sessions: 6,
  weekend_protein_drop: 4,
  sunday_meal_gap: 4,
  volume_reduction_helps: 3,
  poor_sleep_after_late_train: 4,
};

const DECAY_DAYS = 30;

function emptyPattern(kind: PatternKind, now: string): LearnedPattern {
  return {
    kind,
    status: "candidate",
    confidence: 0.35,
    evidenceCount: 0,
    minObservations: PATTERN_MIN_OBS[kind],
    lastObservedAt: now,
    evidence: [],
    successfulOutcomes: 0,
    failedOutcomes: 0,
  };
}

function pushEvidence(p: LearnedPattern, date: string, note: string): LearnedPattern {
  if (evidenceLooksClinical(note)) {
    return { ...p, status: "blocked", lastObservedAt: date };
  }
  const evidence = [...p.evidence, { date, note: sanitizeEvidenceNote(note) }].slice(-10);
  const evidenceCount = p.evidenceCount + 1;
  let confidence = Math.min(0.92, 0.35 + evidenceCount * 0.06);
  const successTotal = p.successfulOutcomes + p.failedOutcomes;
  if (successTotal > 0) {
    confidence = Math.min(
      0.95,
      0.4 + (p.successfulOutcomes / successTotal) * 0.45 + Math.min(0.15, evidenceCount * 0.02),
    );
  }
  let status: PatternStatus = p.status === "blocked" ? "blocked" : "candidate";
  if (status !== "blocked" && evidenceCount >= p.minObservations && confidence >= 0.55) {
    status = "active";
  }
  return {
    ...p,
    evidence,
    evidenceCount,
    confidence: Math.round(confidence * 1000) / 1000,
    status,
    lastObservedAt: date,
  };
}

function maybeDecay(p: LearnedPattern, now: string): LearnedPattern {
  if (p.status === "blocked") return p;
  const last = Date.parse(p.lastObservedAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(last) || !Number.isFinite(nowMs)) return p;
  const days = (nowMs - last) / 86_400_000;
  if (days > DECAY_DAYS && p.status === "active") {
    return { ...p, status: "decayed", confidence: Math.max(0.35, p.confidence - 0.15) };
  }
  return p;
}

function upsert(
  map: Map<PatternKind, LearnedPattern>,
  kind: PatternKind,
  date: string,
  note: string,
): void {
  if (!isAllowedPatternKind(kind)) return;
  const prev = map.get(kind) ?? emptyPattern(kind, date);
  map.set(kind, pushEvidence(prev, date, note));
}

/** Extract / refresh learned patterns from AppState (+ optional prior blob). */
export function extractLearnedPatterns(
  state: AppState,
  prior?: LearnedPattern[] | null,
  date = todayKey(),
): LearnedPattern[] {
  const map = new Map<PatternKind, LearnedPattern>();
  for (const p of prior ?? []) {
    if (isAllowedPatternKind(p.kind)) map.set(p.kind, maybeDecay({ ...p }, date));
  }

  const legacy = extractUserPatterns(state);
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  // Weekday skip
  if (state.sessions.length >= 4 && legacy.weakestWeekday != null) {
    const counts = Object.values(legacy.weekdaySessionCounts);
    const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
    const weak = legacy.weekdaySessionCounts[legacy.weakestWeekday] ?? 0;
    if (weak < avg * 0.55) {
      // Count how many "weeks" of signal approximately by session span
      const obs = Math.min(state.sessions.length, 12);
      let p = map.get("weekday_skip") ?? emptyPattern("weekday_skip", date);
      // Sync evidence count toward session-based observations without double-counting wildly
      while (p.evidenceCount < Math.min(obs, PATTERN_MIN_OBS.weekday_skip + 2) && weak < avg * 0.55) {
        p = pushEvidence(
          p,
          date,
          `Treina menos na ${names[legacy.weakestWeekday]} (${weak} vs média ${avg.toFixed(1)}).`,
        );
        if (p.evidenceCount >= PATTERN_MIN_OBS.weekday_skip + 2) break;
        // Only one push per extract call for incremental updates when prior exists
        if ((prior?.length ?? 0) > 0) break;
      }
      // Fresh extract without prior: seed enough evidence from history
      if (!(prior?.length) && state.sessions.length >= 8) {
        p = emptyPattern("weekday_skip", date);
        for (let i = 0; i < Math.min(state.sessions.length, 10); i++) {
          p = pushEvidence(
            p,
            date,
            `Histórico: dia fraco ${names[legacy.weakestWeekday!]}.`,
          );
        }
      }
      map.set("weekday_skip", p);
    }
  }

  // Long workout avoidance / prefers short
  const longSessions = state.sessions.filter((s) => s.durationMin >= 75).length;
  const shortSessions = state.sessions.filter((s) => s.durationMin > 0 && s.durationMin < 45).length;
  const midSessions = state.sessions.filter((s) => s.durationMin >= 45 && s.durationMin < 75).length;

  if (state.sessions.length >= 6 && longSessions < shortSessions * 0.3) {
    let p = map.get("avoids_long_workouts") ?? emptyPattern("avoids_long_workouts", date);
    if (!(prior?.length)) {
      p = emptyPattern("avoids_long_workouts", date);
      for (let i = 0; i < Math.min(state.sessions.length, 8); i++) {
        p = pushEvidence(p, date, `Sessões longas raras (${longSessions}) vs curtas (${shortSessions}).`);
      }
    } else {
      p = pushEvidence(p, date, `Continua evitando treinos longos.`);
    }
    map.set("avoids_long_workouts", p);
  }

  if (state.sessions.length >= 6 && shortSessions >= midSessions && shortSessions >= 3) {
    let p = map.get("prefers_short_sessions") ?? emptyPattern("prefers_short_sessions", date);
    if (!(prior?.length)) {
      p = emptyPattern("prefers_short_sessions", date);
      for (let i = 0; i < Math.min(shortSessions, 8); i++) {
        p = pushEvidence(p, date, `Conclui bem sessões <45 min (${shortSessions} no histórico).`);
      }
    } else {
      p = pushEvidence(p, date, `Sessão curta reforça preferência.`);
    }
    map.set("prefers_short_sessions", p);
  }

  // Weekend protein / sunday meals
  const meals = state.meals ?? [];
  const weekendMeals = meals.filter((m) => {
    const wd = new Date(m.date).getDay();
    return wd === 0 || wd === 6;
  });
  const weekdayMeals = meals.length - weekendMeals.length;
  if (weekdayMeals > 4 && weekendMeals.length < weekdayMeals * 0.35) {
    let p = map.get("weekend_protein_drop") ?? emptyPattern("weekend_protein_drop", date);
    if (!(prior?.length)) {
      p = emptyPattern("weekend_protein_drop", date);
      for (let i = 0; i < 4; i++) {
        p = pushEvidence(p, date, `Menos refeições no fim de semana (${weekendMeals.length} vs ${weekdayMeals} em dias úteis).`);
      }
    } else {
      p = pushEvidence(p, date, `Gap de refeições no fim de semana.`);
    }
    map.set("weekend_protein_drop", p);
  }

  const sundayMeals = meals.filter((m) => new Date(m.date).getDay() === 0).length;
  const otherAvg = meals.length / 7;
  if (meals.length >= 10 && sundayMeals < otherAvg * 0.5) {
    let p = map.get("sunday_meal_gap") ?? emptyPattern("sunday_meal_gap", date);
    if (!(prior?.length)) {
      p = emptyPattern("sunday_meal_gap", date);
      for (let i = 0; i < 4; i++) {
        p = pushEvidence(p, date, `Domingo com poucas refeições registradas (${sundayMeals}).`);
      }
    } else {
      p = pushEvidence(p, date, `Domingo continua fraco em registros.`);
    }
    map.set("sunday_meal_gap", p);
  }

  // Poor sleep after late train (sessions after 20:00 proxy: duration evening not available — use date+long evening via check-in next day)
  // Heuristic: session date D with duration>=50 and next-day sleep <6
  const checkIns = state.dayCheckIns ?? {};
  let latePairs = 0;
  for (const s of state.sessions) {
    if (s.durationMin < 50) continue;
    const d = new Date(`${s.date.slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + 1);
    const nextKey = d.toISOString().slice(0, 10);
    const next = checkIns[nextKey];
    if (next && next.sleepHours < 6) latePairs += 1;
  }
  if (latePairs >= 1) {
    let p = map.get("poor_sleep_after_late_train") ?? emptyPattern("poor_sleep_after_late_train", date);
    if (!(prior?.length) && latePairs >= 4) {
      p = emptyPattern("poor_sleep_after_late_train", date);
      for (let i = 0; i < latePairs; i++) {
        p = pushEvidence(p, date, `Sono <6h no dia seguinte a treino longo.`);
      }
    } else if (prior?.length) {
      p = pushEvidence(p, date, `Sono baixo após treino exigente.`);
    } else if (latePairs >= 2) {
      for (let i = 0; i < latePairs; i++) {
        p = pushEvidence(p, date, `Sono <6h no dia seguinte a treino longo.`);
      }
    }
    map.set("poor_sleep_after_late_train", p);
  }

  return [...map.values()].map((p) => maybeDecay(p, date));
}

export function activePatterns(patterns: LearnedPattern[]): LearnedPattern[] {
  return patterns.filter((p) => p.status === "active");
}

export function buildPatternsBlobV2(
  state: AppState,
  prior?: PatternsBlobV2 | LearnedPattern[] | UserPatterns | null,
): PatternsBlobV2 {
  const legacy = extractUserPatterns(state);
  let priorPatterns: LearnedPattern[] | null = null;
  if (prior && typeof prior === "object") {
    if (Array.isArray(prior)) priorPatterns = prior;
    else if ("version" in prior && (prior as PatternsBlobV2).version === 2) {
      priorPatterns = (prior as PatternsBlobV2).patterns;
    }
  }
  return {
    version: 2,
    legacy,
    patterns: extractLearnedPatterns(state, priorPatterns),
  };
}

export function parsePatternsBlob(raw: unknown): PatternsBlobV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r["version"] === 2 && Array.isArray(r["patterns"])) {
    return {
      version: 2,
      legacy: (r["legacy"] as UserPatterns) ?? {
        weekdaySessionCounts: {},
        weakestWeekday: null,
        mealGapWeekend: false,
        longWorkoutAvoidance: false,
        updatedAt: new Date().toISOString(),
      },
      patterns: r["patterns"] as LearnedPattern[],
    };
  }
  // Legacy flat UserPatterns
  if ("weekdaySessionCounts" in r || "updatedAt" in r) {
    return {
      version: 2,
      legacy: r as unknown as UserPatterns,
      patterns: [],
    };
  }
  return null;
}

export function applyOutcomeToPattern(
  patterns: LearnedPattern[],
  kind: PatternKind,
  result: "success" | "fail",
  date: string,
  note: string,
): LearnedPattern[] {
  if (!isAllowedPatternKind(kind)) return patterns;
  const list = [...patterns];
  const idx = list.findIndex((p) => p.kind === kind);
  let p = idx >= 0 ? list[idx]! : emptyPattern(kind, date);
  if (result === "success") p = { ...p, successfulOutcomes: p.successfulOutcomes + 1 };
  else p = { ...p, failedOutcomes: p.failedOutcomes + 1 };
  p = pushEvidence(p, date, note);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  return list;
}
