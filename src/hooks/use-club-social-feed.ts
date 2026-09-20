import { useEffect, useState } from "react";
import {
  fetchClubFeed,
  fetchForYouFeed,
  fetchFeed,
  hasGivenKudos,
  listMyClubs,
  type ActivityEvent,
  type ClubSummary,
} from "@/lib/social";
import type { ReactionKind } from "@/lib/social/visibility";

/** Shared club / for-you feed + kudos map for Hoje / Social. */
export function useClubSocialFeed(opts: {
  enabled: boolean;
  deviceId: string;
  limit?: number;
  globalFallback?: boolean;
  refreshKey?: number | string;
  mode?: "club" | "foryou";
  goal?: string | null;
  level?: string | null;
}) {
  const { enabled, deviceId, limit = 12, globalFallback = false, refreshKey, mode = "club", goal, level } = opts;
  const [club, setClub] = useState<ClubSummary | null>(null);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [kudosGiven, setKudosGiven] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!enabled || !deviceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const clubs = await listMyClubs(deviceId);
        const c = clubs[0] ?? null;
        if (cancelled) return;
        setClub(c);
        let events: ActivityEvent[] = [];
        if (mode === "foryou") {
          events = await fetchForYouFeed(deviceId, Math.max(limit, 20), { goal, level });
          if (!events.length && !c && globalFallback) {
            events = (await fetchFeed(Math.max(limit, 20))) ?? [];
          }
        } else {
          events = c
            ? ((await fetchClubFeed(
                c.members.map((m) => m.deviceId),
                limit,
              )) ?? [])
            : globalFallback
              ? ((await fetchFeed(Math.max(limit, 20))) ?? [])
              : [];
        }
        if (cancelled) return;
        setFeed(events);
        const given: Record<string, boolean> = {};
        for (const e of events) {
          given[e.id] = Boolean(e.myReaction) || hasGivenKudos(deviceId, e.id);
        }
        setKudosGiven(given);
      } catch (err) {
        console.warn("useClubSocialFeed failed", err);
        if (!cancelled) {
          setClub(null);
          setFeed([]);
          setKudosGiven({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, deviceId, limit, globalFallback, refreshKey, mode, goal, level]);

  const applyReaction = (id: string, kind?: ReactionKind) => {
    setFeed((prev) =>
      prev.map((x): ActivityEvent => {
        if (x.id !== id) return x;
        const counts = { fire: 0, muscle: 0, clap: 0, trophy: 0, heart: 0, ...(x.reactionCounts ?? {}) };
        if (x.myReaction) counts[x.myReaction] = Math.max(0, (counts[x.myReaction] ?? 0) - 1);
        const nextKind = kind ?? "fire";
        counts[nextKind] = (counts[nextKind] ?? 0) + 1;
        const next: ActivityEvent = {
          ...x,
          myReaction: nextKind,
          reactionCounts: counts,
          kudosCount: counts.fire,
        };
        if (x.commentCount != null) next.commentCount = x.commentCount;
        return next;
      }),
    );
    setKudosGiven((g) => ({ ...g, [id]: true }));
  };

  return { club, feed, setFeed, kudosGiven, setKudosGiven, applyReaction };
}
