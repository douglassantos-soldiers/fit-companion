import { useEffect, useRef, useState } from "react";
import { Flag, MessageCircle, UserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmOverlay } from "@/components/confirm-overlay";
import { EmptyState } from "@/components/app-shell";
import { EMPTY_FEED_BODY, EMPTY_FEED_TITLE } from "@/lib/ui/platform-copy";
import {
  commentOnEvent,
  dismissFeedItem,
  giveKudosOnce,
  giveKudosServer,
  hasGivenKudos,
  markFeedSeen,
  reactToEvent,
  reportActivityEvent,
  reportSocialContent,
  type ActivityEvent,
} from "@/lib/social";
import { listEventCommentsFn } from "@/lib/social/graph.functions";
import { REACTION_KINDS, type ReactionKind } from "@/lib/social/visibility";
import { cn } from "@/lib/utils";

const REACTION_EMOJI: Record<ReactionKind, string> = {
  fire: "🔥",
  muscle: "💪",
  clap: "👏",
  trophy: "🏆",
  heart: "❤️",
};

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
  if (e.kind === "user_followed") return `${e.displayName} começou a seguir alguém`;
  if (e.kind === "challenge_invite") return `${e.displayName} convidou para${title ? ` ${title}` : " um desafio"}`;
  if (e.kind === "editorial") {
    return title ?? "Conteúdo para você";
  }
  if (e.kind === "proof") {
    const narrative =
      typeof e.payload["narrative"] === "string" ? e.payload["narrative"] : "Prova de desempenho";
    return `${e.displayName} · ${narrative}`;
  }
  return `${e.displayName} · ${e.kind}`;
}

type CommentRow = { id: string; userId: string; displayName: string; body: string; createdAt: string };

export function ActivityFeed({
  events,
  deviceId,
  kudosGiven,
  onKudos,
  onKudosQuest,
  onDismissed,
  compact,
  interactive = true,
}: {
  events: ActivityEvent[];
  deviceId: string;
  kudosGiven: Record<string, boolean>;
  onKudos: (eventId: string, kind?: ReactionKind) => void;
  onKudosQuest?: () => void;
  onDismissed?: (eventId: string) => void;
  compact?: boolean;
  interactive?: boolean;
}) {
  if (!events.length) {
    return (
      <EmptyState variant="social" title={EMPTY_FEED_TITLE} description={EMPTY_FEED_BODY} />
    );
  }

  return (
    <ul className={cn("space-y-2", compact && "space-y-1.5")}>
      {events.map((e) => (
        <FeedCard
          key={e.id}
          event={e}
          deviceId={deviceId}
          kudosGiven={kudosGiven}
          onKudos={onKudos}
          interactive={interactive}
          {...(onKudosQuest ? { onKudosQuest } : {})}
          {...(onDismissed ? { onDismissed } : {})}
          {...(compact ? { compact: true } : {})}
        />
      ))}
    </ul>
  );
}

function FeedCard({
  event: e,
  deviceId,
  kudosGiven,
  onKudos,
  onKudosQuest,
  onDismissed,
  compact,
  interactive,
}: {
  event: ActivityEvent;
  deviceId: string;
  kudosGiven: Record<string, boolean>;
  onKudos: (eventId: string, kind?: ReactionKind) => void;
  onKudosQuest?: () => void;
  onDismissed?: (eventId: string) => void;
  compact?: boolean;
  interactive?: boolean;
}) {
  const [openComments, setOpenComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: "event" | "comment"; id: string }>(null);
  const cardRef = useRef<HTMLLIElement>(null);
  const imageUrl = typeof e.payload["imageUrl"] === "string" ? e.payload["imageUrl"] : null;
  const fireCount = e.reactionCounts?.fire ?? e.kudosCount;
  const commentCount = e.commentCount ?? comments.length;
  const reacted = Boolean(e.myReaction) || kudosGiven[e.id] || hasGivenKudos(deviceId, e.id);
  const authorId = e.userId;
  const isEditorial = e.kind === "editorial";
  const contentId = typeof e.payload["contentId"] === "string" ? e.payload["contentId"] : null;
  const excerpt = typeof e.payload["excerpt"] === "string" ? e.payload["excerpt"] : null;
  const href = typeof e.payload["href"] === "string" ? e.payload["href"] : contentId ? `/conteudo/${contentId}` : null;

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !deviceId) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer = window.setTimeout(() => {
            void markFeedSeen(
              deviceId,
              isEditorial && contentId ? { contentId } : { eventId: e.id },
            ).catch(() => undefined);
            io.disconnect();
          }, 1000);
        } else if (timer) {
          window.clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [deviceId, e.id, isEditorial, contentId]);

  const loadComments = () => {
    if (openComments) {
      setOpenComments(false);
      return;
    }
    setOpenComments(true);
    void listEventCommentsFn({ data: { deviceId, eventId: e.id } })
      .then((res) => setComments(res.comments ?? []))
      .catch(() => toast.error("Não foi possível carregar comentários"));
  };

  const react = (kind: ReactionKind) => {
    void reactToEvent(e.id, deviceId, kind)
      .catch(() => (kind === "fire" ? giveKudosServer(e.id, e.kudosCount, deviceId) : Promise.reject()))
      .catch(() => (kind === "fire" ? giveKudosOnce(e.id, e.kudosCount, deviceId) : Promise.reject()))
      .then(() => {
        onKudos(e.id, kind);
        onKudosQuest?.();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Não foi possível reagir"));
  };

  return (
    <li ref={cardRef}>
      <article className="surface-card space-y-2 p-3">
        <div className="flex items-start justify-between gap-3">
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
            {isEditorial && excerpt ? (
              <p className="mt-1 text-xs text-muted-foreground">{excerpt}</p>
            ) : null}
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              {new Date(e.createdAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              {!isEditorial ? (
                <span className="ml-2">
                  🔥 {fireCount} · 💬 {commentCount}
                </span>
              ) : null}
            </p>
          </div>
          {authorId && !isEditorial ? (
            <Link
              to="/social/$userId"
              params={{ userId: authorId }}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted-foreground hover:text-primary"
              aria-label="Ver perfil"
            >
              <UserRound className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {isEditorial ? (
          <div className="flex flex-wrap items-center gap-2">
            {href ? (
              <Link to="/conteudo/$id" params={{ id: contentId ?? href.replace("/conteudo/", "") }}>
                <Button size="sm">Ler</Button>
              </Link>
            ) : null}
            {interactive ? (
              <button
                type="button"
                className="text-[0.65rem] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (!contentId) return;
                  void dismissFeedItem(deviceId, "", "editorial", contentId)
                    .then(() => {
                      onDismissed?.(e.id);
                      toast.success("Escondido por 30 dias");
                    })
                    .catch(() => toast.error("Não foi possível esconder"));
                }}
              >
                Não tenho interesse
              </button>
            ) : null}
          </div>
        ) : null}

        {interactive && !isEditorial ? (
          <div className="flex flex-wrap items-center gap-1">
            {REACTION_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-sm",
                  (e.myReaction ?? (reacted && kind === "fire" ? "fire" : null)) === kind &&
                    "bg-primary/15 ring-1 ring-primary/40",
                )}
                onClick={() => react(kind)}
                aria-label={`Reagir ${kind}`}
              >
                {REACTION_EMOJI[kind]}
                {e.reactionCounts?.[kind] ? (
                  <span className="ml-0.5 text-[0.65rem] text-muted-foreground">{e.reactionCounts[kind]}</span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
              onClick={loadComments}
            >
              <MessageCircle className="size-3" /> Comentar
            </button>
          </div>
        ) : null}

        {!compact && interactive && !isEditorial && authorId && e.deviceId !== deviceId ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="text-[0.65rem] text-muted-foreground hover:text-foreground"
              onClick={() => {
                void dismissFeedItem(deviceId, authorId, e.kind)
                  .then(() => {
                    onDismissed?.(e.id);
                    toast.success("Escondido por 30 dias");
                  })
                  .catch(() => toast.error("Não foi possível esconder"));
              }}
            >
              Não tenho interesse
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
              onClick={() => setConfirm({ kind: "event", id: e.id })}
            >
              <Flag className="size-3" /> Denunciar
            </button>
          </div>
        ) : compact && interactive && !isEditorial && e.deviceId !== deviceId ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
            onClick={() => setConfirm({ kind: "event", id: e.id })}
          >
            <Flag className="size-3" /> Denunciar
          </button>
        ) : null}

        {openComments && !isEditorial ? (
          <div className="space-y-2 border-t border-white/5 pt-2">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-2">
                <p className="text-xs">
                  <span className="font-semibold">{c.displayName}</span> {c.body}
                </p>
                <button
                  type="button"
                  className="text-[0.6rem] text-muted-foreground"
                  onClick={() => setConfirm({ kind: "comment", id: c.id })}
                >
                  Denunciar
                </button>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!draft.trim() || busy) return;
                setBusy(true);
                void commentOnEvent(e.id, deviceId, draft)
                  .then(() => {
                    setDraft("");
                    return listEventCommentsFn({ data: { deviceId, eventId: e.id } });
                  })
                  .then((res) => setComments(res.comments ?? []))
                  .catch(() => toast.error("Não foi possível comentar"))
                  .finally(() => setBusy(false));
              }}
            >
              <Input
                value={draft}
                maxLength={280}
                placeholder="Comentário (280)"
                onChange={(ev) => setDraft(ev.target.value)}
              />
              <Button size="sm" type="submit" disabled={busy || !draft.trim()}>
                Enviar
              </Button>
            </form>
          </div>
        ) : null}
      </article>
      <ConfirmOverlay
        open={Boolean(confirm)}
        title={confirm?.kind === "comment" ? "Denunciar este comentário?" : "Denunciar este check-in?"}
        description="A denúncia vai para moderação. Não é banimento automático."
        confirmLabel="Denunciar"
        destructive
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const op =
            confirm.kind === "comment"
              ? reportSocialContent(deviceId, "comment", confirm.id, "inappropriate")
              : reportActivityEvent(confirm.id, deviceId, "inappropriate");
          void op
            .then(() => toast.success("Denúncia enviada"))
            .catch(() => toast.error("Não foi possível denunciar"));
        }}
      />
    </li>
  );
}
