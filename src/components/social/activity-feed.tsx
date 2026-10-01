import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EmptyState } from "@/components/app-shell";
import { ActivityCard, formatActivityEvent, metricsFromEvent } from "@/components/social/activity-card";
import { EMPTY_FEED_BODY, EMPTY_FEED_TITLE } from "@/lib/ui/platform-copy";
import type { ActivityEvent } from "@/lib/social";
import type { ReactionKind } from "@/lib/social/visibility";
import { cn } from "@/lib/utils";

export { formatActivityEvent, metricsFromEvent };

const VIRTUALIZE_THRESHOLD = 16;

export type ActivityFeedProps = {
  events: ActivityEvent[];
  deviceId: string;
  kudosGiven: Record<string, boolean>;
  onKudos: (eventId: string, kind?: ReactionKind) => void;
  onKudosQuest?: () => void;
  onDismissed?: (eventId: string) => void;
  compact?: boolean;
  interactive?: boolean;
  hideDefaultEmpty?: boolean;
};

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
}: ActivityFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualize = events.length >= VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: virtualize ? events.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (compact ? 140 : 240),
    overscan: 4,
  });

  if (!events.length) {
    if (hideDefaultEmpty) return null;
    return (
      <EmptyState variant="social" title={EMPTY_FEED_TITLE} description={EMPTY_FEED_BODY} />
    );
  }

  const cardProps = {
    deviceId,
    kudosGiven,
    onKudos,
    interactive,
    ...(onKudosQuest ? { onKudosQuest } : {}),
    ...(onDismissed ? { onDismissed } : {}),
    ...(compact ? { compact: true as const } : {}),
  };

  if (!virtualize) {
    return (
      <ul className={cn("space-y-3", compact && "space-y-2")}>
        {events.map((e) => (
          <ActivityCard key={e.id} event={e} {...cardProps} />
        ))}
      </ul>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("max-h-[70vh] overflow-y-auto", compact && "max-h-[50vh]")}
    >
      <ul
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const e = events[row.index]!;
          return (
            <li
              key={e.id}
              className={cn("absolute left-0 top-0 w-full", compact ? "pb-2" : "pb-3")}
              style={{
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <ActivityCard event={e} {...cardProps} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
