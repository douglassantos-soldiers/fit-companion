/**
 * Recommendation Engine — ranks next actions from Living Plan + Safety + Context.
 * Pure TypeScript; consumes existing engines without duplicating their logic.
 */
import type { LivingPlanSnapshot } from "@/lib/types";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { UserContext } from "@/lib/engine/context";
import type { Goal } from "@/lib/types";
import { PRODUCTS } from "@/data/products";

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
};

export function rankRecommendations(opts: {
  livingPlan: LivingPlanSnapshot;
  safety: SafetyVerdict;
  context?: UserContext | null;
  goal?: Goal;
  purchaseProductIds?: string[];
}): Recommendation[] {
  const out: Recommendation[] = [];
  const { livingPlan: lp, safety, goal, purchaseProductIds = [] } = opts;
  void opts.context;

  if (safety.preferLightTraining || lp.workout.mode === "rest" || lp.workout.mode === "deload") {
    out.push({
      id: "rec-rest",
      kind: "rest",
      title: lp.workout.mode === "rest" ? "Descanso ativo hoje" : "Treino leve / deload",
      reason:
        safety.reasons.find((r) => r.includes("Sono") || r.includes("Fadiga") || r.includes("deload")) ??
        (lp.why[0] || lp.narrative.slice(0, 120)),
      priority: 100,
      href: "/treino",
    });
  } else {
    out.push({
      id: "rec-train",
      kind: "train",
      title: lp.workout.title || "Treino do dia",
      reason: lp.why[0] ?? lp.narrative.slice(0, 120),
      priority: 95,
      href: "/treino",
    });
  }

  out.push({
    id: "rec-meal",
    kind: "meal",
    title: `Proteína ~${Math.round(lp.nutrition.proteinG)}g`,
    reason: "Bata a meta de proteína do Living Plan.",
    priority: 80,
    href: "/nutricao",
  });

  if (!safety.blockStims && lp.supplements.length) {
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
  } else if (safety.blockStims) {
    out.push({
      id: "rec-sleep",
      kind: "sleep",
      title: "Priorize sono / sem stims",
      reason:
        safety.reasons.find((r) => r.includes("Sono") || r.includes("estimul")) ??
        "Safety Engine bloqueou stims.",
      priority: 85,
      href: "/",
    });
  }

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
