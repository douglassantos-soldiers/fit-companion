import type { MuscleGroup } from "@/data/exercises";
import type { MuscleRecovery } from "@/lib/engine/recovery";
import { recoveryLabel } from "@/lib/engine/recovery";
import { cn } from "@/lib/utils";

function heatFill(freshness: number, empty?: boolean): string {
  if (empty) return "var(--muted-foreground)";
  if (freshness >= 70) return "var(--primary)";
  if (freshness >= 35) return "var(--chart-2)";
  return "var(--chart-4)";
}

function heatOpacity(freshness: number, empty?: boolean): number {
  if (empty) return 0.22;
  return Math.max(0.25, Math.min(0.95, 1 - freshness / 140));
}

/**
 * Front/back body silhouette with muscle-group heat by recovery freshness.
 */
export function MuscleHeatmap({
  recovery,
  className,
  empty = false,
  selected,
  onSelectMuscle,
  showLegend = false,
}: {
  recovery: MuscleRecovery[];
  className?: string;
  /** No recent load — muted silhouette (not “fully recovered”). */
  empty?: boolean;
  selected?: MuscleGroup | null;
  onSelectMuscle?: (group: MuscleGroup) => void;
  /** Legacy inline % list; prefer unified list in MuscleRecoveryCard. */
  showLegend?: boolean;
}) {
  const byGroup = new Map(recovery.map((m) => [m.group, m]));
  const get = (g: MuscleGroup) => byGroup.get(g);
  const interactive = Boolean(onSelectMuscle);

  const regions: Array<{ group: MuscleGroup; d: string }> = [
    {
      group: "ombros",
      d: "M52 48c-10 2-18 12-20 22 8 4 16 6 28 6 12 0 20-2 28-6-2-10-10-20-20-22-5-1-11-1-16 0z",
    },
    {
      group: "peito",
      d: "M60 72c8-4 24-4 32 0 4 8 4 20 0 28-8 4-24 4-32 0-4-8-4-20 0-28z",
    },
    {
      group: "biceps",
      d: "M38 78c-6 2-10 14-8 28 4 4 10 4 14 0 0-12 0-24-2-28-1-2-3-2-4 0z M114 78c6 2 10 14 8 28-4 4-10 4-14 0 0-12 0-24 2-28 1-2 3-2 4 0z",
    },
    { group: "core", d: "M68 100c6-2 20-2 26 0v36c-6 4-20 4-26 0V100z" },
    {
      group: "pernas",
      d: "M64 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z M86 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z",
    },
  ];

  const backRegions: Array<{ group: MuscleGroup; d: string }> = [
    {
      group: "costas",
      d: "M58 70c10-8 26-8 36 0 6 14 4 40-4 52-8 4-24 4-32 0-8-12-10-38-0-52z",
    },
    {
      group: "triceps",
      d: "M40 82c-4 4-6 18-2 30 4 2 10 2 12-2-2-10-2-22-4-28-1-2-4-2-6 0z M112 82c4 4 6 18 2 30-4 2-10 2-12-2 2-10 2-22 4-28 1-2 4-2 6 0z",
    },
    {
      group: "ombros",
      d: "M52 48c-10 2-18 12-20 22 8 4 16 6 28 6 12 0 20-2 28-6-2-10-10-20-20-22-5-1-11-1-16 0z",
    },
  ];

  const renderPath = (group: MuscleGroup, d: string) => {
    const m = get(group);
    const freshness = empty ? 100 : (m?.freshness ?? 100);
    const isSelected = selected === group;
    return (
      <path
        key={group}
        d={d}
        fill={heatFill(freshness, empty)}
        opacity={heatOpacity(freshness, empty)}
        stroke={isSelected ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)"}
        strokeWidth={isSelected ? 1.6 : 0.8}
        className={interactive ? "cursor-pointer transition-opacity hover:opacity-100" : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          m
            ? `${m.label}: ${empty ? "Sem dado" : recoveryLabel(freshness)} · ${m.freshness}%`
            : group
        }
        onClick={interactive ? () => onSelectMuscle?.(group) : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectMuscle?.(group);
                }
              }
            : undefined
        }
      />
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-3">
        <figure className="rounded-xl border border-white/10 bg-background/40 p-2">
          <figcaption className="mb-1 text-center text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Frente
          </figcaption>
          <svg
            viewBox="0 0 160 220"
            className="mx-auto h-48 w-full"
            role="img"
            aria-label="Mapa muscular frontal"
          >
            <ellipse cx="80" cy="28" rx="14" ry="16" fill="currentColor" className="text-muted/40" />
            <path
              d="M66 44c4-2 24-2 28 0 8 6 10 14 8 22H58c-2-8 0-16 8-22z"
              fill="currentColor"
              className="text-muted/30"
            />
            {regions.map(({ group, d }) => renderPath(group, d))}
          </svg>
        </figure>

        <figure className="rounded-xl border border-white/10 bg-background/40 p-2">
          <figcaption className="mb-1 text-center text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            Costas
          </figcaption>
          <svg
            viewBox="0 0 160 220"
            className="mx-auto h-48 w-full"
            role="img"
            aria-label="Mapa muscular costas"
          >
            <ellipse cx="80" cy="28" rx="14" ry="16" fill="currentColor" className="text-muted/40" />
            <path
              d="M66 44c4-2 24-2 28 0 8 6 10 14 8 22H58c-2-8 0-16 8-22z"
              fill="currentColor"
              className="text-muted/30"
            />
            {backRegions.map(({ group, d }) => renderPath(group, d))}
            {renderPath(
              "pernas",
              "M64 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z M86 138c4 0 10 2 12 8v48c-4 4-12 4-16 0V146c0-4 2-8 4-8z",
            )}
          </svg>
        </figure>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[0.65rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--primary)" }} />
          Pronto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} />
          Ok
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--chart-4)" }} />
          Fatigado
        </span>
        {empty ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/40" />
            Sem carga
          </span>
        ) : null}
      </div>

      {showLegend ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
          {recovery
            .filter((m) => m.group !== "cardio")
            .map((m) => (
              <li key={m.group} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background: heatFill(m.freshness, empty),
                      opacity: heatOpacity(m.freshness, empty) + 0.2,
                    }}
                  />
                  {m.label}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {empty ? "—" : `${m.freshness}%`}
                </span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
