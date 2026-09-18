import { Pause, Play, SkipForward, Timer } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background/80 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto size-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="eyebrow">Descanso</p>
        <motion.p
          key={seconds}
          initial={{ scale: 0.92, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-display text-glow mt-4 text-[6.5rem] leading-none text-primary"
        >
          {seconds}
        </motion.p>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="size-4" />
          {paused ? "Pausado" : "Próximo"} · {nextLabel}
        </p>

        <div className="surface-glass mt-10 grid w-full grid-cols-3 gap-2 p-3">
          <Button type="button" variant="secondary" className="h-12" onClick={onTogglePause}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {paused ? "Continuar" : "Pausar"}
          </Button>
          <Button type="button" variant="outline" className="h-12" onClick={onAdd30}>
            +30s
          </Button>
          <Button type="button" variant="default" className="glow-primary h-12" onClick={onSkip}>
            <SkipForward className="size-4" /> Pular
          </Button>
        </div>
      </div>
    </div>
  );
}
