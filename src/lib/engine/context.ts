/**
 * Context Engine — "How is this person today?"
 * Builds from ContextSnapshot + reason codes (FASE 4).
 * Does NOT invent goals from Shopify products.
 */
import type { Customer360 } from "@/lib/customer360";
import { buildCustomer360FromState } from "@/lib/customer360";
import { buildContextSnapshot } from "@/lib/engine/context-snapshot";
import { REASON_CODE_META, type ReasonCode } from "@/lib/engine/reason-codes";
import { todayKey, type AppState } from "@/lib/types";

export type ContextSignal = {
  key: string;
  direction: "up" | "down" | "stable" | "risk";
  label: string;
  why: string;
  reasonCode?: ReasonCode;
};

export type UserContext = {
  date: string;
  signals: ContextSignal[];
  headline: string | null;
  why: string[];
  customer360: Customer360;
  performanceScore: number | null;
  adherenceScore: number | null;
  /** FASE 4: structured reason codes from snapshot */
  reasonCodes: ReasonCode[];
};

export function buildUserContext(state: AppState, userId?: string | null): UserContext {
  const date = todayKey();
  const snapshot = buildContextSnapshot(state, date, userId);
  const c360 =
    snapshot != null
      ? buildCustomer360FromState(state, userId != null ? { userId } : undefined)
      : buildCustomer360FromState(state, userId != null ? { userId } : undefined);

  if (!snapshot) {
    return {
      date,
      signals: [],
      headline: null,
      why: [],
      customer360: c360,
      performanceScore: null,
      adherenceScore: null,
      reasonCodes: [],
    };
  }

  const signals: ContextSignal[] = [];
  const why: string[] = [];

  for (const code of snapshot.reasonSeeds) {
    const meta = REASON_CODE_META[code];
    if (!meta) continue;
    // Skip positive noise for headline density except sleep_good as stable
    if (code === "sleep_good" || code === "energy_high") {
      signals.push({
        key: code,
        direction: meta.direction,
        label: meta.label,
        why: `${meta.label}: ${meta.fragment}.`,
        reasonCode: code,
      });
      continue;
    }
    signals.push({
      key: code,
      direction: meta.direction,
      label: meta.label,
      why: `${meta.label}: ${meta.fragment}.`,
      reasonCode: code,
    });
    why.push(`${meta.label} — ${meta.fragment}.`);
  }

  // Weekday skip pattern (legacy signal for UI)
  const byWeekday = new Map<number, number>();
  for (const s of state.sessions) {
    const wd = new Date(s.date).getDay();
    byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1);
  }
  const todayWd = new Date().getDay();
  const todayCount = byWeekday.get(todayWd) ?? 0;
  const avg =
    [...byWeekday.values()].reduce((a, b) => a + b, 0) / Math.max(1, byWeekday.size);
  if (state.sessions.length >= 8 && todayCount < avg * 0.5) {
    signals.push({
      key: "weekday_skip",
      direction: "risk",
      label: "Padrão semanal",
      why: "Você costuma treinar menos neste dia da semana.",
    });
    why.push("Você costuma pular treinos neste dia — sessão ajustada para ser mais curta ajuda.");
  }

  const headline =
    why[0] ??
    (signals.length
      ? signals[0]!.why
      : snapshot.training.recentSessions7d > 0
        ? `Sequência ativa — ${snapshot.training.recentSessions7d} treinos em 7 dias.`
        : null);

  return {
    date,
    signals,
    headline,
    why: why.slice(0, 5),
    customer360: c360,
    performanceScore: snapshot.adherence.performanceScore,
    adherenceScore: snapshot.adherence.adherenceScore,
    reasonCodes: snapshot.reasonSeeds,
  };
}
