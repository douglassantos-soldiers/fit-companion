/**
 * Social/engagement mutations via service_role after RLS harden.
 * Client must not INSERT/UPDATE/DELETE social tables with anon key.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import { challengeById, isPersonalizedChallenge, isRelativeChallenge } from "@/data/challenges";
import {
  isReactionKind,
  normalizeSocialPrivacy,
  sanitizeCommentBody,
  shouldPublishEvent,
  stripSensitiveSocialPayload,
} from "@/lib/social/visibility";
import {
  assertBothClubMembersByUser,
  assertChallengeOwnershipByUser,
  isAllowedCheckinImageUrl,
  scoreChallengeProgress,
} from "@/lib/security-authz";
import { computeWeeklyLeaguePoints } from "@/lib/league-points.server";

/** Membership by user_id (preferred); legacy device_id only when user_id is null. */
async function isClubMemberByUser(
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
  if (byDevice.user_id == null) {
    await db
      .from("club_members")
      .update({ user_id: userId })
      .eq("club_id", clubId)
      .eq("device_id", deviceId);
    return true;
  }
  return byDevice.user_id === userId;
}

export type SocialWriteOp =
  | { op: "ensureProfile"; deviceId: string; displayName: string }
  | {
      op: "joinChallenge";
      deviceId: string;
      challengeId: string;
      displayName: string;
      baseline?: number;
      personalTarget?: number;
    }
  | { op: "leaveChallenge"; deviceId: string; challengeId: string }
  | {
      op: "syncChallengeProgress";
      deviceId: string;
      challengeId: string;
      value: number;
      displayName: string;
      baseline?: number;
      personalTarget?: number;
      /** @deprecated ignored — server computes */
      pct?: number;
      complete?: boolean;
      fraudFlags?: unknown[];
      proofStatus?: string;
      proofSource?: string;
    }
  | {
      op: "createClub";
      deviceId: string;
      name: string;
      displayName: string;
    }
  | { op: "joinClub"; deviceId: string; code: string; displayName: string }
  | {
      op: "publishEvent";
      deviceId: string;
      displayName: string;
      kind: string;
      payload?: Record<string, unknown>;
    }
  | { op: "giveKudos"; eventId: string; current: number; deviceId: string }
  | { op: "syncLeague"; deviceId: string; displayName: string; points?: number }
  | {
      op: "ensureFriendQuest";
      deviceId: string;
      clubId: string;
      weekStart: string;
      partnerDeviceId: string;
      displayName: string;
    }
  | { op: "bumpFriendQuest"; deviceId: string; weekStart: string }
  | { op: "publishClubStory"; clubId: string; deviceId: string; imageUrl: string }
  | { op: "hubJoin"; deviceId: string; hubId: string }
  | { op: "hubLeave"; deviceId: string; hubId: string }
  | {
      op: "linkAuthSocial";
      deviceId: string;
      displayName: string;
      /** @deprecated ignored — Auth session only */
      authUserId?: string;
    }
  | { op: "reportEvent"; deviceId: string; eventId: string; reason: string }
  | { op: "follow"; deviceId: string; targetUserId: string; displayName: string }
  | { op: "unfollow"; deviceId: string; targetUserId: string }
  | { op: "block"; deviceId: string; targetUserId: string }
  | { op: "unblock"; deviceId: string; targetUserId: string }
  | { op: "mute"; deviceId: string; targetUserId: string }
  | { op: "unmute"; deviceId: string; targetUserId: string }
  | { op: "react"; deviceId: string; eventId: string; kind: string }
  | { op: "comment"; deviceId: string; eventId: string; body: string }
  | { op: "dismissFeed"; deviceId: string; authorUserId?: string; kind: string; contentId?: string }
  | { op: "markSeen"; deviceId: string; eventId?: string; contentId?: string }
  | {
      op: "inviteChallenge";
      deviceId: string;
      challengeId: string;
      toUserId: string;
      displayName: string;
    }
  | { op: "acceptInvite"; deviceId: string; inviteId: string; displayName: string }
  | { op: "declineInvite"; deviceId: string; inviteId: string }
  | {
      op: "reportContent";
      deviceId: string;
      targetKind: "activity_event" | "comment" | "user";
      targetId: string;
      reason: string;
    }
  | { op: "savePrivacy"; deviceId: string; privacy: Record<string, string> }
  | { op: "enrollProgram"; deviceId: string; programId: string };

function clubCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  return out;
}

async function assertDevice(deviceId: string, requireAccess = true) {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess });
  if (!identity) throw new Error("Identidade inválida");
  return identity;
}

async function isBlockedEitherWay(
  db: NonNullable<Awaited<ReturnType<typeof adminDbLoose>>>,
  a: string,
  b: string,
) {
  const [out, inn] = await Promise.all([
    db
      .from("social_blocks")
      .select("blocker_id")
      .eq("blocker_id", a)
      .eq("blocked_id", b)
      .maybeSingle(),
    db
      .from("social_blocks")
      .select("blocker_id")
      .eq("blocker_id", b)
      .eq("blocked_id", a)
      .maybeSingle(),
  ]);
  return Boolean(out.data || inn.data);
}

export async function executeSocialWrite(op: SocialWriteOp): Promise<Record<string, unknown>> {
  const db = await adminDbLoose();
  if (!db) throw new Error("DB indisponível");

  switch (op.op) {
    case "ensureProfile": {
      const identity = await assertDevice(op.deviceId);
      const { error } = await db.from("social_profiles").upsert(
        {
          device_id: op.deviceId,
          app_user_id: identity.userId,
          display_name: op.displayName || "Soldado",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
      if (error) throw error;
      // Also upsert by app_user_id when unique index exists (best-effort second write)
      try {
        await db
          .from("social_profiles")
          .update({
            app_user_id: identity.userId,
            display_name: op.displayName || "Soldado",
            updated_at: new Date().toISOString(),
          })
          .eq("device_id", op.deviceId);
      } catch {
        /* ignore */
      }
      return { ok: true, userId: identity.userId };
    }
    case "joinChallenge": {
      const identity = await assertDevice(op.deviceId);
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      const { error } = await db.from("challenge_entries").upsert(
        {
          device_id: op.deviceId,
          user_id: identity.userId,
          challenge_id: op.challengeId,
        },
        { onConflict: "device_id,challenge_id" },
      );
      if (error) throw error;
      const c = challengeById(op.challengeId);
      const needsBaseline =
        c && (isRelativeChallenge(c) || isPersonalizedChallenge(c)) && op.baseline !== undefined;
      if (needsBaseline) {
        const rawBaseline = Math.max(0, Number(op.baseline));
        const baseline = Math.min(rawBaseline, 1_000_000);
        const personalTarget = isPersonalizedChallenge(c!)
          ? Math.min(Math.max(1, Number(op.personalTarget ?? 1)), 1_000_000)
          : undefined;
        const scored = scoreChallengeProgress({
          value: baseline,
          baseline,
          metric: c!.metric ?? "sessoes",
          ...(personalTarget != null ? { personalTarget } : {}),
        });
        const { error: progErr } = await db.from("challenge_progress").upsert(
          {
            device_id: op.deviceId,
            user_id: identity.userId,
            challenge_id: op.challengeId,
            recorded_value: scored.recordedValue,
            eligible_value: scored.eligibleValue,
            verification_status: scored.verificationStatus,
            value: scored.eligibleValue,
            baseline_value: baseline,
            pct_value: 0,
            personal_target: personalTarget ?? null,
            proof_status: "self_reported",
            proof_source:
              c!.metric === "steps" || c!.metric === "football_sessions"
                ? "app_manual"
                : "app_session",
            fraud_flags: scored.flags,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "device_id,challenge_id" },
        );
        if (progErr) throw progErr;
      }
      await executeSocialWrite({
        op: "publishEvent",
        deviceId: op.deviceId,
        displayName: op.displayName,
        kind: "challenge_join",
        payload: {
          challengeId: op.challengeId,
          title: c?.title,
          relative: c ? isRelativeChallenge(c) : false,
          personalized: c ? isPersonalizedChallenge(c) : false,
          personalTarget: op.personalTarget,
        },
      });
      try {
        const { trackUserEvent } = await import("@/lib/events/track");
        await trackUserEvent({
          deviceId: op.deviceId,
          resolvedUserId: identity.userId,
          eventType: "challenge_joined",
          source: "social",
          entityType: "challenge",
          entityId: op.challengeId,
          metadata: {
            challengeId: op.challengeId,
            personalTarget: op.personalTarget,
          },
          idempotencyKey: `challenge:${op.challengeId}:challenge_joined`,
        });
      } catch {
        /* best-effort */
      }
      void import("@/lib/push.server")
        .then(({ notifyUserPush }) =>
          notifyUserPush({
            userId: identity.userId,
            category: "challenge",
            title: "Desafio",
            body: c?.title ? `Você entrou em ${c.title}.` : "Você entrou em um desafio.",
            respectQuietHours: false,
          }),
        )
        .catch(() => undefined);
      return { ok: true };
    }
    case "leaveChallenge": {
      const identity = await assertDevice(op.deviceId);
      await db
        .from("challenge_entries")
        .delete()
        .eq("user_id", identity.userId)
        .eq("challenge_id", op.challengeId);
      await db
        .from("challenge_progress")
        .delete()
        .eq("user_id", identity.userId)
        .eq("challenge_id", op.challengeId);
      // Legacy rows without user_id
      await db
        .from("challenge_entries")
        .delete()
        .eq("device_id", op.deviceId)
        .eq("challenge_id", op.challengeId)
        .is("user_id", null);
      await db
        .from("challenge_progress")
        .delete()
        .eq("device_id", op.deviceId)
        .eq("challenge_id", op.challengeId)
        .is("user_id", null);
      return { ok: true };
    }
    case "syncChallengeProgress": {
      const identity = await assertDevice(op.deviceId);
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      const { data: entryByUser } = await db
        .from("challenge_entries")
        .select("device_id, user_id")
        .eq("user_id", identity.userId)
        .eq("challenge_id", op.challengeId)
        .maybeSingle();
      const { data: entryByDevice } = entryByUser
        ? { data: null }
        : await db
            .from("challenge_entries")
            .select("device_id, user_id")
            .eq("device_id", op.deviceId)
            .eq("challenge_id", op.challengeId)
            .maybeSingle();
      const entry = entryByUser ?? entryByDevice;
      if (!entry) throw new Error("Não inscrito neste desafio");
      const entryUserIds = [identity.userId];
      if (entry.user_id && entry.user_id !== identity.userId) {
        throw new Error("Não inscrito neste desafio");
      }
      if (!assertChallengeOwnershipByUser(entryUserIds, identity.userId)) {
        throw new Error("Não inscrito neste desafio");
      }

      const c = challengeById(op.challengeId);
      const relative = c ? isRelativeChallenge(c) : false;
      const personalized = c ? isPersonalizedChallenge(c) : false;
      const baseline = Math.max(0, Number(op.baseline ?? 0));
      const personalTarget =
        op.personalTarget != null && Number.isFinite(Number(op.personalTarget))
          ? Math.min(Math.max(1, Number(op.personalTarget)), 1_000_000)
          : undefined;

      const scored = scoreChallengeProgress({
        value: Number(op.value),
        baseline,
        metric: c?.metric ?? "sessoes",
        ...(personalTarget != null ? { personalTarget } : {}),
      });

      let pct = scored.pct;
      if (pct == null && relative) {
        pct = ((scored.eligibleValue - baseline) / Math.max(baseline, 1)) * 100;
      } else if (pct == null && personalized && personalTarget) {
        pct = (scored.eligibleValue / Math.max(personalTarget, 1)) * 100;
      }

      const proofSource =
        c?.metric === "steps" || c?.metric === "football_sessions" ? "app_manual" : "app_session";

      const { error } = await db.from("challenge_progress").upsert(
        {
          device_id: op.deviceId,
          user_id: identity.userId,
          challenge_id: op.challengeId,
          recorded_value: scored.recordedValue,
          eligible_value: scored.eligibleValue,
          verification_status: scored.verificationStatus,
          value: scored.eligibleValue,
          baseline_value: baseline,
          pct_value: pct,
          personal_target: personalTarget ?? null,
          proof_status: "self_reported",
          proof_source: proofSource,
          fraud_flags: scored.flags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id,challenge_id" },
      );
      if (error) throw error;

      const done =
        scored.verificationStatus !== "rejected" &&
        Boolean(
          c
            ? relative
              ? (pct ?? 0) >= (c.targetPct ?? c.target)
              : personalized && personalTarget
                ? scored.eligibleValue >= personalTarget
                : scored.eligibleValue >= c.target
            : false,
        );
      if (c && done) {
        await executeSocialWrite({
          op: "publishEvent",
          deviceId: op.deviceId,
          displayName: op.displayName,
          kind: "challenge_complete",
          payload: {
            challengeId: op.challengeId,
            title: c.title,
            value: scored.eligibleValue,
            recordedValue: scored.recordedValue,
            pct: pct ?? undefined,
            relative,
            personalized,
            personalTarget,
            proofStatus: "self_reported",
            verificationStatus: scored.verificationStatus,
          },
        });
        try {
          const { trackUserEvent } = await import("@/lib/events/track");
          await trackUserEvent({
            deviceId: op.deviceId,
            resolvedUserId: identity.userId,
            eventType: "challenge_completed",
            source: "social",
            entityType: "challenge",
            entityId: op.challengeId,
            metadata: {
              challengeId: op.challengeId,
              value: scored.eligibleValue,
              personalTarget,
            },
            idempotencyKey: `challenge:${op.challengeId}:challenge_completed`,
          });
        } catch {
          /* best-effort */
        }
        void import("@/lib/push.server")
          .then(({ notifyUserPush }) =>
            notifyUserPush({
              userId: identity.userId,
              category: "challenge",
              title: "Desafio concluído",
              body: c.title,
              respectQuietHours: false,
            }),
          )
          .catch(() => undefined);
      }
      return {
        ok: true,
        done,
        verificationStatus: scored.verificationStatus,
        eligibleValue: scored.eligibleValue,
        recordedValue: scored.recordedValue,
      };
    }
    case "createClub": {
      const identity = await assertDevice(op.deviceId);
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      const code = clubCode();
      const { data, error } = await db
        .from("clubs")
        .insert({
          name: op.name.trim() || "Clube Soldiers",
          code,
          created_by_device_id: op.deviceId,
        })
        .select("id, name, code")
        .single();
      if (error || !data) throw error ?? new Error("Não foi possível criar o clube");
      await db.from("club_members").insert({
        club_id: data.id,
        device_id: op.deviceId,
        user_id: identity.userId,
      });
      return {
        ok: true,
        club: {
          id: data.id,
          name: data.name,
          code: data.code,
          memberCount: 1,
          members: [{ deviceId: op.deviceId, displayName: op.displayName }],
        },
      };
    }
    case "joinClub": {
      const identity = await assertDevice(op.deviceId);
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      const normalized = op.code.trim().toUpperCase();
      const { data: club, error } = await db
        .from("clubs")
        .select("id, name, code")
        .eq("code", normalized)
        .maybeSingle();
      if (error) throw error;
      if (!club) throw new Error("Código inválido");
      await db
        .from("club_members")
        .upsert(
          { club_id: club.id, device_id: op.deviceId, user_id: identity.userId },
          { onConflict: "club_id,device_id" },
        );
      return { ok: true, clubId: club.id };
    }
    case "publishEvent": {
      const identity = await assertDevice(op.deviceId);
      const payload = stripSensitiveSocialPayload(op.payload ?? {});
      const { data: profileRow } = await db
        .from("social_profiles")
        .select(
          "privacy_profile, privacy_workouts, privacy_prs, privacy_weight, privacy_photos, privacy_nutrition",
        )
        .eq("app_user_id", identity.userId)
        .maybeSingle();
      const privacy = normalizeSocialPrivacy(profileRow ?? {}, true);
      if (!shouldPublishEvent(privacy, op.kind, payload)) {
        return { ok: true, skipped: true };
      }
      const { error } = await db.from("activity_events").insert({
        device_id: op.deviceId,
        user_id: identity.userId,
        display_name: op.displayName || "Soldado",
        kind: op.kind,
        payload,
      });
      if (error) console.error("publishEvent failed", error);
      return { ok: !error };
    }
    case "giveKudos": {
      return executeSocialWrite({
        op: "react",
        deviceId: op.deviceId,
        eventId: op.eventId,
        kind: "fire",
      });
    }
    case "syncLeague": {
      const identity = await assertDevice(op.deviceId);
      // Ignore client-supplied points entirely (P0)
      void op.points;
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      const points = await computeWeeklyLeaguePoints(identity.userId);
      const { data: membershipsByUser } = await db
        .from("club_members")
        .select("club_id")
        .eq("user_id", identity.userId);
      const { data: membershipsByDevice } = await db
        .from("club_members")
        .select("club_id, user_id")
        .eq("device_id", op.deviceId)
        .is("user_id", null);
      const memberships = [
        ...(membershipsByUser ?? []),
        ...((membershipsByDevice ?? []) as Array<{ club_id: string }>),
      ];
      const weekStart = (() => {
        const d = new Date();
        const day = (d.getDay() + 6) % 7;
        const monday = new Date(d);
        monday.setHours(12, 0, 0, 0);
        monday.setDate(d.getDate() - day);
        return monday.toISOString().slice(0, 10);
      })();
      for (const m of memberships ?? []) {
        const { data: existing } = await db
          .from("club_league_weeks")
          .select("points")
          .eq("club_id", m.club_id)
          .eq("week_start", weekStart)
          .eq("device_id", op.deviceId)
          .maybeSingle();
        const prev = Number(existing?.points ?? 0);
        // Monotonic: never decrease from verified server score
        const next = Math.max(prev, points);
        await db.from("club_league_weeks").upsert(
          {
            club_id: m.club_id,
            week_start: weekStart,
            device_id: op.deviceId,
            points: next,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "club_id,week_start,device_id" },
        );
      }
      return { ok: true, points };
    }
    case "ensureFriendQuest": {
      const identity = await assertDevice(op.deviceId);
      if (!op.partnerDeviceId || op.partnerDeviceId === op.deviceId) {
        throw new Error("Parceiro inválido");
      }
      const { data: members } = await db
        .from("club_members")
        .select("device_id, user_id")
        .eq("club_id", op.clubId);
      const memberRows = (members ?? []) as Array<{
        device_id: string;
        user_id?: string | null;
      }>;
      const memberUserIds = memberRows
        .map((m) => m.user_id)
        .filter((id): id is string => Boolean(id));
      // Resolve partner user via device registry / membership row
      const partnerRow = memberRows.find((m) => m.device_id === op.partnerDeviceId);
      let partnerUserId = partnerRow?.user_id ?? null;
      if (!partnerUserId) {
        const { getUserIdForDevice } = await import("@/lib/identity");
        partnerUserId = await getUserIdForDevice(op.partnerDeviceId);
      }
      if (!partnerUserId) throw new Error("Ambos devem ser membros do clube");
      const actorInClub =
        memberUserIds.includes(identity.userId) ||
        memberRows.some(
          (m) =>
            m.device_id === op.deviceId && (m.user_id == null || m.user_id === identity.userId),
        );
      const partnerInClub =
        memberUserIds.includes(partnerUserId) ||
        memberRows.some((m) => m.device_id === op.partnerDeviceId);
      if (!actorInClub || !partnerInClub) {
        throw new Error("Ambos devem ser membros do clube");
      }
      if (
        !assertBothClubMembersByUser(
          [...new Set([...memberUserIds, identity.userId, partnerUserId])],
          identity.userId,
          partnerUserId,
        )
      ) {
        throw new Error("Ambos devem ser membros do clube");
      }

      const { data: existing } = await db
        .from("friend_quests")
        .select("*")
        .eq("club_id", op.clubId)
        .eq("week_start", op.weekStart)
        .or(`device_a.eq.${op.deviceId},device_b.eq.${op.deviceId}`)
        .maybeSingle();
      if (existing) {
        return {
          ok: true,
          quest: {
            id: existing.id,
            clubId: existing.club_id,
            weekStart: existing.week_start,
            deviceA: existing.device_a,
            deviceB: existing.device_b,
            target: existing.target ?? 4,
            progressA: existing.progress_a ?? 0,
            progressB: existing.progress_b ?? 0,
          },
        };
      }
      const { data, error } = await db
        .from("friend_quests")
        .insert({
          club_id: op.clubId,
          week_start: op.weekStart,
          device_a: op.deviceId,
          device_b: op.partnerDeviceId,
          user_id_a: identity.userId,
          ...(partnerUserId ? { user_id_b: partnerUserId } : {}),
          target: 4,
          progress_a: 0,
          progress_b: 0,
        })
        .select("*")
        .single();
      if (error || !data) return { ok: false };
      return {
        ok: true,
        quest: {
          id: data.id,
          clubId: data.club_id,
          weekStart: data.week_start,
          deviceA: data.device_a,
          deviceB: data.device_b,
          target: data.target ?? 4,
          progressA: 0,
          progressB: 0,
        },
      };
    }
    case "bumpFriendQuest": {
      const identity = await assertDevice(op.deviceId);
      // Require a verified session today (idempotent bump per day via engagement marker)
      const today = new Date().toISOString().slice(0, 10);
      const { data: sessionToday } = await db
        .from("sessions")
        .select("client_id")
        .eq("user_id", identity.userId)
        .eq("date", today)
        .limit(1)
        .maybeSingle();
      if (!sessionToday) return { ok: true, skipped: true, reason: "no_session" };

      const bumpKey = `friend_quest_bump:${op.weekStart}:${today}`;
      const { data: already } = await db
        .from("engagement_events")
        .select("id")
        .eq("device_id", op.deviceId)
        .eq("name", bumpKey)
        .limit(1)
        .maybeSingle();
      if (already) return { ok: true, skipped: true, reason: "already_bumped" };

      const { data: rows } = await db
        .from("friend_quests")
        .select("*")
        .eq("week_start", op.weekStart)
        .or(`device_a.eq.${op.deviceId},device_b.eq.${op.deviceId}`);
      for (const row of rows ?? []) {
        const isA = row.device_a === op.deviceId;
        const patch = isA
          ? { progress_a: (row.progress_a ?? 0) + 1 }
          : { progress_b: (row.progress_b ?? 0) + 1 };
        await db.from("friend_quests").update(patch).eq("id", row.id);
      }
      await db.from("engagement_events").insert({
        device_id: op.deviceId,
        name: bumpKey,
        props: { userId: identity.userId, weekStart: op.weekStart },
      });
      return { ok: true };
    }
    case "publishClubStory": {
      const identity = await assertDevice(op.deviceId);
      const isMember = await isClubMemberByUser(db, op.clubId, identity.userId, op.deviceId);
      if (!isMember) throw new Error("Você não é membro deste clube");

      const supabaseHost = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "")
        .replace(/^https?:\/\//, "")
        .split("/")[0];
      if (!isAllowedCheckinImageUrl(op.imageUrl, supabaseHost || undefined)) {
        throw new Error("URL de mídia inválida");
      }

      const { error } = await db.from("club_stories").insert({
        club_id: op.clubId,
        device_id: op.deviceId,
        image_url: op.imageUrl,
      });
      if (error) throw error;
      return { ok: true };
    }
    case "hubJoin": {
      const identity = await assertDevice(op.deviceId);
      const { error } = await db
        .from("hub_members")
        .upsert(
          { hub_id: op.hubId, device_id: op.deviceId, user_id: identity.userId },
          { onConflict: "hub_id,device_id" },
        );
      if (error) throw error;
      return { ok: true };
    }
    case "hubLeave": {
      await assertDevice(op.deviceId);
      await db.from("hub_members").delete().eq("hub_id", op.hubId).eq("device_id", op.deviceId);
      return { ok: true };
    }
    case "linkAuthSocial": {
      const identity = await assertDevice(op.deviceId);
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      await db
        .from("social_profiles")
        .update({
          app_user_id: identity.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("device_id", op.deviceId);

      // Never trust client authUserId — resolve from Supabase Auth cookie/session if present
      void op.authUserId;
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
        const anon =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ||
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
          "";
        if (url && anon) {
          const { getCookie } = await import("@tanstack/react-start/server");
          // Prefer Authorization-style project cookies if available; otherwise skip link
          const accessToken = getCookie("sb-access-token") || getCookie("sb-auth-token");
          if (accessToken) {
            const client = createClient(url, anon, {
              global: { headers: { Authorization: `Bearer ${accessToken}` } },
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data: auth } = await client.auth.getUser();
            if (auth.user?.id) {
              const { linkAuthUserId } = await import("@/lib/identity");
              await linkAuthUserId({ userId: identity.userId, authUserId: auth.user.id });
            }
          }
        }
      } catch (e) {
        console.warn("linkAuthSocial auth session resolve skipped", e);
      }
      return { ok: true, userId: identity.userId };
    }
    case "reportEvent": {
      return executeSocialWrite({
        op: "reportContent",
        deviceId: op.deviceId,
        targetKind: "activity_event",
        targetId: op.eventId,
        reason: op.reason,
      });
    }
    case "follow": {
      const identity = await assertDevice(op.deviceId);
      if (op.targetUserId === identity.userId) throw new Error("Não dá para seguir a si mesmo");
      const blocked = await isBlockedEitherWay(db, identity.userId, op.targetUserId);
      if (blocked) throw new Error("Usuário indisponível");
      const { error } = await db
        .from("social_follows")
        .upsert(
          { follower_id: identity.userId, following_id: op.targetUserId },
          { onConflict: "follower_id,following_id" },
        );
      if (error) throw error;
      await executeSocialWrite({
        op: "publishEvent",
        deviceId: op.deviceId,
        displayName: op.displayName || "Soldado",
        kind: "user_followed",
        payload: { targetUserId: op.targetUserId },
      });
      void import("@/lib/push.server")
        .then(({ notifyUserPush }) =>
          notifyUserPush({
            userId: op.targetUserId,
            category: "kudos",
            title: "Novo seguidor",
            body: `${op.displayName || "Alguém"} começou a te seguir.`,
            respectQuietHours: true,
          }),
        )
        .catch(() => undefined);
      return { ok: true };
    }
    case "unfollow": {
      const identity = await assertDevice(op.deviceId);
      await db
        .from("social_follows")
        .delete()
        .eq("follower_id", identity.userId)
        .eq("following_id", op.targetUserId);
      return { ok: true };
    }
    case "block": {
      const identity = await assertDevice(op.deviceId);
      if (op.targetUserId === identity.userId) throw new Error("Não dá para bloquear a si mesmo");
      const { error } = await db
        .from("social_blocks")
        .upsert(
          { blocker_id: identity.userId, blocked_id: op.targetUserId },
          { onConflict: "blocker_id,blocked_id" },
        );
      if (error) throw error;
      await db
        .from("social_follows")
        .delete()
        .eq("follower_id", identity.userId)
        .eq("following_id", op.targetUserId);
      await db
        .from("social_follows")
        .delete()
        .eq("follower_id", op.targetUserId)
        .eq("following_id", identity.userId);
      return { ok: true };
    }
    case "unblock": {
      const identity = await assertDevice(op.deviceId);
      await db
        .from("social_blocks")
        .delete()
        .eq("blocker_id", identity.userId)
        .eq("blocked_id", op.targetUserId);
      return { ok: true };
    }
    case "mute": {
      const identity = await assertDevice(op.deviceId);
      if (op.targetUserId === identity.userId) throw new Error("Não dá para silenciar a si mesmo");
      const { error } = await db
        .from("social_mutes")
        .upsert(
          { user_id: identity.userId, muted_id: op.targetUserId },
          { onConflict: "user_id,muted_id" },
        );
      if (error) throw error;
      return { ok: true };
    }
    case "unmute": {
      const identity = await assertDevice(op.deviceId);
      await db
        .from("social_mutes")
        .delete()
        .eq("user_id", identity.userId)
        .eq("muted_id", op.targetUserId);
      return { ok: true };
    }
    case "react": {
      const identity = await assertDevice(op.deviceId);
      if (!isReactionKind(op.kind)) throw new Error("Reação inválida");
      const { data: ev } = await db
        .from("activity_events")
        .select("id, user_id, hidden_at, payload")
        .eq("id", op.eventId)
        .maybeSingle();
      if (!ev || ev.hidden_at) throw new Error("Evento indisponível");
      if (ev.user_id) {
        const blocked = await isBlockedEitherWay(db, identity.userId, ev.user_id);
        if (blocked) throw new Error("Evento indisponível");
      }
      const { error } = await db
        .from("activity_reactions")
        .upsert(
          { event_id: op.eventId, user_id: identity.userId, kind: op.kind },
          { onConflict: "event_id,user_id" },
        );
      if (error) throw error;
      if (op.kind === "fire") {
        await db
          .from("activity_kudos")
          .upsert(
            { event_id: op.eventId, device_id: op.deviceId },
            { onConflict: "event_id,device_id" },
          );
      }
      const { data: reacts } = await db
        .from("activity_reactions")
        .select("kind")
        .eq("event_id", op.eventId);
      const fireCount = ((reacts ?? []) as Array<{ kind: string }>).filter(
        (r) => r.kind === "fire",
      ).length;
      await db.from("activity_events").update({ kudos_count: fireCount }).eq("id", op.eventId);
      try {
        if (ev.user_id && ev.user_id !== identity.userId) {
          void import("@/lib/push.server")
            .then(({ notifyUserPush }) =>
              notifyUserPush({
                userId: ev.user_id!,
                category: "kudos",
                title: "Kudos",
                body: "Alguém reagiu ao seu check-in.",
                respectQuietHours: true,
              }),
            )
            .catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
      return { ok: true, kudos: fireCount };
    }
    case "comment": {
      const identity = await assertDevice(op.deviceId);
      const body = sanitizeCommentBody(op.body);
      if (!body) throw new Error("Comentário vazio");
      const { data: ev } = await db
        .from("activity_events")
        .select("id, user_id, hidden_at")
        .eq("id", op.eventId)
        .maybeSingle();
      if (!ev || ev.hidden_at) throw new Error("Evento indisponível");
      if (ev.user_id) {
        const blocked = await isBlockedEitherWay(db, identity.userId, ev.user_id);
        if (blocked) throw new Error("Evento indisponível");
      }
      const { error } = await db.from("activity_comments").insert({
        event_id: op.eventId,
        user_id: identity.userId,
        body,
      });
      if (error) throw error;
      return { ok: true };
    }
    case "dismissFeed": {
      const identity = await assertDevice(op.deviceId);
      if (op.contentId) {
        const { error } = await db.from("content_dismissals").upsert(
          {
            user_id: identity.userId,
            content_id: op.contentId,
          },
          { onConflict: "user_id,content_id" },
        );
        if (error) throw error;
        return { ok: true };
      }
      if (!op.authorUserId) throw new Error("authorUserId obrigatório");
      const { error } = await db.from("feed_dismissals").upsert(
        {
          user_id: identity.userId,
          author_user_id: op.authorUserId,
          kind: op.kind,
        },
        { onConflict: "user_id,author_user_id,kind" },
      );
      if (error) throw error;
      return { ok: true };
    }
    case "markSeen": {
      const identity = await assertDevice(op.deviceId);
      if (op.contentId) {
        const { error } = await db.from("content_impressions").insert({
          user_id: identity.userId,
          content_id: op.contentId,
        });
        if (error) throw error;
      }
      if (op.eventId) {
        const { error } = await db.from("feed_impressions").insert({
          user_id: identity.userId,
          event_id: op.eventId,
        });
        if (error) throw error;
      }
      return { ok: true };
    }
    case "inviteChallenge": {
      const identity = await assertDevice(op.deviceId);
      if (op.toUserId === identity.userId) throw new Error("Não dá para convidar a si mesmo");
      const c = challengeById(op.challengeId);
      const { error } = await db.from("challenge_invites").insert({
        challenge_id: op.challengeId,
        from_user_id: identity.userId,
        to_user_id: op.toUserId,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505" || String(error.message || "").includes("duplicate")) {
          throw new Error("Convite já pendente");
        }
        throw error;
      }
      await executeSocialWrite({
        op: "publishEvent",
        deviceId: op.deviceId,
        displayName: op.displayName || "Soldado",
        kind: "challenge_invite",
        payload: { challengeId: op.challengeId, title: c?.title, toUserId: op.toUserId },
      });
      void import("@/lib/push.server")
        .then(({ notifyUserPush }) =>
          notifyUserPush({
            userId: op.toUserId,
            category: "challenge",
            title: "Convite de desafio",
            body: c?.title
              ? `${op.displayName || "Alguém"} te convidou para ${c.title}.`
              : "Você recebeu um convite de desafio.",
            respectQuietHours: true,
          }),
        )
        .catch(() => undefined);
      return { ok: true };
    }
    case "acceptInvite": {
      const identity = await assertDevice(op.deviceId);
      const { data: invite } = await db
        .from("challenge_invites")
        .select("id, challenge_id, to_user_id, status")
        .eq("id", op.inviteId)
        .maybeSingle();
      if (!invite || String(invite.to_user_id) !== identity.userId)
        throw new Error("Convite inválido");
      if (invite.status !== "pending") throw new Error("Convite já respondido");
      await db.from("challenge_invites").update({ status: "accepted" }).eq("id", op.inviteId);
      await executeSocialWrite({
        op: "joinChallenge",
        deviceId: op.deviceId,
        challengeId: String(invite.challenge_id),
        displayName: op.displayName || "Soldado",
      });
      return { ok: true, challengeId: String(invite.challenge_id) };
    }
    case "declineInvite": {
      const identity = await assertDevice(op.deviceId);
      await db
        .from("challenge_invites")
        .update({ status: "declined" })
        .eq("id", op.inviteId)
        .eq("to_user_id", identity.userId)
        .eq("status", "pending");
      return { ok: true };
    }
    case "reportContent": {
      const identity = await assertDevice(op.deviceId);
      const { insertContentReport } = await import("@/lib/moderation.server");
      const result = await insertContentReport({
        reporterUserId: identity.userId,
        targetKind: op.targetKind,
        targetId: op.targetId,
        reason: op.reason || "other",
      });
      if (!result.ok) throw new Error("Não foi possível denunciar");
      return { ok: true };
    }
    case "savePrivacy": {
      const { savePrivacyServer } = await import("@/lib/social/graph.server");
      return savePrivacyServer(op.deviceId, normalizeSocialPrivacy(op.privacy));
    }
    case "enrollProgram": {
      const identity = await assertDevice(op.deviceId);
      const programId = String(op.programId ?? "").trim();
      if (!programId) throw new Error("programId obrigatório");
      const { error } = await db.from("content_progress").upsert(
        {
          user_id: identity.userId,
          content_id: programId,
          completion_percent: 0,
          saved: true,
          dismissed: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,content_id" },
      );
      if (error) throw error;
      return { ok: true, programId };
    }
    default:
      throw new Error("op inválida");
  }
}
