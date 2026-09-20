import { Utensils } from "lucide-react";
import type { MealPreset } from "@/data/meal-presets";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { resolveMealMedia } from "@/lib/soldiers-media";
import { cn } from "@/lib/utils";

/** Mini thumb de preset: Soldiers poster → Unsplash legado → gradient. */
export function MealPresetThumb({
  preset,
  className,
  iconClassName,
}: {
  preset: Pick<MealPreset, "id" | "quality" | "imageUrl" | "label">;
  className?: string;
  iconClassName?: string;
}) {
  const media = resolveMealMedia(preset.id, preset.imageUrl);
  const thumb = (
    <SoldiersMediaThumb media={media} alt={preset.label} className={className ?? "size-12"} />
  );
  if (media.posterUrl || media.thumbnailUrl) {
    return thumb;
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
