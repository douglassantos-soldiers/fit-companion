/**
 * Plate calculator — Olympic bar + kg plates (Strong-style, compact).
 */
export const DEFAULT_BAR_KG = 20;
export const HOME_BAR_KG = 15;
export const PLATE_STOCK_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export interface PlatePair {
  plateKg: number;
  /** Count per side */
  perSide: number;
}

export interface PlateBreakdown {
  barKg: number;
  totalKg: number;
  plates: PlatePair[];
  /** Remaining kg that cannot be made with stock (total, not per side) */
  remainderKg: number;
  label: string;
}

export function resolveBarKg(opts?: { homeBar?: boolean; barKg?: number }): number {
  if (opts?.barKg != null && opts.barKg > 0) return opts.barKg;
  return opts?.homeBar ? HOME_BAR_KG : DEFAULT_BAR_KG;
}

/**
 * Decompose total load into bar + plates per side (greedy largest-first).
 * Returns null when total <= bar or total <= 0.
 */
export function plateBreakdown(
  totalKg: number,
  opts?: { homeBar?: boolean; barKg?: number; stock?: readonly number[] },
): PlateBreakdown | null {
  const barKg = resolveBarKg(opts);
  if (totalKg <= 0 || totalKg <= barKg) return null;

  const stock = opts?.stock ?? PLATE_STOCK_KG;
  let remainingPerSide = (totalKg - barKg) / 2;
  const plates: PlatePair[] = [];

  for (const plateKg of stock) {
    if (remainingPerSide + 1e-9 < plateKg) continue;
    const perSide = Math.floor((remainingPerSide + 1e-9) / plateKg);
    if (perSide <= 0) continue;
    plates.push({ plateKg, perSide });
    remainingPerSide = Math.round((remainingPerSide - perSide * plateKg) * 1000) / 1000;
  }

  const remainderKg = Math.round(remainingPerSide * 2 * 1000) / 1000;
  const plateParts = plates.map((p) =>
    p.perSide === 1 ? `2×${p.plateKg}` : `2×${p.perSide}×${p.plateKg}`,
  );
  const label =
    plateParts.length > 0
      ? `${barKg} + ${plateParts.join(" + ")}${remainderKg > 0.01 ? ` (+${remainderKg})` : ""}`
      : remainderKg > 0.01
        ? `${barKg} (+${remainderKg})`
        : String(barKg);

  return {
    barKg,
    totalKg,
    plates,
    remainderKg: remainderKg > 0.01 ? remainderKg : 0,
    label,
  };
}
