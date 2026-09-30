import { EmptyState } from "@/components/app-shell";
import { ActivityCard, formatActivityEvent, metricsFromEvent } from "@/components/social/activity-card";
import { EMPTY_FEED_BODY, EMPTY_FEED_TITLE } from "@/lib/ui/platform-copy";
import type { ActivityEvent } from "@/lib/social";
import type { ReactionKind } from "@/lib/social/visibility";
import { cn } from "@/lib/utils";

export { formatActivityEvent, metricsFromEvent };

export function ActivityFeed({
  events,
  deviceId,
  kudosGiven,
  onKudos,
  onKudosQuest,
  onDismissed,
  compact,
  interactive = true,
  hideDefaultEmpty = false,
}: {
  events: ActivityEvent[];
  deviceId: string;
  kudosGiven: Record<string, boolean>;
  onKudos: (eventId: string, kind?: ReactionKind) => void;
  onKudosQuest?: () => void;
  onDismissed?: (eventId: string) => void;
  compact?: boolean;
  interactive?: boolean;
  hideDefaultEmpty?: boolean;
}) {
  if (!events.length) {
    if (hideDefaultEmpty) return null;
    return (
      <EmptyState variant="social" title={EMPTY_FEED_TITLE} description={EMPTY_FEED_BODY} />
    );
  }

  return (
    <ul className={cn("space-y-3", compact && "space-y-2")}>
      {events.map((e) => (
        <ActivityCard
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
