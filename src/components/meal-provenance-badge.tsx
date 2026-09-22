import { cn } from "@/lib/utils";
import {
  foodProvenanceLine,
  type FoodProvenanceInput,
} from "@/lib/nutrition/food-source-label";

export function MealProvenanceBadge({
  source,
  confidence,
  kind,
  className,
  warnEstimated,
}: FoodProvenanceInput & { className?: string; warnEstimated?: boolean }) {
  const line = foodProvenanceLine({ source, confidence, kind });
  const estimated = kind === "estimated" || source === "ai_estimate" || warnEstimated;
  return (
    <p
      className={cn(
        "text-xs",
        estimated ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        className,
      )}
      role="status"
    >
      {line}
      {estimated && kind === "estimated" ? " — confira antes de salvar" : ""}
    </p>
  );
}
