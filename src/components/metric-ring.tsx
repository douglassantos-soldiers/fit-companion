export function MetricRing({
  value,
  max,
  label,
  unit,
}: {
  value: number;
  max: number;
  label: string;
  unit?: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-[74px]">
        <svg viewBox="0 0 74 74" className="size-full -rotate-90">
          <circle cx="37" cy="37" r={radius} fill="none" stroke="var(--muted)" strokeWidth="7" />
          <circle
            cx="37"
            cy="37"
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span className="text-display absolute inset-0 flex items-center justify-center text-sm">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xs text-foreground">
          {value}
          {unit ? ` ${unit}` : ""}
        </p>
      </div>
    </div>
  );
}
