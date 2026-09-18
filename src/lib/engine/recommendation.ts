/**
 * Recommendation Engine — ranks next actions from Living Plan + Safety + Context + Decisions.
 * Pure TypeScript; consumes existing engines without duplicating their logic.
 */
import type { LivingPlanSnapshot } from "@/lib/types";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { UserContext } from "@/lib/engine/context";
import type { DecisionBundle } from "@/lib/engine/decision";
import type { Goal } from "@/lib/types";
import { PRODUCTS } from "@/data/products";
import { REASON_CODE_META } from "@/lib/engine/reason-codes";

export type RecommendationKind =
  | "train"
  | "rest"
  | "meal"
  | "supplement"
  | "sleep"
  | "hydrate"
  | "product"
  | "coach";

export type Recommendation = {
  id: string;
  kind: RecommendationKind;
  title: string;
  reason: string;
  priority: number;
  href?: string;
  productId?: string;
  reasonCodes?: string[];
};

export function rankRecommendations(opts: {
  livingPlan: LivingPlanSnapshot;
  safety: SafetyVerdict;
  context?: UserContext | null;
  decisions?: DecisionBundle | null;
  goal?: Goal;
  purchaseProductIds?: string[];
}): Recommendation[] {
  const out: Recommendation[] = [];
  const { livingPlan: lp, safety, context, decisions, goal, purchaseProductIds = [] } = opts;
  const codes = context?.reasonCodes ?? [];
  const primary = decisions?.primaryAction;
  const primaryExplanation =
    decisions?.decisions.find((d) => d.decisionType === "primary_action")?.explanation ?? null;

  const codeReason = (prefer: string[]) => {
    const hit = codes.find((c) => prefer.includes(c));
    if (hit && REASON_CODE_META[hit as keyof typeof REASON_CODE_META]) {
      return REASON_CODE_META[hit as keyof typeof REASON_CODE_META].label;
    }
    return null;
  };

  const preferRest =
    primary === "rest" ||
    primary === "sleep" ||
    safety.preferLightTraining ||
    safety.escalateCare ||
    lp.workout.mode === "rest" ||
    lp.workout.mode === "deload";

  if (safety.escalateCare) {
    out.push({
      id: "rec-escalate",
      kind: "sleep",
      title: "Pause o estímulo intenso",
      reason:
        safety.reasons.find((r) => r.includes("profissional") || r.includes("atenção")) ??
        primaryExplanation ??
        "Há um sinal que merece cuidado — não é só adaptação de treino.",
      priority: 120,
      href: "/",
      reasonCodes: codes.filter((c) =>
        ["escalate_care", "pain_signal", "high_stress", "sleep_low", "recovery_low"].includes(c),
      ),
    });
  } else if (preferRest) {
    out.push({
      id: "rec-rest",
      kind: primary === "sleep" ? "sleep" : "rest",
      title:
        primary === "sleep"
          ? "Priorize sono hoje"
          : lp.workout.mode === "rest"
            ? "Descanso ativo hoje"
            : "Treino leve / deload",
      reason:
        primaryExplanation ??
        codeReason(["sleep_low", "recovery_low", "rpe_high", "energy_low"]) ??
        safety.reasons.find((r) => r.includes("Sono") || r.includes("Fadiga") || r.includes("deload")) ??
        (lp.why[0] || lp.narrative.slice(0, 120)),
      priority: 100,
      href: primary === "sleep" ? "/" : "/treino",
      reasonCodes: codes.filter((c) =>
        ["sleep_low", "recovery_low", "rpe_high", "energy_low", "deload_week"].includes(c),
      ),
    });
  } else {
    out.push({
      id: "rec-train",
      kind: "train",
      title: lp.workout.title || "Treino do dia",
      reason: primaryExplanation ?? lp.why[0] ?? lp.narrative.slice(0, 120),
      priority: primary === "train" ? 98 : 95,
      href: "/treino",
      reasonCodes: codes.filter((c) => ["sleep_good", "energy_high", "time_limited"].includes(c)),
    });
  }

  const mealPriority = primary === "meal" || codes.includes("protein_low") ? 92 : 80;
  out.push({
    id: "rec-meal",
    kind: "meal",
    title: `Proteína ~${Math.round(lp.nutrition.proteinG)}g`,
    reason:
      codeReason(["protein_low", "adherence_drop", "weight_trend_down"]) ??
      (codes.includes("protein_low")
        ? "Proteína abaixo da meta — priorize a próxima refeição."
        : "Bata a meta de proteína do Living Plan."),
    priority: mealPriority,
    href: "/nutricao",
    reasonCodes: codes.filter((c) =>
      ["protein_low", "adherence_drop", "weight_trend_down"].includes(c),
    ),
  });

  if (!safety.blockStims && !decisions?.blockStims && lp.supplements.length) {
    const next = lp.supplements[0]!;
    out.push({
      id: "rec-supp",
      kind: "supplement",
      title: next.name || "Suplemento",
      reason: next.timing || "Janela de timing do plano.",
      priority: 70,
      href: "/suplementos",
      productId: next.id,
    });
  } else if (safety.blockStims || decisions?.blockStims) {
    out.push({
      id: "rec-sleep",
      kind: "sleep",
      title: "Priorize sono / sem stims",
      reason:
        primaryExplanation ??
        codeReason(["stim_restriction", "sleep_low"]) ??
        safety.reasons.find((r) => r.includes("Sono") || r.includes("estimul")) ??
        "Safety / Decision Engine bloqueou stims.",
      priority: 85,
      href: "/",
      reasonCodes: ["stim_restriction", "sleep_low"],
    });
  }

  if (codes.includes("restock_risk") || context?.customer360.supplements) {
    const owned = PRODUCTS.filter((p) => purchaseProductIds.includes(p.id)).slice(0, 2);
    const catalog = owned.length
      ? owned
      : PRODUCTS.filter((p) => !goal || p.goals.includes(goal)).slice(0, 2);
    for (const p of catalog) {
      out.push({
        id: `rec-product-${p.id}`,
        kind: "product",
        title: p.name,
        reason: codes.includes("restock_risk")
          ? "Risco de reposição no radar."
          : owned.length
            ? "Já no seu arsenal."
            : "Alinhado ao seu objetivo.",
        priority: codes.includes("restock_risk") ? 55 : 40,
        href: "/suplementos",
        productId: p.id,
        reasonCodes: codes.includes("restock_risk") ? ["restock_risk"] : undefined,
      });
    }
  } else {
    const owned = PRODUCTS.filter((p) => purchaseProductIds.includes(p.id)).slice(0, 2);
    const catalog = owned.length
      ? owned
      : PRODUCTS.filter((p) => !goal || p.goals.includes(goal)).slice(0, 2);
    for (const p of catalog) {
      out.push({
        id: `rec-product-${p.id}`,
        kind: "product",
        title: p.name,
        reason: owned.length ? "Já no seu arsenal." : "Alinhado ao seu objetivo.",
        priority: 40,
        href: "/suplementos",
        productId: p.id,
      });
    }
  }

  out.push({
    id: "rec-coach",
    kind: "coach",
    title: "Pergunte ao Coach",
    reason: safety.requireMedicalDisclaimer
      ? "Tire dúvidas de plano (sem diagnóstico médico)."
      : "Ajuste fino do dia.",
    priority: 30,
    href: "/coach",
  });

  return out.sort((a, b) => b.priority - a.priority);
}
