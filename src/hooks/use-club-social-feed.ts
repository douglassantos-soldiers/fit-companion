import { useEffect, useState } from "react";
import {
  fetchClubFeed,
  fetchFeed,
  hasGivenKudos,
  listMyClubs,
  type ActivityEvent,
  type ClubSummary,
} from "@/lib/social";

/** Shared club feed + kudos map for Hoje / Social. */
export function useClubSocialFeed(opts: {
  enabled: boolean;
  deviceId: string;
  limit?: number;
  globalFallback?: boolean;
  refreshKey?: number | string;
}) {
  const { enabled, deviceId, limit = 12, globalFallback = false, refreshKey } = opts;
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
        const events = c
          ? await fetchClubFeed(
              c.members.map((m) => m.deviceId),
              limit,
            )
          : globalFallback
            ? await fetchFeed(Math.max(limit, 20))
            : [];
        if (cancelled) return;
        setFeed(events ?? []);
        const given: Record<string, boolean> = {};
        for (const e of events ?? []) given[e.id] = hasGivenKudos(deviceId, e.id);
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
  }, [enabled, deviceId, limit, globalFallback, refreshKey]);

  return { club, feed, setFeed, kudosGiven, setKudosGiven };
}
