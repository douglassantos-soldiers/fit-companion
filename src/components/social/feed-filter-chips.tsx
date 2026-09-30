import { cn } from "@/lib/utils";

export type FeedFilter = "foryou" | "following" | "club";

const FILTERS: Array<{ id: FeedFilter; label: string }> = [
  { id: "foryou", label: "Para você" },
  { id: "following", label: "Seguindo" },
  { id: "club", label: "Meu grupo" },
];

export function FeedFilterChips({
  value,
  onChange,
}: {
  value: FeedFilter;
  onChange: (next: FeedFilter) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Filtro do feed">
      {FILTERS.map((f) => {
        const active = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "border border-white/10 bg-muted/30 text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(f.id)}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
