import { Flame, Sparkles, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

export type HomeActionFeedbackData = {
  title: string;
  proteinLine?: string | null;
  streakDays: number;
  questsDone: number;
  questsTarget: number;
  nextHint?: string | null;
  nextCtaLabel?: string | null;
  onNext?: (() => void) | null;
};

/** Post-action strip: protein / streak / missions after meal or habit on Hoje. */
export function HomeActionFeedback({
  data,
  onDismiss,
}: {
  data: HomeActionFeedbackData;
  onDismiss: () => void;
}) {
  return (
    <section className="surface-glass mb-4 border-primary/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">Registrado</p>
          <p className="mt-1 text-sm font-semibold">{data.title}</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-muted-foreground"
          onClick={onDismiss}
        >
          Fechar
        </button>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {data.proteinLine ? (
          <li className="flex items-center gap-2">
            <Utensils className="size-3.5 text-primary" />
            <span className="text-foreground">{data.proteinLine}</span>
          </li>
        ) : null}
        <li className="flex items-center gap-2">
          <Flame className="size-3.5 text-primary" />
          Sequência {data.streakDays}d
        </li>
        <li className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          Missões {data.questsDone}/{data.questsTarget}
        </li>
      </ul>
      {data.nextHint ? (
        <p className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold">
          {data.nextHint}
        </p>
      ) : null}
      {data.onNext && data.nextCtaLabel ? (
        <Button
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            data.onNext?.();
            onDismiss();
          }}
        >
          {data.nextCtaLabel}
        </Button>
      ) : null}
    </section>
  );
}
