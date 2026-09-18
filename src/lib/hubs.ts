import { HUBS, hubById, hubBySlug, type HubSeed } from "@/data/hubs";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureSocialProfile,
  fetchLeaderboard,
  type LeaderboardRow,
} from "@/lib/social";

export type Hub = HubSeed & { memberCount?: number };

function seedAsHub(h: HubSeed, memberCount?: number): Hub {
  return { ...h, ...(memberCount !== undefined ? { memberCount } : {}) };
}

/** List hubs — remote first, fallback to seed. */
export async function listHubs(): Promise<Hub[]> {
  try {
    const { data, error } = await supabase
      .from("hubs" as never)
      .select("id, slug, name, tagline, creator_name, avatar_url, cover_url, active")
      .eq("active", true);
    if (error || !data?.length) return HUBS.map((h) => seedAsHub(h));

    const rows = data as unknown as Array<{
      id: string;
      slug: string;
      name: string;
      tagline: string;
      creator_name: string;
      avatar_url: string | null;
      cover_url: string | null;
    }>;

    const ids = rows.map((r) => r.id);
    const { data: links } = await supabase
      .from("hub_challenges" as never)
      .select("hub_id, challenge_id, sort")
      .in("hub_id", ids);

    const linkRows = (links ?? []) as unknown as Array<{
      hub_id: string;
      challenge_id: string;
      sort: number;
    }>;

    const byHub = new Map<string, string[]>();
    for (const l of [...linkRows].sort((a, b) => a.sort - b.sort)) {
      const arr = byHub.get(l.hub_id) ?? [];
      arr.push(l.challenge_id);
      byHub.set(l.hub_id, arr);
    }

    const { data: members } = await supabase
      .from("hub_members" as never)
      .select("hub_id")
      .in("hub_id", ids);
    const counts = new Map<string, number>();
    for (const m of (members ?? []) as unknown as Array<{ hub_id: string }>) {
      counts.set(m.hub_id, (counts.get(m.hub_id) ?? 0) + 1);
    }

    return rows.map((r) => {
      const seed = hubBySlug(r.slug);
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        creatorName: r.creator_name,
        ...(r.avatar_url ? { avatarUrl: r.avatar_url } : {}),
        ...(r.cover_url ? { coverUrl: r.cover_url } : {}),
        challengeIds: byHub.get(r.id) ?? seed?.challengeIds ?? [],
        memberCount: counts.get(r.id) ?? 0,
      };
    });
  } catch {
    return HUBS.map((h) => seedAsHub(h));
  }
}

export async function getHub(slug: string): Promise<Hub | null> {
  const all = await listHubs();
  return all.find((h) => h.slug === slug) ?? hubBySlug(slug) ?? null;
}

export async function isHubMember(hubId: string, deviceId: string): Promise<boolean> {
  if (!deviceId) return false;
  try {
    const { data, error } = await supabase
      .from("hub_members" as never)
      .select("hub_id")
      .eq("hub_id", hubId)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function listMyHubIds(deviceId: string): Promise<string[]> {
  if (!deviceId) return [];
  try {
    const { data, error } = await supabase
      .from("hub_members" as never)
      .select("hub_id")
      .eq("device_id", deviceId);
    if (error || !data) return [];
    return (data as unknown as Array<{ hub_id: string }>).map((r) => r.hub_id);
  } catch {
    return [];
  }
}

export async function joinHub(deviceId: string, hubId: string, displayName: string) {
  await ensureSocialProfile(deviceId, displayName);
  const { error } = await supabase.from("hub_members" as never).upsert(
    { hub_id: hubId, device_id: deviceId } as never,
    { onConflict: "hub_id,device_id" },
  );
  if (error) throw error;
}

export async function leaveHub(deviceId: string, hubId: string) {
  const { error } = await supabase
    .from("hub_members" as never)
    .delete()
    .eq("hub_id", hubId)
    .eq("device_id", deviceId);
  if (error) throw error;
}

export async function fetchHubLeaderboard(
  challengeId: string,
  deviceId: string,
): Promise<LeaderboardRow[] | null> {
  return fetchLeaderboard(challengeId, deviceId);
}

export function challengeIdsForJoinedHubs(joinedHubIds: string[]): string[] {
  const ids = new Set<string>();
  for (const hubId of joinedHubIds) {
    const h = hubById(hubId);
    h?.challengeIds.forEach((c) => ids.add(c));
  }
  return [...ids];
}
