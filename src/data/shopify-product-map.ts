import { productById } from "@/data/products";
import type { Goal } from "@/lib/types";

export type AccessTier = "base" | "performance";

export interface ShopifyLineItemLike {
  product_id?: number | string | null;
  variant_id?: number | string | null;
  sku?: string | null;
  title?: string | null;
  name?: string | null;
  quantity?: number | null;
  product_exists?: boolean;
}

export interface ShopifyMapEntry {
  productId: string;
  /** Keywords matched against title/sku (lowercase) */
  keywords: string[];
  exactSkus?: string[];
  shopifyHandle: string;
  servingsPerContainer: number;
  servingsPerDay: number;
  /** Suggested reorder / storefront path */
  storePath?: string;
}

/** Static Soldiers catalog ↔ app PRODUCTS.id */
export const SHOPIFY_PRODUCT_MAP: ShopifyMapEntry[] = [
  {
    productId: "whey-protein",
    keywords: ["whey", "whey protein", "concentrado", "isolado"],
    shopifyHandle: "whey-protein",
    servingsPerContainer: 30,
    servingsPerDay: 1,
  },
  {
    productId: "creatina",
    keywords: ["creatina", "creatine", "monoidratada"],
    shopifyHandle: "creatina-monoidratada",
    servingsPerContainer: 60,
    servingsPerDay: 1,
  },
  {
    productId: "beef-protein",
    keywords: ["beef protein", "beef", "carne"],
    shopifyHandle: "beef-protein",
    servingsPerContainer: 30,
    servingsPerDay: 1,
  },
  {
    productId: "pre-treino",
    keywords: ["striker", "pre-treino", "pré-treino", "pre treino", "preworkout"],
    shopifyHandle: "striker-pre-treino",
    servingsPerContainer: 20,
    servingsPerDay: 1,
  },
  {
    productId: "multivitaminico",
    keywords: ["multivitamin", "multivitamínico", "multi vitamin"],
    shopifyHandle: "multivitaminico",
    servingsPerContainer: 60,
    servingsPerDay: 1,
  },
  {
    productId: "omega-3",
    keywords: ["omega", "ômega", "omega-3", "fish oil"],
    shopifyHandle: "omega-3",
    servingsPerContainer: 60,
    servingsPerDay: 1,
  },
  {
    productId: "termogenico",
    keywords: ["termogenico", "termogênico", "thermogenic", "fat burner"],
    shopifyHandle: "termogenico",
    servingsPerContainer: 60,
    servingsPerDay: 1,
  },
  {
    productId: "glutamina",
    keywords: ["glutamina", "glutamine"],
    shopifyHandle: "glutamina",
    servingsPerContainer: 30,
    servingsPerDay: 1,
  },
];

const VIP_TAGS = new Set(["vip", "performance", "companion-pro", "soldiers-pro"]);

export function mapEntryByProductId(productId: string): ShopifyMapEntry | undefined {
  return SHOPIFY_PRODUCT_MAP.find((e) => e.productId === productId);
}

export function matchLineItem(item: ShopifyLineItemLike): ShopifyMapEntry | null {
  const sku = String(item.sku ?? "")
    .trim()
    .toLowerCase();
  const title = `${item.title ?? ""} ${item.name ?? ""}`.toLowerCase();

  for (const entry of SHOPIFY_PRODUCT_MAP) {
    if (entry.exactSkus?.some((s) => s.toLowerCase() === sku)) return entry;
  }
  for (const entry of SHOPIFY_PRODUCT_MAP) {
    if (sku && entry.keywords.some((k) => sku.includes(k))) return entry;
    if (entry.keywords.some((k) => title.includes(k))) return entry;
  }
  return null;
}

export function mapLineItemsToProductIds(items: ShopifyLineItemLike[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    const matched = matchLineItem(item);
    if (matched && !ids.includes(matched.productId)) ids.push(matched.productId);
  }
  return ids.slice(0, 5);
}

export function resolveAccessTier(
  productIds: string[],
  tags: string[] = [],
): AccessTier {
  if (tags.some((t) => VIP_TAGS.has(t.trim().toLowerCase()))) return "performance";
  if (productIds.includes("pre-treino")) return "performance";
  if (productIds.includes("whey-protein") && productIds.includes("creatina")) return "performance";
  return "base";
}

/** Suggest onboarding goal from purchased products */
export function suggestGoalFromProducts(productIds: string[]): Goal {
  if (productIds.includes("termogenico")) return "gordura";
  if (productIds.includes("pre-treino") || productIds.includes("creatina")) return "performance";
  if (productIds.includes("whey-protein") || productIds.includes("beef-protein")) return "massa";
  if (productIds.includes("multivitaminico") || productIds.includes("omega-3")) return "saude";
  return "massa";
}

export interface RestockEstimate {
  emptyAt: string;
  productId: string;
  daysLeft: number;
  quantity: number;
}

export function estimateRestock(
  productIds: string[],
  lineItems: ShopifyLineItemLike[],
  orderedAt: string | Date,
): Record<string, RestockEstimate> {
  const base = new Date(orderedAt);
  if (Number.isNaN(base.getTime())) return {};
  const out: Record<string, RestockEstimate> = {};

  for (const item of lineItems) {
    const matched = matchLineItem(item);
    if (!matched || !productIds.includes(matched.productId)) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const days = Math.max(
      1,
      Math.round((matched.servingsPerContainer * qty) / Math.max(1, matched.servingsPerDay)),
    );
    const empty = new Date(base);
    empty.setDate(empty.getDate() + days);
    const existing = out[matched.productId];
    if (existing && new Date(existing.emptyAt) > empty) continue;
    out[matched.productId] = {
      productId: matched.productId,
      emptyAt: empty.toISOString(),
      daysLeft: days,
      quantity: qty,
    };
  }

  // Fallback for ids without line detail
  for (const id of productIds) {
    if (out[id]) continue;
    const entry = mapEntryByProductId(id);
    if (!entry) continue;
    const days = Math.round(entry.servingsPerContainer / entry.servingsPerDay);
    const empty = new Date(base);
    empty.setDate(empty.getDate() + days);
    out[id] = {
      productId: id,
      emptyAt: empty.toISOString(),
      daysLeft: days,
      quantity: 1,
    };
  }
  return out;
}

export function getStorefrontBaseUrl(): string {
  const base =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SHOPIFY_STOREFRONT_URL"]) ||
    "https://soldiersnutrition.com.br";
  return String(base).replace(/\/$/, "");
}

export function storefrontProductUrl(handle: string, discountCode?: string | null): string {
  const root = getStorefrontBaseUrl();
  const path = `/products/${handle}`;
  if (discountCode) return `${root}${path}?discount=${encodeURIComponent(discountCode)}`;
  return `${root}${path}`;
}

/** Deep-link to a Performance-tier SKU (Striker / pré-treino unlocks VIP). */
export function performanceUpgradeUrl(discountCode?: string | null): string {
  const handle =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_PERFORMANCE_PRODUCT_HANDLE"]) ||
    "striker-pre-treino";
  return storefrontProductUrl(String(handle), discountCode);
}

export function reorderUrlForProduct(productId: string): string | null {
  const entry = mapEntryByProductId(productId);
  if (!entry) return null;
  const discount =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SHOPIFY_REORDER_DISCOUNT"]) ||
    undefined;
  return storefrontProductUrl(entry.shopifyHandle, discount || null);
}

/** Post-workout upsell: recovery product not yet in routine */
export function suggestPostWorkoutUpsell(routineIds: string[]): {
  productId: string;
  name: string;
  url: string;
} | null {
  const candidates = ["glutamina", "whey-protein", "creatina"];
  for (const id of candidates) {
    if (routineIds.includes(id)) continue;
    const p = productById(id);
    const url = reorderUrlForProduct(id);
    if (p && url) return { productId: id, name: p.name, url };
  }
  return null;
}

export function productLabels(ids: string[]): string[] {
  return ids.map((id) => productById(id)?.name ?? id);
}
