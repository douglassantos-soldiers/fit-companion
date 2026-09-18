import { forwardRef, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SessionLog } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ShareCardProps {
  athleteName: string;
  session: SessionLog;
  streak?: number;
  score?: number;
  className?: string;
}

export const ShareCardVisual = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCardVisual({ athleteName, session, streak = 0, score, className }, ref) {
    const doneSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
    const dateLabel = new Date(session.date.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-[320px] overflow-hidden rounded-2xl bg-[#141414] p-6 text-white",
          className,
        )}
        style={{ fontFamily: "Barlow, system-ui, sans-serif" }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #f5c518 0%, transparent 70%)" }}
        />
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[#f5c518]">
          Soldiers Training
        </p>
        <p className="mt-3 text-display text-2xl leading-none" style={{ fontFamily: "Anton, sans-serif" }}>
          {session.title}
        </p>
        <p className="mt-1 text-sm text-white/60">
          {athleteName} · {dateLabel}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <ShareStat label="Volume" value={`${Math.round(session.volumeKg).toLocaleString("pt-BR")}`} unit="kg" />
          <ShareStat label="Séries" value={`${doneSets}`} unit={`/ ${totalSets}`} />
          <ShareStat label="Tempo" value={`${session.durationMin}`} unit="min" />
        </div>
        {(streak > 0 || score != null) && (
          <div className="mt-4 flex gap-3 text-xs text-white/70">
            {streak > 0 ? <span>Streak {streak}d</span> : null}
            {score != null ? <span>Score {score}</span> : null}
          </div>
        )}
      </div>
    );
  },
);

function ShareStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-[0.6rem] uppercase tracking-wider text-white/50">{label}</p>
      <p className="text-display text-lg text-[#f5c518]" style={{ fontFamily: "Anton, sans-serif" }}>
        {value}
        <span className="ml-0.5 text-xs font-normal text-white/50">{unit}</span>
      </p>
    </div>
  );
}

export async function exportShareCardPng(node: HTMLElement): Promise<string> {
  return toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#141414",
  });
}

export function ShareCardActions({
  athleteName,
  session,
  streak,
  score,
  className,
}: ShareCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (mode: "download" | "share") => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      if (mode === "share" && typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
        const blob = await toBlob(ref.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#141414" });
        if (blob) {
          const file = new File([blob], `soldiers-${session.id}.png`, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: session.title,
              text: `${athleteName} · ${Math.round(session.volumeKg)} kg — Soldiers Training`,
            });
            toast.success("Compartilhado");
            return;
          }
        }
      }
      const dataUrl = await exportShareCardPng(ref.current);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `soldiers-${session.date.slice(0, 10)}.png`;
      a.click();
      toast.success(mode === "share" ? "Imagem baixada — compartilhe de onde quiser" : "Imagem salva");
    } catch {
      toast.error("Não foi possível gerar a imagem");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 p-3">
        <ShareCardVisual ref={ref} athleteName={athleteName} session={session} streak={streak ?? 0} score={score ?? 0} />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={() => void run("download")}>
          <Download className="size-4" /> Baixar
        </Button>
        <Button type="button" className="flex-1" disabled={busy} onClick={() => void run("share")}>
          <Share2 className="size-4" /> Compartilhar
        </Button>
      </div>
    </div>
  );
}
