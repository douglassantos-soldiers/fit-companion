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

/** Shared silhouette geometry — viewBox 160×220, vertical axis x=80. */
const NECK_BASE =
  "M68 44c4-1 20-1 24 0 6 4 8 12 6 18H62c-2-6 0-14 6-18z";

/** Shoulders / traps — symmetric cape under the neck. */
const PATH_OMBROS =
  "M46 52c2-6 10-10 18-10h32c8 0 16 4 18 10l6 18c1 4-1 6-5 6H45c-4 0-6-2-5-6l6-18z";

/** Chest — centered under shoulders. */
const PATH_PEITO =
  "M56 74c8-5 40-5 48 0 5 6 6 18 3 28-8 5-38 5-46 0-3-10-2-22-5-28z";

/** Arms (front) — mirrored biceps. */
const PATH_BICEPS =
  "M38 72c-5 1-7 8-6 18l2 20c1 4 5 5 8 3 2-2 3-5 2-9l-2-22c-1-5-1-10-4-10z" +
  "M122 72c5 1 7 8 6 18l-2 20c-1 4-5 5-8 3-2-2-3-5-2-9l2-22c1-5 1-10 4-10z";

/** Core / abs column. */
const PATH_CORE = "M64 102c5-2 27-2 32 0v34c-5 4-27 4-32 0V102z";

/** Legs — mirrored. */
const PATH_PERNAS =
  "M58 136c5 0 14 2 16 8v52c-3 5-14 5-18 0V144c0-4 1-8 2-8z" +
  "M102 136c-5 0-14 2-16 8v52c3 5 14 5 18 0V144c0-4-1-8-2-8z";

/** Back mass — centered diamond under shoulders. */
const PATH_COSTAS =
  "M54 72c10-8 42-8 52 0 6 12 6 36 0 50-8 5-36 5-44 0-6-14-6-38-8-50z";

/** Arms (back) — mirrored triceps. */
const PATH_TRICEPS =
  "M38 76c-5 2-6 10-4 20l2 18c2 3 5 4 8 1 2-2 2-5 1-9l-2-20c-1-5-1-10-5-10z" +
  "M122 76c5 2 6 10 4 20l-2 18c-2 3-5 4-8 1-2-2-2-5-1-9l2-20c1-5 1-10 5-10z";

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
    { group: "ombros", d: PATH_OMBROS },
    { group: "peito", d: PATH_PEITO },
    { group: "biceps", d: PATH_BICEPS },
    { group: "core", d: PATH_CORE },
    { group: "pernas", d: PATH_PERNAS },
  ];

  const backRegions: Array<{ group: MuscleGroup; d: string }> = [
    { group: "ombros", d: PATH_OMBROS },
    { group: "costas", d: PATH_COSTAS },
    { group: "triceps", d: PATH_TRICEPS },
    { group: "pernas", d: PATH_PERNAS },
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
            <path d={NECK_BASE} fill="currentColor" className="text-muted/30" />
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
            <path d={NECK_BASE} fill="currentColor" className="text-muted/30" />
            {backRegions.map(({ group, d }) => renderPath(group, d))}
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
