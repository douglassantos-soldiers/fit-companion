import { Link } from "@tanstack/react-router";
import { Chip } from "@heroui/react";
import { Users, X } from "lucide-react";
import { ActivityFeed } from "@/components/social/activity-feed";
import { SoldiersMediaThumb } from "@/components/soldiers-media-frame";
import { MetricRing } from "@/components/metric-ring";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OnboardingTip } from "@/data/onboarding-tips";
import type { SupplementProduct } from "@/data/products";
import type { HomePersona } from "@/lib/engine/home-persona";
import { resolveProductMedia } from "@/lib/soldiers-media";
import type { ActivityEvent, ClubStory, FriendQuest } from "@/lib/social";

export function HomeMaisDoDia({
  persona,
  showLeague,
  stories,
  club,
  clubFeed,
  deviceId,
  kudosGiven,
  onKudos,
  onKudosQuest,
  tip,
  onMarkTipSeen,
  summary,
  questsDone,
  score,
  metricsWaterMl,
  waterGoalMl,
  proteinG,
  proteinGoalG,
  takenCount,
  routineMax,
  doneToday,
  routine,
  takenIds,
  nowSuggestionId,
  onToggleSupplement,
}: {
  persona: HomePersona;
  showLeague: boolean;
  stories: ClubStory[];
  club: { name: string } | null;
  clubFeed: ActivityEvent[];
  deviceId: string;
  kudosGiven: Record<string, boolean>;
  onKudos: (id: string) => void;
  onKudosQuest: () => void;
  tip: OnboardingTip | null;
  onMarkTipSeen: (id: string) => void;
  summary: { trained: boolean; proteinPct: number; waterPct: number };
  questsDone: number;
  score: number;
  metricsWaterMl: number;
  waterGoalMl: number;
  proteinG: number;
  proteinGoalG: number;
  takenCount: number;
  routineMax: number;
  doneToday: boolean;
  routine: SupplementProduct[];
  takenIds: string[];
  nowSuggestionId: string | null;
  onToggleSupplement: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {showLeague && stories.length ? (
        <Link
          to="/social"
          search={{ tab: "clubes" }}
          className="mb-0 flex gap-2 overflow-x-auto pb-1"
        >
          {stories.map((s) => (
            <div key={s.id} className="shrink-0 text-center">
              <img
                src={s.imageUrl}
                alt={s.displayName}
                className="size-14 rounded-full border-2 border-primary object-cover"
              />
              <p className="mt-1 max-w-14 truncate text-[0.6rem] text-muted-foreground">
                {s.displayName}
              </p>
            </div>
          ))}
        </Link>
      ) : null}

      {showLeague ? (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-semibold">{club ? `Clube · ${club.name}` : "Clube"}</p>
            <Link to="/social" search={{ tab: "feed" }} className="text-xs text-primary">
              Ver mais
            </Link>
          </div>
          {club ? (
            <ActivityFeed
              events={clubFeed}
              deviceId={deviceId}
              kudosGiven={kudosGiven}
              compact
              onKudos={onKudos}
              onKudosQuest={onKudosQuest}
            />
          ) : (
            <Link
              to="/social"
              search={{ tab: "clubes" }}
              className="surface-glass flex items-center gap-3 p-4"
            >
              <Users className="size-5 text-primary" />
              <div>
                <p className="text-sm font-bold">Entre num clube</p>
                <p className="text-xs text-muted-foreground">Feed, liga e pressão saudável</p>
              </div>
            </Link>
          )}
        </section>
      ) : null}

      {persona !== "novo" && tip ? (
        <div className="surface-glass p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow">Dica</p>
              <p className="mt-1 text-sm font-semibold">{tip.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tip.body}</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Dispensar"
              onClick={() => onMarkTipSeen(tip.id)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Link to={tip.ctaTo} className="flex-1">
              <Button size="sm" className="w-full" onClick={() => onMarkTipSeen(tip.id)}>
                {tip.ctaLabel}
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => onMarkTipSeen(tip.id)}>
              Entendi
            </Button>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="status">
        <TabsList className="w-full rounded-full bg-muted/40 p-1">
          <TabsTrigger value="status" className="flex-1 rounded-full">
            Status
          </TabsTrigger>
          <TabsTrigger value="rotina" className="flex-1 rounded-full">
            Rotina
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4 space-y-4">
          <section className="surface-glass p-4">
            <p className="eyebrow">Resumo do dia</p>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-display text-lg text-primary text-glow">
                  {summary.trained ? "OK" : "—"}
                </p>
                <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                  Treino
                </p>
              </div>
              <div>
                <p className="text-display text-lg text-primary">{summary.proteinPct}%</p>
                <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                  Proteína
                </p>
              </div>
              <div>
                <p className="text-display text-lg text-primary">{summary.waterPct}%</p>
                <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Água</p>
              </div>
              <div>
                <p className="text-display text-lg text-primary">{questsDone}/3</p>
                <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                  Missões
                </p>
              </div>
            </div>
          </section>

          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm text-muted-foreground">Score</span>
            <span className="text-display text-2xl text-primary text-glow">
              <NumberTicker value={score} />
              <span className="ml-1 text-sm text-muted-foreground">/ 100</span>
            </span>
          </div>

          <section className="surface-glass grid grid-cols-4 gap-1 p-4">
            <MetricRing value={metricsWaterMl} max={waterGoalMl} label="Água" unit="ml" />
            <MetricRing value={proteinG} max={proteinGoalG} label="Proteína" unit="g" />
            <MetricRing value={takenCount} max={Math.max(1, routineMax)} label="Suplementos" />
            <MetricRing value={doneToday ? 1 : 0} max={1} label="Treino" />
          </section>
        </TabsContent>

        <TabsContent value="rotina" className="mt-4">
          <ul className="space-y-2">
            {routine.map((p) => {
              const done = takenIds.includes(p.id);
              const highlight = nowSuggestionId === p.id;
              return (
                <li
                  key={p.id}
                  className={`surface-glass flex items-center justify-between gap-3 px-3 py-3 ${
                    highlight ? "border-primary/40" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <SoldiersMediaThumb
                      media={resolveProductMedia(p.id)}
                      alt={p.name}
                      className="size-10 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{p.name}</p>
                        {highlight ? (
                          <Chip color="accent" size="sm" variant="soft" className="text-primary">
                            <Chip.Label>Agora</Chip.Label>
                          </Chip>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.timing} · {p.serving}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={done ? "default" : "secondary"}
                    onClick={() => onToggleSupplement(p.id)}
                  >
                    {done ? "Tomado" : "Marcar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Friend quest shown on main scroll when active (retention signal). */
export function HomeFriendQuestCard({ quest }: { quest: FriendQuest }) {
  return (
    <section className="surface-glass mb-4 p-4">
      <p className="eyebrow">Missão em dupla</p>
      <p className="mt-1 text-sm font-semibold">
        {quest.nameA} + {quest.nameB}
      </p>
      <p className="text-xs text-muted-foreground">
        {quest.progressA + quest.progressB}/{quest.target} treinos esta semana
      </p>
      <Link
        to="/social"
        search={{ tab: "desafios" }}
        className="mt-2 inline-block text-xs font-semibold text-primary"
      >
        Ver desafios
      </Link>
    </section>
  );
}
