import type { CoachProposal } from "@/lib/coach/types";
import { addMealFromPreset, nextSuggestedMeal, type DailyMealPlan } from "@/lib/engine/nutrition";
import type { DayCheckIn, DayEnergy, MealEntry, TrainingMode } from "@/lib/types";

export function proposalToTrainingMode(proposal: CoachProposal): TrainingMode | null {
  switch (proposal.type) {
    case "EXPRESS_WORKOUT":
      return "express";
    case "DELOAD":
    case "REDUCE_VOLUME":
      return "deload";
    case "REST":
    case "INCREASE_RECOVERY":
      return "rest";
    case "FULL_WORKOUT":
      return "full";
    default:
      return null;
  }
}

export function checkInPatchFromProposal(
  current: DayCheckIn | undefined,
  proposal: CoachProposal,
): Omit<DayCheckIn, "date"> | null {
  const mode = proposalToTrainingMode(proposal);
  if (!mode) return null;
  const energy: DayEnergy =
    mode === "rest" || mode === "deload" ? "baixa" : current?.energy ?? "ok";
  const availableMin =
    mode === "express"
      ? Math.min(current?.availableMin ?? 35, 35)
      : current?.availableMin ?? 60;
  return {
    sleepHours: current?.sleepHours ?? 7,
    energy,
    availableMin,
    acceptedTrainingMode: mode,
    ...(current?.noEquipment ? { noEquipment: true } : {}),
    ...(current?.equipment ? { equipment: current.equipment } : {}),
    ...(current?.soreness != null ? { soreness: current.soreness } : {}),
    ...(current?.stress != null ? { stress: current.stress } : {}),
    ...(current?.notes ? { notes: current.notes } : {}),
    ...(current?.lunchOutToday ? { lunchOutToday: true } : {}),
    ...(current?.skippedSlots?.length ? { skippedSlots: current.skippedSlots } : {}),
  };
}

export type CoachAcceptResult =
  | { kind: "checkin"; patch: Omit<DayCheckIn, "date"> }
  | { kind: "water"; ml: number }
  | { kind: "meal"; entry: Omit<MealEntry, "id" | "date">; label: string }
  | { kind: "navigate"; href: "/nutricao" }
  | { kind: "none" };

export function acceptCoachProposal(
  proposal: CoachProposal,
  ctx: {
    checkIn?: DayCheckIn;
    mealPlan?: DailyMealPlan | null;
  },
): CoachAcceptResult {
  if (proposal.type === "HYDRATION_FOCUS") {
    return { kind: "water", ml: 500 };
  }
  if (proposal.type === "NUTRITION_FOCUS") {
    const next = ctx.mealPlan ? nextSuggestedMeal(ctx.mealPlan) : null;
    if (next?.preset) {
      return {
        kind: "meal",
        entry: addMealFromPreset(next.preset, next.slot, next.suggestedServings ?? 1),
        label: next.preset.label,
      };
    }
    return { kind: "navigate", href: "/nutricao" };
  }
  const patch = checkInPatchFromProposal(ctx.checkIn, proposal);
  if (patch) return { kind: "checkin", patch };
  return { kind: "none" };
}

export function proposalAcceptLabel(proposal: CoachProposal) {
  switch (proposal.type) {
    case "EXPRESS_WORKOUT":
      return "Aceitar treino express";
    case "DELOAD":
    case "REDUCE_VOLUME":
      return "Aceitar deload";
    case "REST":
    case "INCREASE_RECOVERY":
      return "Aceitar descanso";
    case "FULL_WORKOUT":
      return "Aceitar treino completo";
    case "NUTRITION_FOCUS":
      return "Aceitar refeição sugerida";
    case "HYDRATION_FOCUS":
      return "Registrar água";
    case "SLEEP_FOCUS":
    case "CHECKIN":
      return "Fazer check-in";
    default:
      return "Aceitar";
  }
}
