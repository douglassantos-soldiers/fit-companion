import { useState } from "react";
import { cn } from "@/lib/utils";

export function ComparisonSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Antes",
  afterLabel = "Agora",
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pct, setPct] = useState(50);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-black">
        <img src={afterUrl} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" />
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-white/80"
          style={{ left: `${pct}%` }}
        />
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
          {beforeLabel}
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
          {afterLabel}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label="Comparar antes e agora"
      />
      <div className="grid grid-cols-2 gap-2">
        <SidePreview url={beforeUrl} label={beforeLabel} />
        <SidePreview url={afterUrl} label={afterLabel} />
      </div>
    </div>
  );
}

function SidePreview({ url, label }: { url: string; label: string }) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border border-white/10")}>
      <img src={url} alt={label} className="aspect-[3/4] w-full object-cover" />
      <figcaption className="px-2 py-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}
