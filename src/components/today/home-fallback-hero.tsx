import { Link } from "@tanstack/react-router";
import { Play, Utensils, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Degraded hero when Decision/Living Plan is missing — never leave Hoje without a primary action. */
export function HomeFallbackHero({
  workoutDayId,
  express,
  estimatedMin,
  onRegisterMeal,
}: {
  workoutDayId: string | null;
  express: boolean;
  estimatedMin?: number | null;
  onRegisterMeal: () => void;
}) {
  return (
    <section className="surface-glass relative mb-4 overflow-hidden p-5">
      <p className="eyebrow">Meta do dia</p>
      <p className="text-display mt-1 text-2xl text-foreground">
        {workoutDayId ? "Treinar agora" : "Monte seu dia"}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Seu plano ainda está calibrando — comece com pouca fricção.
      </p>

      {workoutDayId ? (
        <Link
          to="/treino/sessao/$id"
          params={{ id: workoutDayId }}
          search={{ express: true, from: "hoje" }}
          className="mt-4 block"
        >
          <Button className="glow-primary h-14 w-full font-bold uppercase tracking-wide">
            {express ? <Zap className="size-4" /> : <Play className="size-4" />}
            Começar Express
            {estimatedMin ? (
              <span className="ml-1 font-normal normal-case tracking-normal opacity-80">
                · {estimatedMin} min
              </span>
            ) : null}
          </Button>
        </Link>
      ) : (
        <Link to="/treino" className="mt-4 block">
          <Button className="glow-primary h-14 w-full font-bold uppercase tracking-wide">
            <Play className="size-4" /> Ir para Treino
          </Button>
        </Link>
      )}

      <Button
        variant="secondary"
        className="mt-2 h-12 w-full font-bold uppercase tracking-wide"
        onClick={onRegisterMeal}
      >
        <Utensils className="size-4" /> Registrar refeição
      </Button>
    </section>
  );
}
