import type { SupplementDoseLog } from "@/lib/types";
import { todayKey } from "@/lib/types";

const PROTEIN_PRODUCT_IDS = new Set(["whey-protein", "beef-protein"]);

/** Typical scoop: 30 g powder ≈ 24 g protein / 120 kcal. */
export const WHEY_PROTEIN_G = 24;
export const WHEY_KCAL = 120;

export function wheyMacrosFromDoses(
  doses: SupplementDoseLog[] | undefined,
  date = todayKey(),
  optIn = false,
): { proteinG: number; kcal: number; scoops: number } {
  if (!optIn) return { proteinG: 0, kcal: 0, scoops: 0 };
  const day = (doses ?? []).filter(
    (d) => PROTEIN_PRODUCT_IDS.has(d.productId) && d.takenAt.slice(0, 10) === date,
  );
  const scoops = day.length;
  return {
    proteinG: scoops * WHEY_PROTEIN_G,
    kcal: scoops * WHEY_KCAL,
    scoops,
  };
}
