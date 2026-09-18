import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { giveKudosOnce, giveKudosServer, hasGivenKudos, type ActivityEvent } from "@/lib/social";
import { cn } from "@/lib/utils";

export function formatActivityEvent(e: ActivityEvent) {
  const title = typeof e.payload["title"] === "string" ? e.payload["title"] : undefined;
  if (e.kind === "session") {
    const sessionTitle = title ?? "Treino";
    const vol = Number(e.payload["volumeKg"] ?? 0);
    const express = Boolean(e.payload["express"]);
    return `${e.displayName} · ${express ? "Express · " : ""}${sessionTitle}${vol ? ` · ${Math.round(vol).toLocaleString("pt-BR")} kg` : ""}`;
  }
  if (e.kind === "badge") return `${e.displayName} conquistou ${title ?? "badge"}`;
  if (e.kind === "challenge_join") return `${e.displayName} entrou no desafio${title ? ` ${title}` : ""}`;
  if (e.kind === "challenge_complete") return `${e.displayName} completou${title ? `: ${title}` : " um desafio"}`;
  if (e.kind === "xp_goal") return `${e.displayName} fechou a meta de XP`;
  if (e.kind === "freeze_used") return `${e.displayName} usou um freeze`;
  if (e.kind === "friend_quest_complete") return `${e.displayName} completou a missão em dupla`;
  if (e.kind === "league_rank") return `${e.displayName} · liga #${String(e.payload["rank"] ?? "?")}`;
  if (e.kind === "proof") {
    const narrative =
      typeof e.payload["narrative"] === "string" ? e.payload["narrative"] : "Proof of Performance";
    return `${e.displayName} · ${narrative}`;
  }
  return `${e.displayName} · ${e.kind}`;
}

export function ActivityFeed({
  events,
  deviceId,
  kudosGiven,
  onKudos,
  onKudosQuest,
  compact,
}: {
  events: ActivityEvent[];
  deviceId: string;
  kudosGiven: Record<string, boolean>;
  onKudos: (eventId: string) => void;
  onKudosQuest?: () => void;
  compact?: boolean;
}) {
  if (!events.length) {
    return (
      <p className="surface-card p-4 text-sm text-muted-foreground">
        Ainda sem check-ins. Complete um treino com progresso público ligado.
      </p>
    );
  }

  return (
    <ul className={cn("space-y-2", compact && "space-y-1.5")}>
      {events.map((e) => {
        const imageUrl = typeof e.payload["imageUrl"] === "string" ? e.payload["imageUrl"] : null;
        return (
          <li key={e.id}>
            <article className="surface-card flex items-start justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    width={640}
                    height={224}
                    className="mb-2 h-28 w-full rounded-lg object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                <p className="text-sm font-medium">{formatActivityEvent(e)}</p>
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 gap-1"
                disabled={kudosGiven[e.id] || hasGivenKudos(deviceId, e.id)}
                onClick={() => {
                  void giveKudosServer(e.id, e.kudosCount, deviceId)
                    .catch(() => giveKudosOnce(e.id, e.kudosCount, deviceId))
                    .then(() => {
                      onKudos(e.id);
                      onKudosQuest?.();
                    })
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Não foi possível enviar kudos"),
                    );
                }}
              >
                <Heart
                  className={cn(
                    "size-3.5",
                    (kudosGiven[e.id] || hasGivenKudos(deviceId, e.id)) && "fill-primary text-primary",
                  )}
                />{" "}
                {e.kudosCount}
              </Button>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
