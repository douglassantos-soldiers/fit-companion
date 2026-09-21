import { useRef } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

function formatClock(total: number) {
  const m = Math.floor(Math.max(0, total) / 60);
  const s = Math.max(0, total) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RestTimer({
  seconds,
  paused,
  nextLabel,
  onTogglePause,
  onAdd30,
  onSkip,
}: {
  seconds: number;
  paused: boolean;
  nextLabel: string;
  onTogglePause: () => void;
  onAdd30: () => void;
  onSkip: () => void;
}) {
  const initialRef = useRef(Math.max(seconds, 1));
  if (seconds > initialRef.current) initialRef.current = seconds;
  const max = initialRef.current;
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, Math.max(0, seconds / max)) : 0;
  const offset = circumference - pct * circumference;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background/90 backdrop-blur-xl">
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="eyebrow">Descanso</p>
        <div className="relative mt-6 size-64">
          <svg viewBox="0 0 240 240" className="size-full -rotate-90">
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="10"
            />
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.p
              key={seconds}
              initial={{ scale: 0.94, opacity: 0.75 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-display text-glow text-5xl leading-none text-primary"
            >
              {formatClock(seconds)}
            </motion.p>
            <p className="mt-2 text-sm text-muted-foreground">{paused ? "Pausado" : "Continua!"}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Próximo · {nextLabel}</p>

        <div className="mt-10 w-full space-y-2">
          <Button type="button" className="glow-primary h-14 w-full font-bold uppercase" onClick={onTogglePause}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {paused ? "Continuar" : "Pausar"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={onAdd30}>
              +30s
            </Button>
            <Button type="button" variant="secondary" className="h-12" onClick={onSkip}>
              <SkipForward className="size-4" /> Pular
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
