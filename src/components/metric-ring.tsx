import { cn } from "@/lib/utils";

export function MetricRing({
  value,
  max,
  label,
  unit,
  size = "md",
}: {
  value: number;
  max: number;
  label: string;
  unit?: string;
  size?: "md" | "lg";
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const large = size === "lg";
  const radius = large ? 34 : 30;
  const view = large ? 86 : 74;
  const cx = view / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", large ? "size-[86px]" : "size-[62px] sm:size-[74px]")}>
        <svg
          viewBox={`0 0 ${view} ${view}`}
          className={cn(
            "size-full -rotate-90 transition-[filter] duration-500",
            pct > 0 && "motion-safe:[filter:drop-shadow(0_0_6px_var(--glow-primary))]",
          )}
        >
          <circle cx={cx} cy={cx} r={radius} fill="none" stroke="var(--muted)" strokeWidth={large ? 8 : 7} />
          <circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={large ? 8 : 7}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span
          className={cn(
            "text-display absolute inset-0 flex items-center justify-center",
            large ? "text-sm" : "text-xs sm:text-sm",
          )}
        >
          {Math.round(pct)}%
        </span>
      </div>
      <div className="text-center">
        <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[0.7rem]">
          {label}
        </p>
        <p className="text-xs text-foreground">
          {value}
          {unit ? ` ${unit}` : ""}
        </p>
      </div>
    </div>
  );
}
