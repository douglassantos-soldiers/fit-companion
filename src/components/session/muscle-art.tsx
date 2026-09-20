import { motion } from "motion/react";
import type { MuscleGroup } from "@/data/exercises";
import { SoldiersMediaFrame } from "@/components/soldiers-media-frame";
import type { ResolvedMedia } from "@/lib/soldiers-media";
import { cn } from "@/lib/utils";

const LABELS: Record<MuscleGroup, string> = {
  peito: "Peito",
  costas: "Costas",
  pernas: "Pernas",
  ombros: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  core: "Core",
  cardio: "Cardio",
};

/** NTC-like Soldiers stage art per muscle group (no external media). */
export function MuscleArt({
  group,
  mediaUrl,
  media,
  className,
}: {
  group: MuscleGroup;
  mediaUrl?: string;
  media?: ResolvedMedia;
  className?: string;
}) {
  const pack =
    media ??
    (mediaUrl
      ? {
          kind: "exercise" as const,
          entityId: "",
          source: "legacy" as const,
          needsMotion: false,
          posterUrl: mediaUrl,
        }
      : undefined);

  if (pack && (pack.posterUrl || pack.webmUrl || pack.mp4Url || pack.gifUrl)) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        <SoldiersMediaFrame media={pack} alt={LABELS[group]} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
          <p className="text-display text-sm tracking-[0.25em] text-primary">{LABELS[group]}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden border border-white/5 bg-[#080808]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/25 via-transparent to-black/85" />
      <div className="pointer-events-none absolute -left-16 top-8 size-56 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 size-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-1/4 top-1/3 h-24 rounded-full bg-primary/20 blur-2xl" />

      <motion.div
        className="relative z-10 flex h-[75%] w-[75%] items-center justify-center"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 200 160" className="h-full w-full text-primary drop-shadow-[0_0_36px_var(--glow-primary)]" aria-hidden>
          {group === "peito" && (
            <>
              <ellipse cx="70" cy="80" rx="36" ry="42" fill="currentColor" opacity="0.9" />
              <ellipse cx="130" cy="80" rx="36" ry="42" fill="currentColor" opacity="0.9" />
              <rect x="92" y="55" width="16" height="55" rx="4" fill="currentColor" opacity="0.45" />
            </>
          )}
          {group === "costas" && (
            <>
              <path d="M40 50 L100 30 L160 50 L150 120 L100 140 L50 120 Z" fill="currentColor" opacity="0.85" />
              <path d="M100 40 V130" stroke="currentColor" strokeWidth="6" opacity="0.35" />
            </>
          )}
          {group === "pernas" && (
            <>
              <rect x="60" y="30" width="28" height="100" rx="10" fill="currentColor" opacity="0.9" />
              <rect x="112" y="30" width="28" height="100" rx="10" fill="currentColor" opacity="0.9" />
              <rect x="55" y="120" width="38" height="22" rx="6" fill="currentColor" opacity="0.5" />
              <rect x="107" y="120" width="38" height="22" rx="6" fill="currentColor" opacity="0.5" />
            </>
          )}
          {group === "ombros" && (
            <>
              <circle cx="55" cy="70" r="28" fill="currentColor" opacity="0.9" />
              <circle cx="145" cy="70" r="28" fill="currentColor" opacity="0.9" />
              <rect x="75" y="55" width="50" height="30" rx="8" fill="currentColor" opacity="0.4" />
            </>
          )}
          {(group === "biceps" || group === "triceps") && (
            <>
              <rect x="85" y="25" width="30" height="90" rx="12" fill="currentColor" opacity="0.85" />
              <ellipse cx="100" cy="70" rx="28" ry="22" fill="currentColor" opacity="0.95" />
              <circle cx="100" cy="125" r="14" fill="currentColor" opacity="0.5" />
            </>
          )}
          {group === "core" && (
            <>
              <rect x="70" y="35" width="60" height="90" rx="12" fill="currentColor" opacity="0.8" />
              <path d="M78 55 H122 M78 75 H122 M78 95 H122" stroke="#0c0c0c" strokeWidth="4" opacity="0.45" />
            </>
          )}
          {group === "cardio" && (
            <>
              <path
                d="M20 90 H55 L70 40 L95 120 L115 60 L135 90 H180"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-3 pt-8">
        <p className="text-display text-sm tracking-[0.25em] text-primary">{LABELS[group]}</p>
        <p className="mt-0.5 text-[0.65rem] uppercase tracking-wider text-white/50">Soldiers Training</p>
      </div>
    </div>
  );
}
