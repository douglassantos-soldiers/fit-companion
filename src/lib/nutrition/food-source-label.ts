/**
 * Friendly food source labels (Cronometer-style multi-source narrative).
 */
import type { FoodSource } from "@/lib/nutrition/types";

const LABELS: Record<FoodSource, string> = {
  internal: "Soldiers",
  taco: "TACO (NEPA/UNICAMP)",
  imported: "Open Food Facts",
  user: "Seu catálogo",
  ai_estimate: "Estimativa IA",
};

export function foodSourceLabel(source: FoodSource | string | undefined): string {
  if (!source) return "Soldiers";
  return LABELS[source as FoodSource] ?? String(source);
}

export type NutrientKindLabel = "observed" | "derived" | "estimated";

export type FoodProvenanceInput = {
  source?: FoodSource | string;
  confidence?: number | null;
  kind?: NutrientKindLabel | string | null;
};

const KIND_PT: Record<string, string> = {
  observed: "medido",
  derived: "derivado",
  estimated: "estimado",
};

/**
 * Single-line provenance before confirm: "TACO · 95% · medido"
 */
export function foodProvenanceLine(input: FoodProvenanceInput): string {
  const parts: string[] = [foodSourceLabel(input.source)];
  if (input.confidence != null && Number.isFinite(input.confidence)) {
    const pct = Math.round(Math.max(0, Math.min(1, input.confidence)) * 100);
    parts.push(`${pct}%`);
  }
  if (input.kind) {
    parts.push(KIND_PT[input.kind] ?? String(input.kind));
  }
  return parts.join(" · ");
}
