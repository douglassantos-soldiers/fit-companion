/**
 * Recommendation Engine — ranks next actions from Living Plan + Safety + Context + Decisions.
 * Pure TypeScript; consumes existing engines without duplicating their logic.
 */
import type { LivingPlanSnapshot } from "@/lib/types";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { UserContext } from "@/lib/engine/context";
import type { DecisionBundle, EngineDecision } from "@/lib/engine/decision";
import type { ReasonCode } from "@/lib/engine/reason-codes";
import type { Goal } from "@/lib/types";
import { PRODUCTS } from "@/data/products";
import { REASON_CODE_META } from "@/lib/engine/reason-codes";
import type { BehaviorLoopResult } from "@/lib/engine/behavior/types";

export type RecommendationKind =
  | "train"
  | "rest"
  | "meal"
  | "supplement"
  | "sleep"
  | "hydrate"
  | "product"
  | "coach"
  | "behavior";

export type AuthoritativeDecisionType =
  | "REST"
  | "REDUCE_VOLUME"
  | "EXPRESS_WORKOUT"
  | "FULL_WORKOUT"
  | "DELOAD"
  | "INCREASE_RECOVERY"
  | "NUTRITION_FOCUS"
  | "HYDRATION_FOCUS"
  | "SUPPLEMENT_REMINDER"
  | "SLEEP_PRIORITY"
  | "COACH_CHECKIN";

export type AuthoritativeDecision = {
  type: AuthoritativeDecisionType;
  value: string | number | boolean;
  reason_codes: ReasonCode[];
  evidence: string[];
  confidence: number;
  context_snapshot?: Record<string, unknown>;
  created_at: string;
};

function engineDecision(
  bundle: DecisionBundle,
  decisionType: EngineDecision["decisionType"],
): EngineDecision | undefined {
  return bundle.decisions.find((d) => d.decisionType === decisionType);
}

function authoritativeDecision(
  type: AuthoritativeDecisionType,
  value: string | number | boolean,
  engine: EngineDecision | undefined,
  created_at: string,
): AuthoritativeDecision {
  return {
    type,
    value,
    reason_codes: engine?.reasonCodes ?? [],
    evidence: engine?.explanation ? [engine.explanation] : [],
    confidence: engine?.confidence ?? 0.5,
    created_at,
  };
}

/** Map Decision Engine bundle fields to authoritative decision types for logging / Customer 360. */
export function decisionsFromBundle(bundle: DecisionBundle): AuthoritativeDecision[] {
  const created_at = new Date().toISOString();
  const out: AuthoritativeDecision[] = [];
  const modeEngine = engineDecision(bundle, "training_mode");
  const volumeEngine = engineDecision(bundle, "training_volume");
  const stimsEngine = engineDecision(bundle, "block_stims");
  const proteinEngine = engineDecision(bundle, "nutrition_protein_bias");
  const primaryEngine = engineDecision(bundle, "primary_action");

  const mode = bundle.trainingMode;
  if (mode === "rest") {
    out.push(authoritativeDecision("REST", mode, modeEngine, created_at));
  } else if (mode === "deload") {
    out.push(authoritativeDecision("DELOAD", mode, modeEngine, created_at));
  } else if (mode === "express") {
    out.push(authoritativeDecision("EXPRESS_WORKOUT", mode, modeEngine, created_at));
  } else {
    out.push(authoritativeDecision("FULL_WORKOUT", mode, modeEngine, created_at));
  }

  if (bundle.trainingVolume < 1 && mode !== "rest") {
    out.push(
      authoritativeDecision("REDUCE_VOLUME", bundle.trainingVolume, volumeEngine, created_at),
    );
  }

  if (bundle.blockStims) {
    out.push(authoritativeDecision("SLEEP_PRIORITY", true, stimsEngine, created_at));
  }

  if (bundle.proteinBias === "up") {
    out.push(
      authoritativeDecision("NUTRITION_FOCUS", bundle.proteinBias, proteinEngine, created_at),
    );
  }

  if (bundle.primaryAction === "rest" && mode !== "rest") {
    out.push(
      authoritativeDecision(
        "INCREASE_RECOVERY",
        bundle.primaryAction,
        primaryEngine,
        created_at,
      ),
    );
  } else if (bundle.primaryAction === "sleep" && !bundle.blockStims) {
    out.push(
      authoritativeDecision("SLEEP_PRIORITY", bundle.primaryAction, primaryEngine, created_at),
    );
  } else if (bundle.primaryAction === "meal" && bundle.proteinBias !== "up") {
    out.push(
      authoritativeDecision("NUTRITION_FOCUS", bundle.primaryAction, primaryEngine, created_at),
    );
  } else if (bundle.primaryAction === "supplement") {
    out.push(
      authoritativeDecision(
        "SUPPLEMENT_REMINDER",
        bundle.primaryAction,
        primaryEngine,
        created_at,
      ),
    );
  }

  return out;
}

function trainDecisionType(
  mode: LivingPlanSnapshot["workout"]["mode"],
  primary: DecisionBundle["primaryAction"] | undefined,
  escalate: boolean,
): AuthoritativeDecisionType {
  if (escalate) return "INCREASE_RECOVERY";
  if (primary === "sleep") return "SLEEP_PRIORITY";
  if (mode === "rest") return "REST";
  if (mode === "deload") return "DELOAD";
  if (mode === "express") return "EXPRESS_WORKOUT";
  return "FULL_WORKOUT";
}

export type Recommendation = {
  id: string;
  kind: RecommendationKind;
  title: string;
  reason: string;
  priority: number;
  href?: string;
  productId?: string;
  reasonCodes?: string[];
  decisionType?: AuthoritativeDecisionType;
};

export function rankRecommendations(opts: {
  livingPlan: LivingPlanSnapshot;
  safety: SafetyVerdict;
  context?: UserContext | null;
  decisions?: DecisionBundle | null;
  goal?: Goal;
  purchaseProductIds?: string[];
  behavior?: BehaviorLoopResult | null;
  weekday?: number;
}): Recommendation[] {
  const out: Recommendation[] = [];
  const {
    livingPlan: lp,
    safety,
    context,
    decisions,
    goal,
    purchaseProductIds = [],
    behavior,
    weekday = new Date().getDay(),
  } = opts;
  const codes = context?.reasonCodes ?? [];
  const primary = decisions?.primaryAction;
  const workoutMode = decisions?.trainingMode ?? lp.workout.mode;
  const blockStimsEffective = decisions?.blockStims ?? safety.blockStims;
  const proteinBiasUp = decisions?.proteinBias === "up";
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
    workoutMode === "rest" ||
    workoutMode === "deload";

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
      decisionType: "INCREASE_RECOVERY",
    });
  } else if (preferRest) {
    out.push({
      id: "rec-rest",
      kind: primary === "sleep" ? "sleep" : "rest",
      title:
        primary === "sleep"
          ? "Priorize sono hoje"
          : workoutMode === "rest"
            ? "Descanso ativo hoje"
            : "Treino leve / deload",
      reason:
        primaryExplanation ??
        codeReason(["sleep_low", "recovery_low", "rpe_high", "energy_low"]) ??
        safety.reasons.find((r) => r.includes("Sono") || r.includes("Fadiga") || r.includes("deload")) ??
        (lp.why[0] || lp.narrative.slice(0, 120)),
      priority: 100,
      href:
        primary === "sleep"
          ? "/"
          : lp.workout.dayId && workoutMode !== "rest"
            ? `/treino/sessao/${lp.workout.dayId.replace(/-express$/, "")}${workoutMode === "express" ? "?express=true" : ""}`
            : "/treino",
      reasonCodes: codes.filter((c) =>
        ["sleep_low", "recovery_low", "rpe_high", "energy_low", "deload_week"].includes(c),
      ),
      decisionType: trainDecisionType(workoutMode, primary, false),
    });
  } else {
    out.push({
      id: "rec-train",
      kind: "train",
      title: lp.workout.title || "Treino do dia",
      reason: primaryExplanation ?? lp.why[0] ?? lp.narrative.slice(0, 120),
      priority:
        primary === "train"
          ? codes.includes("progression_ready") || codes.includes("pr_opportunity")
            ? 99
            : 98
          : 95,
      href:
        lp.workout.dayId
          ? `/treino/sessao/${lp.workout.dayId.replace(/-express$/, "")}${workoutMode === "express" ? "?express=true" : ""}`
          : "/treino",
      reasonCodes: codes.filter((c) =>
        [
          "sleep_good",
          "energy_high",
          "time_limited",
          "progression_ready",
          "low_muscle_fatigue",
          "pr_opportunity",
          "plateau_detected",
          "excessive_muscle_load",
          "undertrained_muscle",
        ].includes(c),
      ),
      decisionType: trainDecisionType(workoutMode, primary, false),
    });
  }

  const mealPriority =
    primary === "meal" || proteinBiasUp || codes.includes("protein_low") ? 92 : 80;
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
    decisionType: "NUTRITION_FOCUS",
  });

  if (!blockStimsEffective && lp.supplements.length) {
    const next = lp.supplements[0]!;
    out.push({
      id: "rec-supp",
      kind: "supplement",
      title: next.name || "Suplemento",
      reason: `Rotina · ${next.timing || "timing do plano"}`,
      priority: 70,
      href: "/suplementos",
      productId: next.id,
      reasonCodes: codes.filter((c) => c === "adherence_drop"),
      decisionType: "SUPPLEMENT_REMINDER",
    });
  } else if (blockStimsEffective) {
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
      decisionType: "SLEEP_PRIORITY",
    });
  }

  // Product recs: only owned / routine — never push catalog as ads.
  const ownedOrRoutine = new Set([
    ...purchaseProductIds,
    ...lp.supplements.map((s) => s.id),
  ]);
  const restockSoon = codes.includes("restock_risk");
  const candidates = PRODUCTS.filter((p) => ownedOrRoutine.has(p.id));
  for (const p of candidates.slice(0, 2)) {
    const reasons: string[] = [];
    if (purchaseProductIds.includes(p.id)) reasons.push("compra anterior");
    if (lp.supplements.some((s) => s.id === p.id)) reasons.push("na sua rotina");
    if (goal && p.goals.includes(goal)) reasons.push(`objetivo ${goal}`);
    if (restockSoon) reasons.push("estoque estimado baixo");
    out.push({
      id: `rec-product-${p.id}`,
      kind: "product",
      title: p.name,
      reason: reasons.length
        ? `Transparente: ${reasons.join(" · ")}.`
        : "Já faz parte do seu contexto.",
      priority: restockSoon ? 55 : 40,
      href: "/suplementos",
      productId: p.id,
      ...(restockSoon ? { reasonCodes: ["restock_risk"] } : {}),
      decisionType: "SUPPLEMENT_REMINDER",
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
    decisionType: "COACH_CHECKIN",
  });

  if (behavior) {
    const activeTrig = behavior.triggers.filter((t) => t.active);
    const top = behavior.interventions[0];
    const fridayBoost =
      weekday === 5 && activeTrig.some((t) => t.key === "LOW_FRIDAY_ADHERENCE");
    if (top) {
      out.push({
        id: `rec-behavior-${top.id}`,
        kind: "behavior",
        title: top.action,
        reason: top.reason,
        priority: fridayBoost || activeTrig.length ? 96 : 65,
        href:
          top.type === "meal_swap"
            ? "/nutricao"
            : top.type === "sleep_prompt"
              ? "/"
              : top.type === "coach_checkin"
                ? "/coach"
                : "/treino",
        decisionType:
          top.type === "express_workout"
            ? "EXPRESS_WORKOUT"
            : top.type === "sleep_prompt"
              ? "SLEEP_PRIORITY"
              : top.type === "meal_swap"
                ? "NUTRITION_FOCUS"
                : "COACH_CHECKIN",
      });
    } else if (behavior.lapses[0]) {
      const lapse = behavior.lapses[0];
      out.push({
        id: "rec-behavior-lapse",
        kind: "behavior",
        title: lapse.nextAction,
        reason: lapse.reason,
        priority: 94,
        href: "/treino",
        decisionType: "EXPRESS_WORKOUT",
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}
