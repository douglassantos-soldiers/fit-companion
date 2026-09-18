/**
 * Server-side Customer 360 recompute → customer_profiles.
 */
import { buildCustomer360FromState, type Commerce360, type Customer360 } from "@/lib/customer360";
import { emptyState, type AppState } from "@/lib/types";
import { adminDbLoose } from "@/lib/db-admin";

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

export async function recomputeCustomerProfile(
  userId: string,
  state?: AppState | null,
): Promise<Customer360 | null> {
  const commerce = await loadCommerce360(userId);
  const base = buildCustomer360FromState(
    state ?? {
      ...emptyState,
      purchaseProductIds: commerce.productIds,
    },
    { userId },
  );

  const c360: Customer360 = {
    ...base,
    commerce: { ...base.commerce, ...commerce },
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
        },
        updated_at: c360.updatedAt,
      },
      { onConflict: "user_id" },
    );
  }

  return c360;
}
