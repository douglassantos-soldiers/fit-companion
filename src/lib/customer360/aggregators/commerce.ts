import type { AppState } from "@/lib/types";
import type { Commerce360 } from "@/lib/customer360/types";

export function emptyCommerce(): Commerce360 {
  return {
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
}

/** State-only commerce signals (products purchased). Full RFM comes from loadCommerce360. */
export function aggregateCommerceFromState(state: AppState): Commerce360 {
  const productIds = state.purchaseProductIds ?? [];
  return {
    ...emptyCommerce(),
    productIds,
    favoriteProducts: productIds.slice(0, 5),
    totalOrders: productIds.length ? 1 : 0,
  };
}
