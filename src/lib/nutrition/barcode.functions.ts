/**
 * Open Food Facts barcode lookup (Fase 13). No Postgres write. Access session + rate limit.
 */
import { createServerFn } from "@tanstack/react-start";
import { rateLimitKey, readAccessSession } from "@/lib/access-session.server";
import { barcodeHitFromOffProduct, parseEan, type BarcodeHit } from "@/lib/nutrition/barcode";

export type BarcodeLookupResult =
  | { found: true; hit: BarcodeHit; error?: undefined }
  | { found: false; error?: "unauthorized" | "rate_limited" | "invalid" | "upstream" | "not_found" };

function parseInput(input: unknown): { ean: string } {
  const ean = parseEan(String((input as { ean?: string } | null)?.ean ?? ""));
  if (!ean) throw new Error("ean inválido");
  return { ean };
}

export const lookupBarcodeFn = createServerFn({ method: "POST" })
  .inputValidator(parseInput)
  .handler(async ({ data }): Promise<BarcodeLookupResult> => {
    const session = readAccessSession();
    if (!session) return { found: false, error: "unauthorized" };
    if (!rateLimitKey(`barcode:${session.email}`, 60, 60 * 60_000)) {
      return { found: false, error: "rate_limited" };
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${data.ean}.json`, {
        signal: ctrl.signal,
        headers: { "User-Agent": "SoldiersTraining/1.0 (nutrition barcode)" },
      });
      if (!res.ok) return { found: false, error: res.status === 404 ? "not_found" : "upstream" };
      const json = (await res.json()) as {
        status?: number;
        product?: {
          product_name?: string;
          brands?: string;
          nutriments?: Record<string, number | string | undefined>;
          serving_quantity?: number | string;
        };
      };
      if (json.status !== 1 || !json.product) return { found: false, error: "not_found" };
      const hit = barcodeHitFromOffProduct(data.ean, json.product);
      if (!hit) return { found: false, error: "not_found" };
      return { found: true, hit };
    } catch {
      return { found: false, error: "upstream" };
    } finally {
      clearTimeout(timer);
    }
  });
