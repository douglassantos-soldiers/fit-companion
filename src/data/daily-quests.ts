import { nutritionProteinPct, waterGoalReached } from "@/lib/engine/xp";
import type { BehaviorSelectContext } from "@/lib/engine/behavior/types";
import type { AppState } from "@/lib/types";
import { todayKey } from "@/lib/types";

export type QuestKind =
  | "train"
  | "protein80"
  | "water"
  | "kudos"
  | "coach"
  | "meals2"
  | "supplements"
  | "xp_goal";

export interface DailyQuest {
  id: string;
  kind: QuestKind;
  title: string;
  target: number;
}

export const DAILY_QUEST_POOL: DailyQuest[] = [
  { id: "q-train", kind: "train", title: "Complete 1 treino", target: 1 },
  { id: "q-protein", kind: "protein80", title: "Bata 80% da proteína", target: 1 },
  { id: "q-water", kind: "water", title: "Bata a meta de água", target: 1 },
  { id: "q-kudos", kind: "kudos", title: "Dê 1 kudos no clube", target: 1 },
  { id: "q-coach", kind: "coach", title: "Abra o Coach", target: 1 },
  { id: "q-meals", kind: "meals2", title: "Logue 2 refeições", target: 2 },
  { id: "q-supp", kind: "supplements", title: "Complete os suplementos", target: 1 },
  { id: "q-xp", kind: "xp_goal", title: "Feche a meta de XP", target: 1 },
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function preferredKinds(ctx?: BehaviorSelectContext | null): QuestKind[] {
  if (!ctx) return [];
  const kinds: QuestKind[] = [];
  for (const t of ctx.triggers.filter((x) => x.active)) {
    if (t.key === "TIME_CONSTRAINT_PATTERN" || t.key === "LOW_FRIDAY_ADHERENCE" || t.key === "TRAINING_SKIPPING_PATTERN") {
      kinds.push("train", "xp_goal");
    }
    if (t.key === "WEEKEND_MEAL_GAP" || t.key === "MEAL_LOGGING_DROP") {
      kinds.push("meals2", "protein80");
    }
    if (t.key === "LOW_SLEEP_STREAK") {
      kinds.push("coach", "water");
    }
  }
  return [...new Set(kinds)];
}

/** Stable 3 quests per day from date + deviceId (+ optional behavior bias). */
export function pickDailyQuests(
  date: string,
  deviceId: string,
  behaviorCtx?: BehaviorSelectContext | null,
): DailyQuest[] {
  const triggerSeed = behaviorCtx?.triggers
    .filter((t) => t.active)
    .map((t) => t.key)
    .sort()
    .join("|");
  const seed = hashSeed(`${date}:${deviceId || "anon"}:${triggerSeed || ""}`);
  const pool = [...DAILY_QUEST_POOL];
  let rng = seed;
  const next = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 0x100000000;
  };
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  const prefer = preferredKinds(behaviorCtx);
  if (prefer.length) {
    const boosted: DailyQuest[] = [];
    const rest: DailyQuest[] = [];
    for (const q of pool) {
      if (prefer.includes(q.kind)) boosted.push(q);
      else rest.push(q);
    }
    const merged = [...boosted, ...rest];
    return merged.slice(0, 3);
  }
  return pool.slice(0, 3);
}

export function ensureDailyQuests(
  state: AppState,
  deviceId: string,
  date = todayKey(),
  behaviorCtx?: BehaviorSelectContext | null,
): AppState {
  if (state.dailyQuestDate === date && (state.dailyQuestIds?.length ?? 0) === 3) return state;
  const picked = pickDailyQuests(date, deviceId, behaviorCtx);
  return {
    ...state,
    dailyQuestDate: date,
    dailyQuestIds: picked.map((q) => q.id),
    dailyQuestProgress: {},
  };
}

export function questById(id: string): DailyQuest | undefined {
  return DAILY_QUEST_POOL.find((q) => q.id === id);
}

export function questProgressValue(state: AppState, quest: DailyQuest, date = todayKey()): number {
  const manual = state.dailyQuestProgress?.[quest.id] ?? 0;
  switch (quest.kind) {
    case "train":
      return state.sessions.some((s) => s.date.slice(0, 10) === date) ? 1 : 0;
    case "protein80":
      return nutritionProteinPct(state, date) >= 80 ? 1 : 0;
    case "water":
      return waterGoalReached(state, date) ? 1 : 0;
    case "meals2":
      return (state.meals ?? []).filter((m) => m.date.slice(0, 10) === date).length;
    case "supplements": {
      const routine = state.supplementRoutine ?? [];
      if (!routine.length) return 0;
      const taken = state.supplementLogs[date] ?? [];
      return routine.every((id) => taken.includes(id)) ? 1 : 0;
    }
    case "xp_goal":
      return (state.xpByDate?.[date] ?? 0) >= 20 ? 1 : 0;
    case "kudos":
    case "coach":
      return Math.min(quest.target, manual);
    default:
      return manual;
  }
}

export function isQuestComplete(state: AppState, quest: DailyQuest, date = todayKey()): boolean {
  return questProgressValue(state, quest, date) >= quest.target;
}

export function allQuestsComplete(state: AppState, date = todayKey()): boolean {
  const ids = state.dailyQuestIds ?? [];
  if (ids.length < 3) return false;
  return ids.every((id) => {
    const q = questById(id);
    return q ? isQuestComplete(state, q, date) : false;
  });
}

export function bumpManualQuest(state: AppState, kind: QuestKind, amount = 1): AppState {
  const ids = state.dailyQuestIds ?? [];
  const quest = DAILY_QUEST_POOL.find((q) => q.kind === kind && ids.includes(q.id));
  if (!quest) return state;
  const cur = state.dailyQuestProgress?.[quest.id] ?? 0;
  return {
    ...state,
    dailyQuestProgress: {
      ...state.dailyQuestProgress,
      [quest.id]: Math.min(quest.target, cur + amount),
    },
  };
}
