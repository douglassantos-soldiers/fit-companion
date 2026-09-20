import type { MuscleGroup } from "@/data/exercises";
import type { MuscleRecovery } from "@/lib/engine/recovery";
import { recoveryLabel } from "@/lib/engine/recovery";
import { cn } from "@/lib/utils";

function heatFill(freshness: number): string {
  // Fatigue heatmap: low freshness = more intense (fatigued), high = muted/ready
  if (freshness >= 70) return "var(--primary)";
  if (freshness >= 35) return "var(--chart-2)";
  return "var(--chart-4)";
}

function heatOpacity(freshness: number): number {
  // Ready muscles glow softer; fatigued muscles more opaque
  return Math.max(0.25, Math.min(0.95, 1 - freshness / 140));
}

/**
 * Front/back body silhouette with muscle-group heat by recovery freshness.
 */
export function MuscleHeatmap({
  recovery,
  className,
}: {
  recovery: MuscleRecovery[];
  className?: string;
}) {
  const byGroup = new Map(recovery.map((m) => [m.group, m]));
  const get = (g: MuscleGroup) => byGroup.get(g);

  const regions: Array<{ group: MuscleGroup; d: string; cx?: number; cy?: number }> = [
    { group: "ombros", d: "M52 48c-10 2-18 12-20 22 8 4 16 6 28 6 12 0 20-2 28-6-2-10-10-20-20-22-5-1-11-1-16 0z" },
    { group: "peito", d: "M60 72c8-4 24-4 32 0 4 8 4 20 0 28-8 4-24 4-32 0-4-8-4-20 0-28z" },
    { group: "biceps", d: "M38 78c-6 2-10 14-8 28 4 4 10 4 14 0 0-12 0-24-2-28-1-2-3-2-4 0z M114 78c6 2 10 14 8 28-4 4-10 4-14 0 0-12 0-24 2-28 1-2 3-2 4 0z" },
    { group: "core", d: "M68 100c6-2 20-2 26 0v36c-6 4-20 4-26 0V100z" },
    { group: "pernas", d: "M64 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z M86 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z" },
  ];

  const backRegions: Array<{ group: MuscleGroup; d: string }> = [
    { group: "costas", d: "M58 70c10-8 26-8 36 0 6 14 4 40-4 52-8 4-24 4-32 0-8-12-10-38-0-52z" },
    { group: "triceps", d: "M40 82c-4 4-6 18-2 30 4 2 10 2 12-2-2-10-2-22-4-28-1-2-4-2-6 0z M112 82c4 4 6 18 2 30-4 2-10 2-12-2 2-10 2-22 4-28 1-2 4-2 6 0z" },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-3">
        <figure className="rounded-xl border border-white/10 bg-background/40 p-2">
          <figcaption className="mb-1 text-center text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Frente
          </figcaption>
          <svg viewBox="0 0 160 220" className="mx-auto h-48 w-full" role="img" aria-label="Mapa muscular frontal">
            <ellipse cx="80" cy="28" rx="14" ry="16" fill="currentColor" className="text-muted/40" />
            <path
              d="M66 44c4-2 24-2 28 0 8 6 10 14 8 22H58c-2-8 0-16 8-22z"
              fill="currentColor"
              className="text-muted/30"
            />
            {regions.map(({ group, d }) => {
              const m = get(group);
              const freshness = m?.freshness ?? 100;
              return (
                <path
                  key={group}
                  d={d}
                  fill={heatFill(freshness)}
                  opacity={heatOpacity(freshness)}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.8"
                >
                  <title>
                    {m?.label ?? group}: {recoveryLabel(freshness)} · {freshness}%
                  </title>
                </path>
              );
            })}
          </svg>
        </figure>

        <figure className="rounded-xl border border-white/10 bg-background/40 p-2">
          <figcaption className="mb-1 text-center text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Costas
          </figcaption>
          <svg viewBox="0 0 160 220" className="mx-auto h-48 w-full" role="img" aria-label="Mapa muscular costas">
            <ellipse cx="80" cy="28" rx="14" ry="16" fill="currentColor" className="text-muted/40" />
            <path
              d="M66 44c4-2 24-2 28 0 8 6 10 14 8 22H58c-2-8 0-16 8-22z"
              fill="currentColor"
              className="text-muted/30"
            />
            {backRegions.map(({ group, d }) => {
              const m = get(group);
              const freshness = m?.freshness ?? 100;
              return (
                <path
                  key={group}
                  d={d}
                  fill={heatFill(freshness)}
                  opacity={heatOpacity(freshness)}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.8"
                >
                  <title>
                    {m?.label ?? group}: {recoveryLabel(freshness)} · {freshness}%
                  </title>
                </path>
              );
            })}
            {/* legs also on back view */}
            {(() => {
              const m = get("pernas");
              const freshness = m?.freshness ?? 100;
              return (
                <path
                  d="M64 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z M86 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z"
                  fill={heatFill(freshness)}
                  opacity={heatOpacity(freshness)}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.8"
                >
                  <title>
                    {m?.label ?? "Pernas"}: {recoveryLabel(freshness)} · {freshness}%
                  </title>
                </path>
              );
            })()}
          </svg>
        </figure>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        {recovery
          .filter((m) => m.group !== "cardio")
          .map((m) => (
            <li key={m.group} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: heatFill(m.freshness), opacity: heatOpacity(m.freshness) + 0.2 }}
                />
                {m.label}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {m.freshness}%
                {m.lastVolume != null && m.lastVolume > 0 ? (
                  <span className="ml-1 text-[0.6rem] opacity-70">· {m.lastVolume}v</span>
                ) : null}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
