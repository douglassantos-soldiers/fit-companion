import { Utensils } from "lucide-react";
import type { MealPreset } from "@/data/meal-presets";
import { mealImageUrl } from "@/lib/cms";
import { cn } from "@/lib/utils";

/** Mini thumb de preset: foto se houver imageUrl, senão gradient por quality. */
export function MealPresetThumb({
  preset,
  className,
  iconClassName,
}: {
  preset: Pick<MealPreset, "id" | "quality" | "imageUrl" | "label">;
  className?: string;
  iconClassName?: string;
}) {
  const src = mealImageUrl(preset.id, preset.imageUrl);
  if (src) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden rounded-xl", className ?? "size-12")}>
        <img
          src={src}
          alt=""
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          sizes="48px"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        className ?? "size-12",
        preset.quality === "verde" && "bg-gradient-to-br from-emerald-500/40 to-primary/20",
        preset.quality === "amarelo" && "bg-gradient-to-br from-primary/50 to-amber-600/30",
        preset.quality === "laranja" && "bg-gradient-to-br from-orange-500/40 to-primary/15",
      )}
      aria-hidden
    >
      <Utensils className={cn("size-5 text-primary", iconClassName)} />
    </div>
  );
}
