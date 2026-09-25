/**
 * Social reads via service_role after FASE1 RLS harden (no anon SELECT on social tables).
 */
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import { challengeById, isPersonalizedChallenge, isRelativeChallenge } from "@/data/challenges";

export type LeaderboardRowDto = {
  deviceId: string;
  displayName: string;
  value: number;
  rank: number;
  isYou: boolean;
  pct?: number;
  personalTarget?: number;
  proofStatus?: string;
  proofSource?: string;
  flagged?: boolean;
};

export type ClubSummaryDto = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  members: Array<{ deviceId: string; displayName: string; userId?: string }>;
};

export type LeagueRowDto = {
  deviceId: string;
  displayName: string;
  points: number;
  rank: number;
  isYou: boolean;
  zone: "promo" | "mid" | "risk";
};

export type ClubStoryDto = {
  id: string;
  clubId: string;
  deviceId: string;
  displayName: string;
  imageUrl: string;
  createdAt: string;
};

function weekStartMonday(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

async function assertAccess(deviceId: string) {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) throw new Error("Identidade inválida");
  return identity;
}

/** Club membership by user_id (preferred); legacy device_id when user_id null. */
async function isClubMember(
  db: NonNullable<Awaited<ReturnType<typeof adminDbLoose>>>,
  clubId: string,
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const { data: byUser } = await db
    .from("club_members")
    .select("club_id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (byUser) return true;
  const { data: byDevice } = await db
    .from("club_members")
    .select("club_id, user_id")
    .eq("club_id", clubId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!byDevice) return false;
  return byDevice.user_id == null || byDevice.user_id === userId;
}

export async function fetchLeaderboardServer(
  challengeId: string,
  deviceId: string,
): Promise<LeaderboardRowDto[] | null> {
  await assertAccess(deviceId);
  const db = await adminDbLoose();
  if (!db) return null;

  const c = challengeById(challengeId);
  const relative = c ? isRelativeChallenge(c) : false;
  const personalized = c ? isPersonalizedChallenge(c) : false;
  const rankByPct = relative || personalized;

  const query = db
    .from("challenge_progress")
    .select(
      "device_id, user_id, value, eligible_value, pct_value, personal_target, proof_status, proof_source, fraud_flags, verification_status",
    )
    .eq("challenge_id", challengeId)
    .limit(40);

  const { data, error } = rankByPct
    ? await query.order("pct_value", { ascending: false, nullsFirst: false })
    : await query.order("eligible_value", { ascending: false });

  if (error) {
    const fallback = await db
      .from("challenge_progress")
      .select(
        "device_id, value, user_id, pct_value, personal_target, proof_status, proof_source, fraud_flags",
      )
      .eq("challenge_id", challengeId)
      .order("value", { ascending: false })
      .limit(40);
    if (fallback.error) return null;
    return mapLeaderboard(db, fallback.data ?? [], deviceId, rankByPct);
  }

  return mapLeaderboard(db, data ?? [], deviceId, rankByPct);
}

async function mapLeaderboard(
  db: NonNullable<Awaited<ReturnType<typeof adminDbLoose>>>,
  rows: Array<Record<string, unknown>>,
  deviceId: string,
  rankByPct: boolean,
): Promise<LeaderboardRowDto[]> {
  const seenUsers = new Set<string>();
  const deduped: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const key = String(r["user_id"] || r["device_id"]);
    if (seenUsers.has(key)) continue;
    seenUsers.add(key);
    deduped.push(r);
    if (deduped.length >= 20) break;
  }

  const ids = deduped.map((r) => String(r["device_id"]));
  const { data: profiles } = await db
    .from("social_profiles")
    .select("device_id, display_name")
    .in("device_id", ids);
  const nameMap = new Map<string, string>(
    ((profiles ?? []) as Array<{ device_id: string; display_name: string }>).map((p) => [
      p.device_id,
      p.display_name,
    ]),
  );

  return deduped.map((r, i) => {
    const eligible =
      r["eligible_value"] != null ? Number(r["eligible_value"]) : Number(r["value"] ?? 0);
    const value = rankByPct ? Number(r["pct_value"] ?? 0) : eligible;
    const flagged = Array.isArray(r["fraud_flags"]) && (r["fraud_flags"] as unknown[]).length > 0;
    const row: LeaderboardRowDto = {
      deviceId: String(r["device_id"]),
      displayName: nameMap.get(String(r["device_id"])) || "Soldado",
      value,
      rank: i + 1,
      // Prefer user_id match when available; device is display-only
      isYou: String(r["device_id"]) === deviceId,
    };
    if (rankByPct) row.pct = Number(r["pct_value"] ?? 0);
    if (r["personal_target"] != null) row.personalTarget = Number(r["personal_target"]);
    if (typeof r["proof_status"] === "string") row.proofStatus = r["proof_status"];
    if (typeof r["proof_source"] === "string") row.proofSource = r["proof_source"];
    if (
      flagged ||
      r["verification_status"] === "flagged" ||
      r["verification_status"] === "rejected"
    ) {
      row.flagged = true;
    }
    return row;
  });
}

export async function listMyClubsServer(deviceId: string): Promise<ClubSummaryDto[]> {
  const identity = await assertAccess(deviceId);
  const db = await adminDbLoose();
  if (!db) return [];

  const { data: byUser } = await db
    .from("club_members")
    .select("club_id")
    .eq("user_id", identity.userId);
  const { data: byDevice } = await db
    .from("club_members")
    .select("club_id, user_id")
    .eq("device_id", deviceId)
    .is("user_id", null);
  const memberships = [
    ...((byUser ?? []) as Array<{ club_id: string }>),
    ...((byDevice ?? []) as Array<{ club_id: string }>),
  ];
  if (!memberships.length) return [];

  const clubIds = [...new Set(memberships.map((m) => m.club_id))];
  const { data: clubs } = await db.from("clubs").select("id, name, code").in("id", clubIds);
  const out: ClubSummaryDto[] = [];

  for (const club of (clubs ?? []) as Array<{ id: string; name: string; code: string }>) {
    const { data: members } = await db
      .from("club_members")
      .select("device_id, user_id")
      .eq("club_id", club.id);
    const memberRows = (members ?? []) as Array<{ device_id: string; user_id?: string | null }>;
    const ids = memberRows.map((m) => m.device_id);
    const { data: profiles } = await db
      .from("social_profiles")
      .select("device_id, display_name")
      .in("device_id", ids);
    const nameMap = new Map<string, string>(
      ((profiles ?? []) as Array<{ device_id: string; display_name: string }>).map((p) => [
        p.device_id,
        p.display_name,
      ]),
    );
    out.push({
      id: club.id,
      name: club.name,
      code: club.code,
      memberCount: ids.length,
      members: memberRows.map((m) => ({
        deviceId: m.device_id,
        displayName: nameMap.get(m.device_id) || "Soldado",
        ...(m.user_id ? { userId: m.user_id } : {}),
      })),
    });
  }
  return out;
}

export async function fetchClubLeagueServer(
  clubId: string,
  memberDeviceIds: string[],
  yourDeviceId: string,
): Promise<LeagueRowDto[] | null> {
  const identity = await assertAccess(yourDeviceId);
  const db = await adminDbLoose();
  if (!db) return null;

  // Membership gate by user_id (device_id is not identity)
  if (!(await isClubMember(db, clubId, identity.userId, yourDeviceId))) return null;

  const weekStart = weekStartMonday();
  const { data, error } = await db
    .from("club_league_weeks")
    .select("device_id, points")
    .eq("club_id", clubId)
    .eq("week_start", weekStart)
    .order("points", { ascending: false })
    .limit(40);
  if (error) return null;

  const { data: members } = await db.from("club_members").select("device_id").eq("club_id", clubId);
  const ids = [
    ...new Set([
      ...((members ?? []) as Array<{ device_id: string }>).map((m) => m.device_id),
      ...memberDeviceIds,
    ]),
  ];
  const { data: profiles } = await db
    .from("social_profiles")
    .select("device_id, display_name")
    .in("device_id", ids);
  const nameMap = new Map<string, string>(
    ((profiles ?? []) as Array<{ device_id: string; display_name: string }>).map((p) => [
      p.device_id,
      p.display_name,
    ]),
  );
  const pointMap = new Map(
    ((data ?? []) as Array<{ device_id: string; points: number }>).map((r) => [
      r.device_id,
      Number(r.points),
    ]),
  );

  const rows: LeagueRowDto[] = ids
    .map((id) => ({
      deviceId: id,
      displayName: nameMap.get(id) || "Soldado",
      points: Number(pointMap.get(id) ?? 0),
      rank: 0,
      isYou: id === yourDeviceId,
      zone: "mid" as LeagueRowDto["zone"],
    }))
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const n = rows.length;
  return rows.map((r) => ({
    ...r,
    zone: (r.rank <= 3
      ? "promo"
      : r.rank > n - 3 && n >= 6
        ? "risk"
        : "mid") as LeagueRowDto["zone"],
  }));
}

export async function fetchClubStoriesServer(
  clubId: string,
  deviceId: string,
): Promise<ClubStoryDto[]> {
  const identity = await assertAccess(deviceId);
  const db = await adminDbLoose();
  if (!db) return [];

  if (!(await isClubMember(db, clubId, identity.userId, deviceId))) return [];

  const since = new Date();
  since.setHours(since.getHours() - 24);
  const { data, error } = await db
    .from("club_stories")
    .select("id, club_id, device_id, image_url, created_at")
    .eq("club_id", clubId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data?.length) return [];

  const storyRows = data as Array<{
    id: string;
    club_id: string;
    device_id: string;
    image_url: string;
    created_at: string;
  }>;
  const ids = storyRows.map((s) => s.device_id);
  const { data: profiles } = await db
    .from("social_profiles")
    .select("device_id, display_name")
    .in("device_id", ids);
  const nameMap = new Map<string, string>(
    ((profiles ?? []) as Array<{ device_id: string; display_name: string }>).map((p) => [
      p.device_id,
      p.display_name,
    ]),
  );
  return storyRows.map((s) => ({
    id: s.id,
    clubId: s.club_id,
    deviceId: s.device_id,
    displayName: nameMap.get(s.device_id) || "Soldado",
    imageUrl: s.image_url,
    createdAt: s.created_at,
  }));
}

/** Upload check-in / story image via service_role (anon storage writes removed). */
export async function uploadCheckinImageServer(
  deviceId: string,
  bytesBase64: string,
  contentType: string,
  fileExt: string,
): Promise<string | null> {
  const identity = await assertAccess(deviceId);
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const ext = (fileExt || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
  const path = `${identity.deviceId}/${Date.now()}.${ext}`;
  const buf = Buffer.from(bytesBase64, "base64");
  if (buf.length > 5 * 1024 * 1024) throw new Error("Arquivo muito grande");

  const { error } = await supabaseAdmin.storage.from("checkins").upload(path, buf, {
    contentType: contentType || "image/jpeg",
    upsert: true,
  });
  if (error) {
    console.error("uploadCheckinImageServer failed", error);
    return null;
  }
  const { data } = supabaseAdmin.storage.from("checkins").getPublicUrl(path);
  return data.publicUrl;
}

// computeWeeklyLeaguePoints lives in league-points.server.ts
