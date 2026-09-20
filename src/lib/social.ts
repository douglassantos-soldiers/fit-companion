import {
  challengeById,
  computePersonalTarget,
  isPersonalizedChallenge,
  isRelativeChallenge,
  type Challenge,
} from "@/data/challenges";
import { sessionsInLastDays } from "@/lib/engine/dimensions";
import { supabase } from "@/integrations/supabase/client";
import { socialWriteFn } from "@/lib/social-write.functions";
import { catalogById } from "@/lib/training/exercise-catalog";
import type { ActivityLogEntry, AppState, ProofSource, ProofStatus, SessionLog } from "@/lib/types";

export type ActivityKind =
  | "session"
  | "badge"
  | "challenge_join"
  | "challenge_complete"
  | "xp_goal"
  | "league_rank"
  | "friend_quest_complete"
  | "freeze_used"
  | "proof"
  | "user_followed"
  | "challenge_invite"
  | "editorial";

export interface LeaderboardRow {
  deviceId: string;
  displayName: string;
  value: number;
  rank: number;
  isYou: boolean;
  /** Present for relative / personalized challenges */
  pct?: number;
  personalTarget?: number;
  proofStatus?: ProofStatus;
  proofSource?: ProofSource;
  flagged?: boolean;
}

function parseProofStatus(raw: unknown): ProofStatus | undefined {
  if (raw === "verified" || raw === "pending" || raw === "self_reported") return raw;
  return undefined;
}

function parseProofSource(raw: unknown): ProofSource | undefined {
  if (
    raw === "app_session" ||
    raw === "app_manual" ||
    raw === "apple_health" ||
    raw === "health_connect" ||
    raw === "garmin" ||
    raw === "strava" ||
    raw === "wearable"
  ) {
    return raw;
  }
  return undefined;
}

export interface ChallengeProgress {
  /** Raw metric in the challenge window */
  current: number;
  /** Baseline at join (relative/personalized; absolute uses 0) */
  baseline: number;
  /** % evolution vs baseline (relative) or % of personal target (personalized) */
  pct: number;
  /** 0–100 bar fill toward completion */
  barPct: number;
  /** Whether challenge target is met */
  complete: boolean;
  /** Display value for UI (kg/sessions or %) */
  displayValue: number;
  displayTarget: number;
  displayUnit: string;
  /** Personalized absolute target when applicable */
  personalTarget?: number;
}

const CARDIO_IDS = ["corrida", "hiit", "corda", "burpee"];

function isCardioSession(s: SessionLog) {
  return s.exercises.some((e) => CARDIO_IDS.some((id) => e.exerciseId.includes(id)));
}

function activityInWindow(logs: ActivityLogEntry[] | undefined, days: number, kind: ActivityLogEntry["kind"]) {
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return (logs ?? []).filter((l) => l.kind === kind && new Date(l.date) >= limit);
}

function isPullExercise(exerciseId: string): boolean {
  const cat = catalogById(exerciseId);
  if (cat) return cat.group === "costas" || cat.movementPattern === "pull";
  return false;
}

export function sessionPullVolumeKg(session: SessionLog): number {
  let vol = 0;
  for (const log of session.exercises) {
    if (!isPullExercise(log.exerciseId)) continue;
    for (const set of log.sets) {
      if (set.skipped) continue;
      const reps = set.actualReps ?? set.reps;
      const w = set.actualWeight ?? set.weightKg;
      vol += reps * w;
    }
  }
  return vol;
}

/** Raw metric for a challenge (sessions, volume, cardio, or activity logs). */
export function challengeRawValue(
  challenge: Challenge,
  sessions: SessionLog[],
  activityLogs?: ActivityLogEntry[],
  extras?: { invitesSent?: number },
) {
  const recent = sessionsInLastDays(sessions, challenge.durationDays);
  if (challenge.metric === "volume") return Math.round(recent.reduce((s, x) => s + x.volumeKg, 0));
  if (challenge.metric === "volume_pull") {
    return Math.round(recent.reduce((s, x) => s + sessionPullVolumeKg(x), 0));
  }
  if (challenge.metric === "invites") return Math.max(0, Math.round(extras?.invitesSent ?? 0));
  if (challenge.metric === "dias") {
    return new Set(recent.map((s) => s.date.slice(0, 10))).size;
  }
  if (challenge.metric === "cardio_sessions") {
    return recent.filter(isCardioSession).length;
  }
  if (challenge.metric === "steps") {
    return Math.round(
      activityInWindow(activityLogs, challenge.durationDays, "steps").reduce((s, l) => s + l.value, 0),
    );
  }
  if (challenge.metric === "football_sessions") {
    return activityInWindow(activityLogs, challenge.durationDays, "football").reduce(
      (s, l) => s + l.value,
      0,
    );
  }
  if (challenge.metric === "activity_minutes") {
    const runKm = activityInWindow(activityLogs, challenge.durationDays, "run_km").reduce(
      (s, l) => s + l.value,
      0,
    );
    // ~6 min/km rough proxy for self-reported run time
    return Math.round(runKm * 6 + recent.filter(isCardioSession).reduce((s, x) => s + x.durationMin, 0));
  }
  return recent.length;
}

export function challengeValue(challengeId: string, sessions: SessionLog[], activityLogs?: ActivityLogEntry[]) {
  const c = challengeById(challengeId);
  if (!c) return 0;
  return challengeRawValue(c, sessions, activityLogs);
}

export interface ChallengeProgressOpts {
  baseline?: number;
  personalTarget?: number;
  activityLogs?: ActivityLogEntry[];
  invitesSent?: number;
}

/** Unified progress: absolute, relative (% vs baseline), or personalized (absolute personal target). */
export function challengeProgress(
  challenge: Challenge,
  sessions: SessionLog[],
  baselineOrOpts?: number | ChallengeProgressOpts,
  maybeOpts?: ChallengeProgressOpts,
): ChallengeProgress {
  const opts: ChallengeProgressOpts =
    typeof baselineOrOpts === "object" && baselineOrOpts !== null
      ? baselineOrOpts
      : { ...(maybeOpts ?? {}), baseline: typeof baselineOrOpts === "number" ? baselineOrOpts : maybeOpts?.baseline };

  const current = challengeRawValue(challenge, sessions, opts.activityLogs, {
    invitesSent: opts.invitesSent,
  });
  if (isRelativeChallenge(challenge)) {
    const base = Math.max(0, opts.baseline ?? 0);
    const pct = ((current - base) / Math.max(base, 1)) * 100;
    const targetPct = challenge.targetPct ?? challenge.target;
    const barPct = Math.min(100, Math.max(0, (pct / Math.max(targetPct, 1)) * 100));
    return {
      current,
      baseline: base,
      pct: Math.round(pct * 10) / 10,
      barPct,
      complete: pct >= targetPct,
      displayValue: Math.round(pct * 10) / 10,
      displayTarget: targetPct,
      displayUnit: "%",
    };
  }
  if (isPersonalizedChallenge(challenge)) {
    const base = Math.max(0, opts.baseline ?? 0);
    const personalTarget =
      opts.personalTarget ?? computePersonalTarget(challenge, base);
    const pct = (current / Math.max(personalTarget, 1)) * 100;
    const barPct = Math.min(100, Math.max(0, pct));
    return {
      current,
      baseline: base,
      pct: Math.round(pct * 10) / 10,
      barPct,
      complete: current >= personalTarget,
      displayValue: current,
      displayTarget: personalTarget,
      displayUnit: challenge.unit,
      personalTarget,
    };
  }
  const barPct = Math.min(100, (current / Math.max(challenge.target, 1)) * 100);
  return {
    current,
    baseline: 0,
    pct: 0,
    barPct,
    complete: current >= challenge.target,
    displayValue: current,
    displayTarget: challenge.target,
    displayUnit: challenge.unit,
  };
}

export function challengeProgressFromState(challengeId: string, state: AppState): ChallengeProgress | null {
  const c = challengeById(challengeId);
  if (!c) return null;
  return challengeProgress(c, state.sessions, {
    baseline: state.challengeBaselines?.[challengeId],
    personalTarget: state.challengePersonalTargets?.[challengeId],
    activityLogs: state.activityLogs,
    invitesSent: state.challengeInvitesSent ?? 0,
  });
}

export interface ClubSummary {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  members: Array<{ deviceId: string; displayName: string; userId?: string }>;
}

export interface ActivityEvent {
  id: string;
  deviceId: string;
  userId?: string;
  displayName: string;
  kind: ActivityKind;
  payload: Record<string, unknown>;
  kudosCount: number;
  createdAt: string;
  reactionCounts?: Record<import("@/lib/social/visibility").ReactionKind, number>;
  myReaction?: import("@/lib/social/visibility").ReactionKind | null;
  commentCount?: number;
}

export interface LeagueRow {
  deviceId: string;
  displayName: string;
  points: number;
  rank: number;
  isYou: boolean;
  zone: "promo" | "mid" | "risk";
}

export interface FriendQuest {
  id: string;
  clubId: string;
  weekStart: string;
  deviceA: string;
  deviceB: string;
  nameA: string;
  nameB: string;
  target: number;
  progressA: number;
  progressB: number;
}

export interface ClubStory {
  id: string;
  clubId: string;
  deviceId: string;
  displayName: string;
  imageUrl: string;
  createdAt: string;
}

function weekStartMonday(d = new Date()): string {
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

export async function ensureSocialProfile(deviceId: string, displayName: string) {
  if (!deviceId) return;
  await socialWriteFn({
    data: { op: "ensureProfile", deviceId, displayName: displayName || "Soldado" },
  });
}

export async function joinChallengeRemote(
  deviceId: string,
  challengeId: string,
  displayName: string,
  baseline?: number,
  personalTarget?: number,
) {
  await socialWriteFn({
    data: {
      op: "joinChallenge",
      deviceId,
      challengeId,
      displayName,
      ...(baseline !== undefined ? { baseline } : {}),
      ...(personalTarget !== undefined ? { personalTarget } : {}),
    },
  });
}

export async function leaveChallengeRemote(deviceId: string, challengeId: string) {
  await socialWriteFn({ data: { op: "leaveChallenge", deviceId, challengeId } });
}

export async function syncChallengeProgress(
  deviceId: string,
  challengeId: string,
  value: number,
  displayName: string,
  opts?: {
    baseline?: number;
    pct?: number;
    complete?: boolean;
    personalTarget?: number;
    fraudFlags?: unknown[];
    proofStatus?: string;
    proofSource?: string;
  },
) {
  await socialWriteFn({
    data: {
      op: "syncChallengeProgress",
      deviceId,
      challengeId,
      value,
      displayName,
      baseline: opts?.baseline,
      pct: opts?.pct,
      complete: opts?.complete,
      personalTarget: opts?.personalTarget,
      fraudFlags: opts?.fraudFlags,
      proofStatus: opts?.proofStatus,
      proofSource: opts?.proofSource,
    },
  });
}

export async function syncAllJoinedChallenges(state: AppState, deviceId: string) {
  if (!state.shareProgress || !state.profile) return;
  const name = state.profile.name;
    const { validateChallengeProgress } = await import("@/lib/engine/anti-fraud");
    const { challengeProofFromLogs } = await import("@/lib/wearables/challenge-proof");
  for (const id of state.challenges) {
    const c = challengeById(id);
    if (!c) continue;
    const progressOpts: ChallengeProgressOpts = {};
    if (state.activityLogs) progressOpts.activityLogs = state.activityLogs;
    if (state.challengeBaselines?.[id] != null) progressOpts.baseline = state.challengeBaselines[id];
    if (state.challengePersonalTargets?.[id] != null) {
      progressOpts.personalTarget = state.challengePersonalTargets[id];
    }
    const progress = challengeProgress(c, state.sessions, progressOpts);
    const fraudInput: import("@/lib/engine/anti-fraud").ChallengeProgressInput = {
      value: progress.current,
      baseline: progress.baseline,
      metric: c.metric,
    };
    if (progress.personalTarget != null) fraudInput.personalTarget = progress.personalTarget;
    const fraud = validateChallengeProgress(fraudInput);
    const proof = challengeProofFromLogs(c.metric, state.activityLogs ?? [], c.durationDays);
    try {
      const syncOpts: {
        baseline?: number;
        pct?: number;
        complete?: boolean;
        personalTarget?: number;
        fraudFlags?: unknown[];
        proofStatus?: string;
        proofSource?: string;
      } = {
        baseline: progress.baseline,
        pct: progress.pct,
        complete: progress.complete,
        fraudFlags: fraud.flags,
        proofStatus: proof.status,
        proofSource: proof.source,
      };
      if (progress.personalTarget != null) syncOpts.personalTarget = progress.personalTarget;
      await syncChallengeProgress(deviceId, id, progress.current, name, syncOpts);
    } catch (e) {
      console.error("Falha ao sincronizar progresso do desafio", id, e);
    }
  }
}

export async function fetchParticipantCount(challengeId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("challenge_entries")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challengeId);
  if (error) return null;
  return count ?? 0;
}

export async function fetchLeaderboard(challengeId: string, deviceId: string): Promise<LeaderboardRow[] | null> {
  const c = challengeById(challengeId);
  const relative = c ? isRelativeChallenge(c) : false;
  const personalized = c ? isPersonalizedChallenge(c) : false;
  const rankByPct = relative || personalized;

  let query = supabase
    .from("challenge_progress")
    .select(
      "device_id, user_id, value, baseline_value, pct_value, personal_target, proof_status, proof_source, fraud_flags" as never,
    )
    .eq("challenge_id", challengeId)
    .limit(40);

  const { data, error } = rankByPct
    ? await query.order("pct_value" as never, { ascending: false, nullsFirst: false })
    : await query.order("value", { ascending: false });

  if (error) {
    const fallback = await supabase
      .from("challenge_progress")
      .select("device_id, value")
      .eq("challenge_id", challengeId)
      .order("value", { ascending: false })
      .limit(20);
    if (fallback.error) return null;
    const ids = (fallback.data ?? []).map((r) => r.device_id);
    const { data: profiles } = await supabase
      .from("social_profiles")
      .select("device_id, display_name")
      .in("device_id", ids);
    const nameMap = new Map((profiles ?? []).map((p) => [p.device_id, p.display_name]));
    return (fallback.data ?? []).map((r, i) => ({
      deviceId: r.device_id,
      displayName: nameMap.get(r.device_id) || "Soldado",
      value: Number(r.value),
      rank: i + 1,
      isYou: r.device_id === deviceId,
    }));
  }

  // Dedupe multi-device rows of the same user (keep best rank / first)
  type ProgRow = {
    device_id: string;
    user_id?: string | null;
    value: number;
    baseline_value?: number | null;
    pct_value?: number | null;
    personal_target?: number | null;
    proof_status?: string | null;
    proof_source?: string | null;
    fraud_flags?: unknown;
  };
  const rows = (data ?? []) as unknown as ProgRow[];
  const seenUsers = new Set<string>();
  const deduped: ProgRow[] = [];
  for (const r of rows) {
    const key = r.user_id || r.device_id;
    if (seenUsers.has(key)) continue;
    seenUsers.add(key);
    deduped.push(r);
    if (deduped.length >= 20) break;
  }

  const ids = deduped.map((r) => r.device_id);
  const { data: profiles } = await supabase
    .from("social_profiles")
    .select("device_id, display_name, app_user_id" as never)
    .in("device_id", ids);
  const nameMap = new Map(
    (profiles ?? []).map((p: { device_id: string; display_name: string }) => [
      p.device_id,
      p.display_name,
    ]),
  );

  return deduped.map((r, i) => {
    const value = rankByPct ? Number(r.pct_value ?? 0) : Number(r.value);
    const proofStatus = parseProofStatus(r.proof_status);
    const proofSource = parseProofSource(r.proof_source);
    const flagged = Array.isArray(r.fraud_flags) && r.fraud_flags.length > 0;
    const row: LeaderboardRow = {
      deviceId: r.device_id,
      displayName: nameMap.get(r.device_id) || "Soldado",
      value,
      rank: i + 1,
      isYou: r.device_id === deviceId,
    };
    if (rankByPct) row.pct = Number(r.pct_value ?? 0);
    if (r.personal_target != null) row.personalTarget = Number(r.personal_target);
    if (proofStatus) row.proofStatus = proofStatus;
    if (proofSource) row.proofSource = proofSource;
    if (flagged) row.flagged = true;
    return row;
  });
}

export async function publishProofEvent(
  deviceId: string,
  displayName: string,
  payload: Record<string, unknown>,
) {
  await publishEvent(deviceId, displayName, "proof", payload);
}

export async function createClub(deviceId: string, name: string, displayName: string): Promise<ClubSummary> {
  const res = await socialWriteFn({
    data: { op: "createClub", deviceId, name, displayName },
  });
  const club = res.club as ClubSummary | undefined;
  if (!club) throw new Error("Não foi possível criar o clube");
  return club;
}

export async function joinClubByCode(deviceId: string, code: string, displayName: string): Promise<ClubSummary> {
  const res = await socialWriteFn({
    data: { op: "joinClub", deviceId, code, displayName },
  });
  const clubId = res.clubId as string | undefined;
  if (!clubId) throw new Error("Código inválido");
  return (await listMyClubs(deviceId)).find((c) => c.id === clubId)!;
}

export async function listMyClubs(deviceId: string): Promise<ClubSummary[]> {
  const { data: memberships, error } = await supabase.from("club_members").select("club_id").eq("device_id", deviceId);
  if (error || !memberships?.length) return [];

  const clubIds = memberships.map((m) => m.club_id);
  const { data: clubs } = await supabase.from("clubs").select("id, name, code").in("id", clubIds);
  if (!clubs?.length) return [];

  const out: ClubSummary[] = [];
  for (const club of clubs) {
    const { data: members } = await supabase.from("club_members").select("device_id, user_id").eq("club_id", club.id);
    const memberIds = (members ?? []).map((m) => m.device_id);
    const { data: profiles } = await supabase
      .from("social_profiles")
      .select("device_id, display_name, app_user_id")
      .in("device_id", memberIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.device_id, p.display_name]));
    const userMap = new Map(
      (members ?? []).map((m) => [m.device_id, (m as { user_id?: string | null }).user_id ?? undefined]),
    );
    out.push({
      id: club.id,
      name: club.name,
      code: club.code,
      memberCount: memberIds.length,
      members: memberIds.map((id) => {
        const userId = userMap.get(id);
        return userId
          ? { deviceId: id, displayName: nameMap.get(id) || "Soldado", userId }
          : { deviceId: id, displayName: nameMap.get(id) || "Soldado" };
      }),
    });
  }
  return out;
}

export async function publishEvent(
  deviceId: string,
  displayName: string,
  kind: ActivityKind,
  payload: Record<string, unknown> = {},
) {
  await socialWriteFn({
    data: { op: "publishEvent", deviceId, displayName: displayName || "Soldado", kind, payload },
  });
}

export async function fetchFeed(limit = 30): Promise<ActivityEvent[] | null> {
  const mapRows = (data: Array<Record<string, unknown>> | null): ActivityEvent[] =>
    (data ?? []).map((e) => ({
      id: String(e["id"]),
      deviceId: String(e["device_id"]),
      displayName: String(e["display_name"] ?? ""),
      kind: e["kind"] as ActivityKind,
      payload: (e["payload"] as Record<string, unknown>) ?? {},
      kudosCount: Number(e["kudos_count"] ?? 0),
      createdAt: String(e["created_at"]),
    }));

  const cols = "id, device_id, display_name, kind, payload, kudos_count, created_at";
  const first = await supabase
    .from("activity_events")
    .select(cols)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!first.error) return mapRows(first.data as Array<Record<string, unknown>> | null);
  const fallback = await supabase
    .from("activity_events")
    .select(cols)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (fallback.error) return null;
  return mapRows(fallback.data as Array<Record<string, unknown>> | null);
}

export async function giveKudos(eventId: string, current: number) {
  // Prefer giveKudosServer with deviceId — this path needs device context
  void eventId;
  void current;
  throw new Error("Use giveKudosServer(eventId, current, deviceId)");
}

function kudosKey(deviceId: string, eventId: string) {
  return `soldiers-kudos:${deviceId}:${eventId}`;
}

export function hasGivenKudos(deviceId: string, eventId: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(kudosKey(deviceId, eventId)) === "1";
  } catch {
    return false;
  }
}

/** Increment kudos once per device (localStorage dedupe). */
export async function giveKudosOnce(eventId: string, current: number, deviceId: string) {
  if (!deviceId) throw new Error("Dispositivo inválido");
  if (hasGivenKudos(deviceId, eventId)) throw new Error("Você já reagiu a este check-in");
  await socialWriteFn({ data: { op: "giveKudos", eventId, current, deviceId } });
  try {
    window.localStorage.setItem(kudosKey(deviceId, eventId), "1");
  } catch {
    /* ignore quota */
  }
}

export async function reportActivityEvent(eventId: string, deviceId: string, reason = "other") {
  if (!eventId || !deviceId) throw new Error("Denúncia inválida");
  await socialWriteFn({ data: { op: "reportEvent", eventId, deviceId, reason } });
}

export async function reportSocialContent(
  deviceId: string,
  targetKind: "activity_event" | "comment" | "user",
  targetId: string,
  reason = "other",
) {
  await socialWriteFn({ data: { op: "reportContent", deviceId, targetKind, targetId, reason } });
}

export async function fetchForYouFeed(
  deviceId: string,
  limit = 30,
  targeting?: { goal?: string | null; level?: string | null },
): Promise<ActivityEvent[]> {
  const { getForYouFeedFn } = await import("@/lib/social/graph.functions");
  const res = await getForYouFeedFn({
    data: { deviceId, limit, goal: targeting?.goal ?? null, level: targeting?.level ?? null },
  });
  return (res.events ?? []).map((e) => ({
    id: e.id,
    deviceId: e.deviceId,
    userId: e.userId,
    displayName: e.displayName,
    kind: e.kind as ActivityKind,
    payload: e.payload,
    kudosCount: e.kudosCount,
    createdAt: e.createdAt,
    reactionCounts: e.reactionCounts,
    myReaction: e.myReaction,
    commentCount: e.commentCount,
  }));
}

export async function followUser(deviceId: string, targetUserId: string, displayName: string) {
  await socialWriteFn({ data: { op: "follow", deviceId, targetUserId, displayName } });
}

export async function unfollowUser(deviceId: string, targetUserId: string) {
  await socialWriteFn({ data: { op: "unfollow", deviceId, targetUserId } });
}

export async function blockUser(deviceId: string, targetUserId: string) {
  await socialWriteFn({ data: { op: "block", deviceId, targetUserId } });
}

export async function unblockUser(deviceId: string, targetUserId: string) {
  await socialWriteFn({ data: { op: "unblock", deviceId, targetUserId } });
}

export async function muteUser(deviceId: string, targetUserId: string) {
  await socialWriteFn({ data: { op: "mute", deviceId, targetUserId } });
}

export async function unmuteUser(deviceId: string, targetUserId: string) {
  await socialWriteFn({ data: { op: "unmute", deviceId, targetUserId } });
}

export async function reactToEvent(
  eventId: string,
  deviceId: string,
  kind: import("@/lib/social/visibility").ReactionKind,
) {
  await socialWriteFn({ data: { op: "react", eventId, deviceId, kind } });
  if (kind === "fire") {
    try {
      window.localStorage.setItem(kudosKey(deviceId, eventId), "1");
    } catch {
      /* ignore */
    }
  }
}

export async function commentOnEvent(eventId: string, deviceId: string, body: string) {
  await socialWriteFn({ data: { op: "comment", eventId, deviceId, body } });
}

export async function dismissFeedItem(
  deviceId: string,
  authorUserId: string,
  kind: string,
  contentId?: string,
) {
  await socialWriteFn({
    data: contentId
      ? { op: "dismissFeed", deviceId, kind, contentId }
      : { op: "dismissFeed", deviceId, authorUserId, kind },
  });
}

export async function markFeedSeen(
  deviceId: string,
  opts: { eventId?: string; contentId?: string },
) {
  if (!opts.eventId && !opts.contentId) return;
  await socialWriteFn({
    data: {
      op: "markSeen",
      deviceId,
      ...(opts.eventId ? { eventId: opts.eventId } : {}),
      ...(opts.contentId ? { contentId: opts.contentId } : {}),
    },
  });
}

export async function inviteToChallenge(
  deviceId: string,
  challengeId: string,
  toUserId: string,
  displayName: string,
) {
  await socialWriteFn({ data: { op: "inviteChallenge", deviceId, challengeId, toUserId, displayName } });
}

export async function acceptChallengeInvite(deviceId: string, inviteId: string, displayName: string) {
  return socialWriteFn({ data: { op: "acceptInvite", deviceId, inviteId, displayName } });
}

export async function declineChallengeInvite(deviceId: string, inviteId: string) {
  await socialWriteFn({ data: { op: "declineInvite", deviceId, inviteId } });
}

export async function saveSocialPrivacyRemote(
  deviceId: string,
  privacy: import("@/lib/social/visibility").SocialPrivacy,
) {
  await socialWriteFn({ data: { op: "savePrivacy", deviceId, privacy } });
}

export async function fetchClubFeed(memberDeviceIds: string[], limit = 40): Promise<ActivityEvent[] | null> {
  if (!memberDeviceIds.length) return [];
  const ids = memberDeviceIds.slice(0, 50);
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, device_id, display_name, kind, payload, kudos_count, created_at")
    .in("device_id", ids)
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    const fallback = await supabase
      .from("activity_events")
      .select("id, device_id, display_name, kind, payload, kudos_count, created_at")
      .in("device_id", ids)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (fallback.error) return null;
    return (fallback.data ?? []).map((e) => ({
      id: e.id,
      deviceId: e.device_id,
      displayName: e.display_name,
      kind: e.kind as ActivityKind,
      payload: (e.payload as Record<string, unknown>) ?? {},
      kudosCount: e.kudos_count ?? 0,
      createdAt: e.created_at,
    }));
  }
  return (data ?? []).map((e) => ({
    id: e.id,
    deviceId: e.device_id,
    displayName: e.display_name,
    kind: e.kind as ActivityKind,
    payload: (e.payload as Record<string, unknown>) ?? {},
    kudosCount: e.kudos_count ?? 0,
    createdAt: e.created_at,
  }));
}

export interface ClubWeeklyRow {
  deviceId: string;
  displayName: string;
  sessions: number;
  volumeKg: number;
  rank: number;
  isYou: boolean;
}

/** Weekly ranking from session check-ins in the last 7 days. */
export async function fetchClubWeeklyRanking(
  memberDeviceIds: string[],
  yourDeviceId: string,
): Promise<ClubWeeklyRow[] | null> {
  if (!memberDeviceIds.length) return [];
  const ids = memberDeviceIds.slice(0, 50);
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { data, error } = await supabase
    .from("activity_events")
    .select("device_id, display_name, kind, payload, created_at")
    .in("device_id", ids)
    .eq("kind", "session")
    .is("hidden_at", null)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return null;

  const map = new Map<string, { displayName: string; sessions: number; volumeKg: number }>();
  for (const id of ids) {
    map.set(id, { displayName: "Soldado", sessions: 0, volumeKg: 0 });
  }
  for (const e of data ?? []) {
    const cur = map.get(e.device_id) ?? { displayName: e.display_name || "Soldado", sessions: 0, volumeKg: 0 };
    cur.displayName = e.display_name || cur.displayName;
    cur.sessions += 1;
    const vol = Number((e.payload as Record<string, unknown> | null)?.["volumeKg"] ?? 0);
    cur.volumeKg += Number.isFinite(vol) ? vol : 0;
    map.set(e.device_id, cur);
  }

  return [...map.entries()]
    .map(([deviceId, r]) => ({
      deviceId,
      displayName: r.displayName,
      sessions: r.sessions,
      volumeKg: Math.round(r.volumeKg),
      rank: 0,
      isYou: deviceId === yourDeviceId,
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg || b.sessions - a.sessions)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function publishSessionEvent(
  deviceId: string,
  displayName: string,
  title: string,
  volumeKg: number,
  extra: { express?: boolean; imageUrl?: string } = {},
) {
  await publishEvent(deviceId, displayName, "session", {
    title,
    volumeKg,
    express: Boolean(extra.express),
    imageUrl: extra.imageUrl ?? null,
  });
}

export async function publishBadgeEvent(deviceId: string, displayName: string, challengeId: string) {
  await publishEvent(deviceId, displayName, "badge", {
    challengeId,
    title: challengeById(challengeId)?.title,
  });
}

export async function publishRetentionEvent(
  deviceId: string,
  displayName: string,
  kind: Extract<ActivityKind, "xp_goal" | "league_rank" | "friend_quest_complete" | "freeze_used">,
  payload: Record<string, unknown> = {},
) {
  await publishEvent(deviceId, displayName, kind, payload);
}

/** Upsert weekly league points for all clubs the device belongs to. */
export async function syncLeaguePoints(deviceId: string, displayName: string, pointsDeltaOrToday: number) {
  if (!deviceId) return;
  await socialWriteFn({
    data: { op: "syncLeague", deviceId, displayName, points: pointsDeltaOrToday },
  });
}

export async function fetchClubLeague(
  clubId: string,
  memberDeviceIds: string[],
  yourDeviceId: string,
): Promise<LeagueRow[] | null> {
  const weekStart = weekStartMonday();
  const { data, error } = await supabase
    .from("club_league_weeks")
    .select("device_id, points")
    .eq("club_id", clubId)
    .eq("week_start", weekStart)
    .order("points", { ascending: false })
    .limit(20);
  if (error) {
    const fallback = await fetchClubWeeklyRanking(memberDeviceIds, yourDeviceId);
    if (!fallback) return null;
    const n = fallback.length;
    return fallback.map((r) => ({
      deviceId: r.deviceId,
      displayName: r.displayName,
      points: r.volumeKg,
      rank: r.rank,
      isYou: r.isYou,
      zone: (r.rank <= 3 ? "promo" : r.rank > n - 3 && n >= 6 ? "risk" : "mid") as LeagueRow["zone"],
    }));
  }

  const ids = [...new Set([...(data ?? []).map((r: { device_id: string }) => r.device_id), ...memberDeviceIds])];
  const { data: profiles } = await supabase.from("social_profiles").select("device_id, display_name").in("device_id", ids);
  const nameMap = new Map((profiles ?? []).map((p) => [p.device_id, p.display_name]));
  const pointMap = new Map(
    (data ?? []).map((r: { device_id: string; points: number }) => [r.device_id, Number(r.points)]),
  );

  const rows = memberDeviceIds
    .map((id) => ({
      deviceId: id,
      displayName: nameMap.get(id) || "Soldado",
      points: Number(pointMap.get(id) ?? 0),
      rank: 0,
      isYou: id === yourDeviceId,
      zone: "mid" as LeagueRow["zone"],
    }))
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const n = rows.length;
  return rows.map((r) => ({
    ...r,
    zone: (r.rank <= 3 ? "promo" : r.rank > n - 3 && n >= 6 ? "risk" : "mid") as LeagueRow["zone"],
  }));
}

export async function ensureFriendQuest(
  deviceId: string,
  club: ClubSummary,
  displayName: string,
): Promise<FriendQuest | null> {
  if (!deviceId || club.members.length < 2) return null;
  const weekStart = weekStartMonday();
  const others = club.members.filter((m) => m.deviceId !== deviceId);
  if (!others.length) return null;
  const partner = others[Math.floor(Math.random() * others.length)]!;
  const nameMap = new Map(club.members.map((m) => [m.deviceId, m.displayName]));

  const res = await socialWriteFn({
    data: {
      op: "ensureFriendQuest",
      deviceId,
      clubId: club.id,
      weekStart,
      partnerDeviceId: partner.deviceId,
      displayName,
    },
  });
  const quest = res.quest as
    | {
        id: string;
        clubId: string;
        weekStart: string;
        deviceA: string;
        deviceB: string;
        target: number;
        progressA: number;
        progressB: number;
      }
    | undefined;
  if (!quest) return null;
  return {
    id: quest.id,
    clubId: quest.clubId,
    weekStart: quest.weekStart,
    deviceA: quest.deviceA,
    deviceB: quest.deviceB,
    nameA: nameMap.get(quest.deviceA) || displayName,
    nameB: nameMap.get(quest.deviceB) || partner.displayName,
    target: quest.target,
    progressA: quest.progressA,
    progressB: quest.progressB,
  };
}

export async function bumpFriendQuestOnSession(deviceId: string) {
  if (!deviceId) return;
  const weekStart = weekStartMonday();
  await socialWriteFn({ data: { op: "bumpFriendQuest", deviceId, weekStart } });
}

export async function uploadCheckinImage(deviceId: string, file: File): Promise<string | null> {
  if (!deviceId) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${deviceId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("checkins").upload(path, file, { upsert: true });
  if (error) {
    console.error("Upload check-in falhou", error);
    return null;
  }
  const { data } = supabase.storage.from("checkins").getPublicUrl(path);
  return data.publicUrl;
}

export async function publishSessionWithImage(
  deviceId: string,
  displayName: string,
  title: string,
  volumeKg: number,
  imageUrl?: string | null,
  express?: boolean,
) {
  await publishSessionEvent(deviceId, displayName, title, volumeKg, {
    ...(express ? { express: true } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  });
}

export async function fetchClubStories(clubId: string): Promise<ClubStory[]> {
  const since = new Date();
  since.setHours(since.getHours() - 24);
  const { data, error } = await supabase
    .from("club_stories")
    .select("id, club_id, device_id, image_url, created_at")
    .eq("club_id", clubId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data?.length) return [];
  const ids = data.map((s: { device_id: string }) => s.device_id);
  const { data: profiles } = await supabase.from("social_profiles").select("device_id, display_name").in("device_id", ids);
  const nameMap = new Map((profiles ?? []).map((p) => [p.device_id, p.display_name]));
  return data.map((s: { id: string; club_id: string; device_id: string; image_url: string; created_at: string }) => ({
    id: s.id,
    clubId: s.club_id,
    deviceId: s.device_id,
    displayName: nameMap.get(s.device_id) || "Soldado",
    imageUrl: s.image_url,
    createdAt: s.created_at,
  }));
}

export async function publishClubStory(clubId: string, deviceId: string, imageUrl: string) {
  await socialWriteFn({ data: { op: "publishClubStory", clubId, deviceId, imageUrl } });
}

/** Server-side kudos dedupe via activity_kudos table; falls back to localStorage. */
export async function giveKudosServer(eventId: string, current: number, deviceId: string) {
  if (!deviceId) throw new Error("Dispositivo inválido");
  if (hasGivenKudos(deviceId, eventId)) throw new Error("Você já reagiu a este check-in");
  try {
    await socialWriteFn({ data: { op: "giveKudos", eventId, current, deviceId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("já reagiu")) throw e;
    await giveKudosOnce(eventId, current, deviceId);
    return;
  }
  try {
    window.localStorage.setItem(kudosKey(deviceId, eventId), "1");
  } catch {
    /* ignore */
  }
}

export async function trackEngagementEvent(
  deviceId: string,
  name: string,
  props: Record<string, unknown> = {},
) {
  try {
    const { trackAppEvent } = await import("@/lib/shopify.functions");
    await trackAppEvent({
      data: { deviceId, kind: name, payload: props },
    });
  } catch {
    /* analytics best-effort */
  }
}
