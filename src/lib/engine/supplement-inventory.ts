/**
 * FASE 7 — Supplement inventory intelligence.
 * Purchase adds stock; dose logs deplete. Never assume purchase = consumption.
 */
import { mapEntryByProductId, type RestockEstimate } from "@/data/shopify-product-map";
import type { DoseFrequency, SupplementDoseLog } from "@/lib/types";

export type SupplementDomainLayer =
  | "PRODUCT"
  | "PACKAGE"
  | "DOSAGE"
  | "FREQUENCY"
  | "CONSUMPTION"
  | "RESTOCK";

export type PackageModel = {
  productId: string;
  servingsPerContainer: number;
  servingsPerDay: number;
};

export function estimateDaysRemaining(
  servingsLeft: number,
  servingsPerDay: number,
): number | null {
  if (!Number.isFinite(servingsLeft) || !Number.isFinite(servingsPerDay) || servingsPerDay <= 0) {
    return null;
  }
  return Math.max(0, Math.round(servingsLeft / servingsPerDay));
}

export type PurchaseStockInput = {
  productId: string;
  quantity: number;
  orderedAt: string;
  servingsPerContainer?: number;
  servingsPerDay?: number;
};

/** Convert a dose log into fractional servings (1 serving = default package serving). */
export function doseToServings(log: SupplementDoseLog): number {
  const entry = mapEntryByProductId(log.productId);
  const dose = Math.max(0, Number(log.dose) || 0);
  if (log.unit === "serving" || log.unit === "scoop") return dose;
  if (log.unit === "caps") {
    // Heuristic: 1 serving ≈ catalog caps when known; else 1 cap = 1 serving fraction
    return dose;
  }
  if (log.unit === "g" || log.unit === "ml") {
    // Without exact scoop grams, treat 5g creatina-like as 1 serving if map says 1/day
    const perDay = entry?.servingsPerDay ?? 1;
    if (dose >= 4 && dose <= 6) return perDay;
    return dose > 0 ? Math.max(0.25, dose / 30) : 0;
  }
  return dose;
}

export function frequencyToServingsPerDay(
  frequency: DoseFrequency | string | undefined,
  fallback = 1,
): number {
  switch (frequency) {
    case "2x_day":
      return 2;
    case "as_needed":
      return 0.5;
    case "custom":
      return fallback;
    case "1x_day":
    default:
      return fallback;
  }
}

export function sumServingsSince(
  logs: SupplementDoseLog[],
  productId: string,
  sinceIso: string,
): number {
  const since = new Date(sinceIso).getTime();
  if (Number.isNaN(since)) return 0;
  return logs
    .filter((l) => l.productId === productId && new Date(l.takenAt).getTime() >= since)
    .reduce((s, l) => s + doseToServings(l), 0);
}

/**
 * Estimate inventory from purchases + consumption logs.
 * Confidence rises with dose logs; purchase-only stays low.
 */
export function estimateInventoryFromConsumption(opts: {
  purchases: PurchaseStockInput[];
  doseLogs: SupplementDoseLog[];
  frequencies?: Record<string, DoseFrequency>;
  now?: Date;
}): Record<string, RestockEstimate> {
  const now = opts.now ?? new Date();
  const byProduct = new Map<string, { servings: number; orderedAt: string; qty: number; spd: number }>();

  for (const p of opts.purchases) {
    const map = mapEntryByProductId(p.productId);
    const spc = p.servingsPerContainer ?? map?.servingsPerContainer ?? 30;
    const spd =
      p.servingsPerDay ??
      frequencyToServingsPerDay(opts.frequencies?.[p.productId], map?.servingsPerDay ?? 1);
    const servings = Math.max(1, spc * Math.max(1, p.quantity));
    const prev = byProduct.get(p.productId);
    if (!prev || new Date(p.orderedAt) >= new Date(prev.orderedAt)) {
      // Stack servings from all purchases; track latest orderedAt for depletion window start = earliest
      const earliest = prev
        ? new Date(Math.min(new Date(prev.orderedAt).getTime(), new Date(p.orderedAt).getTime())).toISOString()
        : p.orderedAt;
      byProduct.set(p.productId, {
        servings: (prev?.servings ?? 0) + servings,
        orderedAt: earliest,
        qty: (prev?.qty ?? 0) + Math.max(1, p.quantity),
        spd,
      });
    }
  }

  const out: Record<string, RestockEstimate> = {};
  const doseDays = new Set(
    opts.doseLogs.map((l) => l.takenAt.slice(0, 10)),
  ).size;

  for (const [productId, stock] of byProduct) {
    if (!productId) continue;
    const orderedMs = new Date(stock.orderedAt).getTime();
    const consumed = Number.isFinite(orderedMs)
      ? sumServingsSince(opts.doseLogs, productId, stock.orderedAt)
      : 0;
    const left = Math.max(0, stock.servings - consumed);
    const spd = Math.max(0.25, stock.spd);
    const daysLeft = Math.max(0, Math.round(left / spd));
    const empty = new Date(now.getTime());
    if (Number.isNaN(empty.getTime())) continue;
    empty.setDate(empty.getDate() + daysLeft);

    const productDoseCount = opts.doseLogs.filter((l) => l.productId === productId).length;
    let confidence = 0.35;
    if (productDoseCount > 0) confidence = Math.min(0.85, 0.45 + productDoseCount * 0.03 + doseDays * 0.01);
    else confidence = 0.35;

    out[productId] = {
      productId,
      emptyAt: empty.toISOString(),
      daysLeft,
      quantity: stock.qty,
      confidence,
      estimatedServingsLeft: left,
      kind: "estimate",
    };
  }

  return out;
}

/** Soft commerce copy — never "BUY NOW". */
export function restockSoftMessage(estimate: RestockEstimate): {
  headline: string;
  detail: string;
  confidenceLabel: string;
} {
  const conf = estimate.confidence ?? 0.35;
  const confidenceLabel =
    conf >= 0.7 ? "confiança alta" : conf >= 0.5 ? "confiança média" : "confiança baixa";
  const days = Math.max(0, estimate.daysLeft);
  return {
    headline: "Seu estoque estimado está chegando ao fim.",
    detail:
      days <= 0
        ? `Estimativa sugere estoque esgotado (${confidenceLabel}).`
        : `Estimativa: ~${days} dia${days === 1 ? "" : "s"} restante${days === 1 ? "" : "s"} (${confidenceLabel}).`,
    confidenceLabel,
  };
}

/** Merge legacy calendar-only estimates with consumption-aware ones. */
export function mergeRestockWithConsumption(
  base: Record<string, RestockEstimate>,
  doseLogs: SupplementDoseLog[],
  frequencies?: Record<string, DoseFrequency>,
  now = new Date(),
): Record<string, RestockEstimate> {
  if (!Object.keys(base).length) return base;
  const purchases: PurchaseStockInput[] = Object.values(base).map((e) => {
    const map = mapEntryByProductId(e.productId);
    const spd = frequencyToServingsPerDay(frequencies?.[e.productId], map?.servingsPerDay ?? 1);
    const totalServings = Math.max(1, Math.round(e.daysLeft * spd) + sumServingsSince(doseLogs, e.productId, e.emptyAt));
    // Reconstruct orderedAt ≈ emptyAt - original days; use emptyAt - daysLeft as proxy for "now origin"
    const ordered = new Date(now);
    ordered.setDate(ordered.getDate() - Math.max(0, e.daysLeft));
    // Better: emptyAt minus (daysLeft + consumed days) — use emptyAt - daysLeft from original calendar
    const daysLeft = Number.isFinite(e.daysLeft) ? Math.max(0, e.daysLeft) : 7;
    const fromEmpty = new Date(e.emptyAt);
    if (Number.isNaN(fromEmpty.getTime())) {
      fromEmpty.setTime(now.getTime());
    }
    fromEmpty.setDate(fromEmpty.getDate() - Math.max(1, daysLeft || 1));
    if (Number.isNaN(fromEmpty.getTime())) {
      fromEmpty.setTime(now.getTime());
      fromEmpty.setDate(fromEmpty.getDate() - 7);
    }
    return {
      productId: e.productId || String((e as { id?: string }).id ?? ""),
      quantity: e.quantity || 1,
      orderedAt: fromEmpty.toISOString(),
      servingsPerContainer:
        map?.servingsPerContainer ??
        Math.max(1, Math.round(totalServings / Math.max(1, e.quantity || 1))),
      servingsPerDay: spd,
    };
  });

  const computed = estimateInventoryFromConsumption({
    purchases,
    doseLogs,
    ...(frequencies ? { frequencies } : {}),
    now,
  });

  const out: Record<string, RestockEstimate> = { ...base };
  for (const [id, est] of Object.entries(computed)) {
    out[id] = {
      ...base[id],
      ...est,
      quantity: base[id]?.quantity ?? est.quantity,
    };
  }
  return out;
}
