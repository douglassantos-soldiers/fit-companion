/**
 * Open Food Facts barcode lookup (Fase 13). No Postgres write.
 * Auth via resolveTrustedIdentity (access cookie + device bind).
 */
import { createServerFn } from "@tanstack/react-start";
import { rateLimitKey } from "@/lib/access-session.server";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import { barcodeHitFromOffProduct, parseEan, type BarcodeHit } from "@/lib/nutrition/barcode";

export type BarcodeLookupResult =
  | { found: true; hit: BarcodeHit; error?: undefined }
  | {
      found: false;
      error?: "unauthorized" | "rate_limited" | "invalid" | "upstream" | "not_found";
    };

function parseInput(input: unknown): { ean: string; deviceId: string } {
  const raw = input as { ean?: string; deviceId?: string } | null;
  const ean = parseEan(String(raw?.ean ?? ""));
  if (!ean) throw new Error("ean inválido");
  const deviceId = String(raw?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { ean, deviceId };
}

export const lookupBarcodeFn = createServerFn({ method: "POST" })
  .inputValidator(parseInput)
  .handler(async ({ data }): Promise<BarcodeLookupResult> => {
    const identity = await resolveTrustedIdentity({
      deviceId: data.deviceId,
      requireAccess: true,
    });
    if (!identity) return { found: false, error: "unauthorized" };
    const rlKey = identity.email ?? identity.userId;
    if (!rateLimitKey(`barcode:${rlKey}`, 60, 60 * 60_000)) {
      return { found: false, error: "rate_limited" };
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`https://br.openfoodfacts.org/api/v2/product/${data.ean}.json`, {
        signal: ctrl.signal,
        headers: { "User-Agent": "SoldiersTraining/1.0 (nutrition barcode)" },
      });
      if (!res.ok) {
        const world = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${data.ean}.json`,
          {
            signal: ctrl.signal,
            headers: { "User-Agent": "SoldiersTraining/1.0 (nutrition barcode)" },
          },
        );
        if (!world.ok)
          return { found: false, error: res.status === 404 ? "not_found" : "upstream" };
        const json = (await world.json()) as {
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
      }
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
