import { monthlyDoseAdherence } from "@/lib/engine/supplements";
import { mergeRestockWithConsumption } from "@/lib/engine/supplement-inventory";
import type { AppState } from "@/lib/types";
import type { Supplements360 } from "@/lib/customer360/types";

export function aggregateSupplements(state: AppState): Supplements360 {
  const merged = mergeRestockWithConsumption(
    state.restockEstimates ?? {},
    state.supplementDoseLogs ?? [],
    state.supplementFrequencies,
  );

  const restock: Supplements360["restockEstimates"] = {};
  for (const [id, r] of Object.entries(merged)) {
    const daysLeft = Math.max(
      0,
      Math.round((new Date(r.emptyAt).getTime() - Date.now()) / 86_400_000),
    );
    restock[id] = {
      productId: id,
      emptyAt: r.emptyAt,
      daysLeft,
      confidence: typeof r.confidence === "number" ? r.confidence : 0.45,
      kind: "estimate",
    };
  }

  const doseCount = (state.supplementDoseLogs ?? []).length;
  if (doseCount >= 3) {
    for (const k of Object.keys(restock)) {
      restock[k] = {
        ...restock[k]!,
        confidence: Math.min(0.85, (restock[k]!.confidence || 0.45) + doseCount * 0.015),
      };
    }
  }

  const routine = state.supplementRoutine ?? [];
  let adherence30d: number | null = null;
  if (routine.length) {
    adherence30d = monthlyDoseAdherence(state.supplementLogs, routine).pct / 100;
  }

  return {
    routineIds: routine,
    adherence30d,
    restockEstimates: restock,
  };
}
