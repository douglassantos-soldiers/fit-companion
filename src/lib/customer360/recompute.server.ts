/**
 * Server-side Customer 360 recompute → customer_profiles (DB-first).
 */
import { buildCustomer360FromState, type Commerce360, type Customer360 } from "@/lib/customer360";
import {
  buildDefaultLineage,
  buildEstimatesFromCommerce,
  type LineageEntry,
} from "@/lib/customer360/types";
import { hydrateAppStateFromDb, mergeAppStateOverride } from "@/lib/customer360/hydrate.server";
import type { AppState } from "@/lib/types";
import { adminDbLoose } from "@/lib/db-admin";

export async function loadShopifyCustomerId(userId: string): Promise<string | null> {
  const db = await adminDbLoose();
  if (!db || !userId) return null;
  const { data } = await db
    .from("customer_identities")
    .select("external_id")
    .eq("user_id", userId)
    .eq("provider", "shopify")
    .maybeSingle();
  return data?.external_id ? String(data.external_id) : null;
}

export async function loadCommerce360(userId: string): Promise<Commerce360> {
  const empty: Commerce360 = {
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    totalOrders: 0,
    totalSpend: 0,
    averageOrderValue: null,
    purchaseFrequencyDays: null,
    favoriteProducts: [],
    productIds: [],
    estimatedLtv: null,
    estimatedNextPurchase: null,
  };
  const db = await adminDbLoose();
  if (!db) return empty;

  const { data: orders } = await db
    .from("orders")
    .select("id, ordered_at, total, financial_status")
    .eq("user_id", userId)
    .order("ordered_at", { ascending: true });

  const list = (orders ?? []) as Array<{
    id: string;
    ordered_at: string | null;
    total: number | null;
    financial_status: string | null;
  }>;
  if (!list.length) return empty;

  const paid = list.filter((o) => {
    const s = String(o.financial_status ?? "").toLowerCase();
    return s === "paid" || s === "partially_paid" || !s;
  });

  const totals = paid.map((o) => Number(o.total) || 0);
  const totalSpend = totals.reduce((a, b) => a + b, 0);
  const first = paid[0]?.ordered_at ?? null;
  const last = paid[paid.length - 1]?.ordered_at ?? null;
  const aov = paid.length ? totalSpend / paid.length : null;

  let freq: number | null = null;
  if (paid.length >= 2 && first && last) {
    const days = (new Date(last).getTime() - new Date(first).getTime()) / 86_400_000;
    freq = Math.round((days / (paid.length - 1)) * 10) / 10;
  }

  let nextPurchase: string | null = null;
  if (last && freq && freq > 0) {
    const d = new Date(last);
    d.setDate(d.getDate() + Math.round(freq));
    nextPurchase = d.toISOString();
  }

  const orderIds = paid.map((o) => o.id);
  const fav: string[] = [];
  if (orderIds.length) {
    const { data: items } = await db.from("order_items").select("product_id").in("order_id", orderIds);
    const counts = new Map<string, number>();
    for (const it of (items ?? []) as Array<{ product_id: string | null }>) {
      const pid = it.product_id;
      if (!pid) continue;
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
    fav.push(
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id),
    );
  }

  const ltv =
    totalSpend > 0 ? Math.round(totalSpend * (freq && freq < 90 ? 1.4 : 1.1) * 100) / 100 : null;

  return {
    firstPurchaseAt: first,
    lastPurchaseAt: last,
    totalOrders: paid.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    averageOrderValue: aov != null ? Math.round(aov * 100) / 100 : null,
    purchaseFrequencyDays: freq,
    favoriteProducts: fav,
    productIds: fav,
    estimatedLtv: ltv,
    estimatedNextPurchase: nextPurchase,
  };
}

/** Pure commerce aggregation from order rows (testable without DB). */
export function computeCommerceFromOrders(
  orders: Array<{
    id: string;
    ordered_at: string | null;
    total: number | null;
    financial_status: string | null;
  }>,
  items: Array<{ order_id: string; product_id: string | null }> = [],
): Commerce360 {
  const empty: Commerce360 = {
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    totalOrders: 0,
    totalSpend: 0,
    averageOrderValue: null,
    purchaseFrequencyDays: null,
    favoriteProducts: [],
    productIds: [],
    estimatedLtv: null,
    estimatedNextPurchase: null,
  };
  if (!orders.length) return empty;

  const paid = orders
    .filter((o) => {
      const s = String(o.financial_status ?? "").toLowerCase();
      return s === "paid" || s === "partially_paid" || !s;
    })
    .slice()
    .sort((a, b) => String(a.ordered_at ?? "").localeCompare(String(b.ordered_at ?? "")));

  const totals = paid.map((o) => Number(o.total) || 0);
  const totalSpend = totals.reduce((a, b) => a + b, 0);
  const first = paid[0]?.ordered_at ?? null;
  const last = paid[paid.length - 1]?.ordered_at ?? null;
  const aov = paid.length ? totalSpend / paid.length : null;

  let freq: number | null = null;
  if (paid.length >= 2 && first && last) {
    const days = (new Date(last).getTime() - new Date(first).getTime()) / 86_400_000;
    freq = Math.round((days / (paid.length - 1)) * 10) / 10;
  }

  let nextPurchase: string | null = null;
  if (last && freq && freq > 0) {
    const d = new Date(last);
    d.setDate(d.getDate() + Math.round(freq));
    nextPurchase = d.toISOString();
  }

  const paidIds = new Set(paid.map((o) => o.id));
  const counts = new Map<string, number>();
  for (const it of items) {
    if (!paidIds.has(it.order_id) || !it.product_id) continue;
    counts.set(it.product_id, (counts.get(it.product_id) ?? 0) + 1);
  }
  const fav = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const ltv =
    totalSpend > 0 ? Math.round(totalSpend * (freq && freq < 90 ? 1.4 : 1.1) * 100) / 100 : null;

  return {
    firstPurchaseAt: first,
    lastPurchaseAt: last,
    totalOrders: paid.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    averageOrderValue: aov != null ? Math.round(aov * 100) / 100 : null,
    purchaseFrequencyDays: freq,
    favoriteProducts: fav,
    productIds: fav,
    estimatedLtv: ltv,
    estimatedNextPurchase: nextPurchase,
  };
}

export async function recomputeCustomerProfile(
  userId: string,
  stateOverride?: AppState | null,
): Promise<Customer360 | null> {
  if (!userId) return null;

  const hydrated = await hydrateAppStateFromDb(userId);
  const state = mergeAppStateOverride(hydrated, stateOverride ?? undefined);
  const commerce = await loadCommerce360(userId);
  const shopifyCustomerId = await loadShopifyCustomerId(userId);

  const withProducts: AppState = {
    ...state,
    purchaseProductIds:
      state.purchaseProductIds?.length > 0 ? state.purchaseProductIds : commerce.productIds,
  };

  const base = buildCustomer360FromState(withProducts, { userId, shopifyCustomerId });
  const mergedCommerce = { ...base.commerce, ...commerce };
  const estimates = buildEstimatesFromCommerce(mergedCommerce);
  const lineage = {
    ...buildDefaultLineage(),
    ...(base.lineage ?? {}),
  } as Record<string, LineageEntry>;

  const c360: Customer360 = {
    ...base,
    shopifyCustomerId,
    commerce: mergedCommerce,
    estimates,
    lineage,
    updatedAt: new Date().toISOString(),
  };

  const db = await adminDbLoose();
  if (db) {
    await db.from("customer_profiles").upsert(
      {
        user_id: userId,
        first_purchase_at: c360.commerce.firstPurchaseAt,
        last_purchase_at: c360.commerce.lastPurchaseAt,
        total_orders: c360.commerce.totalOrders,
        total_spend: c360.commerce.totalSpend,
        average_order_value: c360.commerce.averageOrderValue,
        purchase_frequency_days: c360.commerce.purchaseFrequencyDays,
        favorite_products: c360.commerce.favoriteProducts,
        favorite_categories: [],
        current_goal: c360.goals.currentGoal,
        performance_level: c360.goals.level,
        training_frequency: c360.performance.trainingFrequency,
        nutrition_adherence: c360.nutrition.proteinAdherence7d,
        recovery_score: c360.recovery.recoveryScore,
        estimated_ltv: c360.commerce.estimatedLtv,
        estimated_next_purchase: c360.commerce.estimatedNextPurchase,
        restock_estimates: c360.supplements.restockEstimates,
        metrics: {
          performance: c360.performance,
          nutrition: c360.nutrition,
          recovery: c360.recovery,
          behavior: c360.behavior,
          supplements: {
            routineIds: c360.supplements.routineIds,
            adherence30d: c360.supplements.adherence30d,
          },
          lineage: c360.lineage,
          estimates: c360.estimates,
          shopifyCustomerId: c360.shopifyCustomerId,
        },
        updated_at: c360.updatedAt,
      },
      { onConflict: "user_id" },
    );

    // Optional columns from 20260919140000 — best-effort after core upsert
    void db
      .from("customer_profiles")
      .update({
        shopify_customer_id: shopifyCustomerId,
        supplement_adherence: c360.supplements.adherence30d,
      })
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) {
          console.warn("customer_profiles lineage columns update skipped", error.message);
        }
      });
  }

  return c360;
}

/** Load persisted customer_profiles row (server). */
export async function loadCustomerProfile(userId: string): Promise<Customer360 | null> {
  const db = await adminDbLoose();
  if (!db || !userId) return null;
  const { data, error } = await db
    .from("customer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const metrics = (data.metrics as Record<string, unknown> | null) ?? {};
  const commerce = await loadCommerce360(userId);
  const perf = (metrics.performance as Partial<Customer360["performance"]> | undefined) ?? {};
  const nutri = (metrics.nutrition as Partial<Customer360["nutrition"]> | undefined) ?? {};
  const rec = (metrics.recovery as Partial<Customer360["recovery"]> | undefined) ?? {};
  const beh = (metrics.behavior as Partial<Customer360["behavior"]> | undefined) ?? {};
  const suppMetrics =
    (metrics.supplements as { routineIds?: string[]; adherence30d?: number | null } | undefined) ??
    {};
  const lineage =
    (metrics.lineage as Record<string, LineageEntry> | undefined) ?? buildDefaultLineage();
  const estimates =
    (metrics.estimates as Customer360["estimates"] | undefined) ??
    buildEstimatesFromCommerce({
      ...commerce,
      estimatedLtv:
        data.estimated_ltv != null ? Number(data.estimated_ltv) : commerce.estimatedLtv,
      estimatedNextPurchase:
        (data.estimated_next_purchase as string | null) ?? commerce.estimatedNextPurchase,
    });

  const shopifyCustomerId =
    (data.shopify_customer_id as string | null) ??
    (typeof metrics.shopifyCustomerId === "string" ? metrics.shopifyCustomerId : null) ??
    (await loadShopifyCustomerId(userId));

  const restockRaw =
    (data.restock_estimates as Record<string, Record<string, unknown>> | null) ?? {};
  const restockEstimates: Customer360["supplements"]["restockEstimates"] = {};
  for (const [id, r] of Object.entries(restockRaw)) {
    restockEstimates[id] = {
      productId: String(r["productId"] ?? id),
      emptyAt: String(r["emptyAt"] ?? ""),
      daysLeft: Number(r["daysLeft"] ?? 0),
      confidence: Number(r["confidence"] ?? 0.45),
      kind: "estimate",
    };
  }

  return {
    userId,
    shopifyCustomerId,
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
    lineage,
    estimates,
    commerce: {
      ...commerce,
      firstPurchaseAt: (data.first_purchase_at as string | null) ?? commerce.firstPurchaseAt,
      lastPurchaseAt: (data.last_purchase_at as string | null) ?? commerce.lastPurchaseAt,
      totalOrders: Number(data.total_orders ?? commerce.totalOrders),
      totalSpend: Number(data.total_spend ?? commerce.totalSpend),
      averageOrderValue:
        data.average_order_value != null
          ? Number(data.average_order_value)
          : commerce.averageOrderValue,
      purchaseFrequencyDays:
        data.purchase_frequency_days != null
          ? Number(data.purchase_frequency_days)
          : commerce.purchaseFrequencyDays,
      favoriteProducts: (data.favorite_products as string[]) ?? commerce.favoriteProducts,
      productIds: commerce.productIds,
      estimatedLtv:
        data.estimated_ltv != null ? Number(data.estimated_ltv) : commerce.estimatedLtv,
      estimatedNextPurchase:
        (data.estimated_next_purchase as string | null) ?? commerce.estimatedNextPurchase,
    },
    performance: {
      sessions28d: Number(perf.sessions28d ?? 0),
      volume28d: Number(perf.volume28d ?? 0),
      trainingFrequency: Number(data.training_frequency ?? perf.trainingFrequency ?? 0),
      avgRpeHardStreak: Number(perf.avgRpeHardStreak ?? 0),
      performanceLevel:
        (data.performance_level as Customer360["performance"]["performanceLevel"]) ??
        perf.performanceLevel ??
        null,
    },
    nutrition: {
      proteinAdherence7d:
        data.nutrition_adherence != null
          ? Number(data.nutrition_adherence)
          : (nutri.proteinAdherence7d ?? null),
      mealsLogged7d: Number(nutri.mealsLogged7d ?? 0),
      weightTrendKg7d: nutri.weightTrendKg7d ?? null,
      latestWeightKg: nutri.latestWeightKg ?? null,
    },
    recovery: {
      recoveryScore:
        data.recovery_score != null ? Number(data.recovery_score) : (rec.recoveryScore ?? null),
      sleepAvg7d: rec.sleepAvg7d ?? null,
      fatigueSignal: rec.fatigueSignal === true,
    },
    supplements: {
      routineIds: Array.isArray(suppMetrics.routineIds) ? suppMetrics.routineIds : [],
      adherence30d:
        data.supplement_adherence != null
          ? Number(data.supplement_adherence)
          : (suppMetrics.adherence30d ?? null),
      restockEstimates,
    },
    behavior: {
      workoutsCompleted: Number(beh.workoutsCompleted ?? 0),
      mealsLogged: Number(beh.mealsLogged ?? 0),
      weightLogs: Number(beh.weightLogs ?? 0),
      supplementDays: Number(beh.supplementDays ?? 0),
      coachMessages: Number(beh.coachMessages ?? 0),
      streak: Number(beh.streak ?? 0),
    },
    goals: {
      currentGoal: (data.current_goal as Customer360["goals"]["currentGoal"]) ?? null,
      level: (data.performance_level as Customer360["goals"]["level"]) ?? null,
      daysPerWeek: null,
      source: data.current_goal ? "profile" : "none",
    },
  };
}
