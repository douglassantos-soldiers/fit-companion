/**
 * Social/engagement mutations via service_role after RLS harden.
 * Client must not INSERT/UPDATE/DELETE social tables with anon key.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import {
  challengeById,
  isPersonalizedChallenge,
  isRelativeChallenge,
} from "@/data/challenges";
import { validateChallengeProgress } from "@/lib/engine/anti-fraud";
import {
  isReactionKind,
  normalizeSocialPrivacy,
  sanitizeCommentBody,
  shouldPublishEvent,
  stripSensitiveSocialPayload,
} from "@/lib/social/visibility";

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
      pct?: number;
      complete?: boolean;
      personalTarget?: number;
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
  | { op: "syncLeague"; deviceId: string; displayName: string; points: number }
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
      authUserId: string;
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
    db.from("social_blocks").select("blocker_id").eq("blocker_id", a).eq("blocked_id", b).maybeSingle(),
    db.from("social_blocks").select("blocker_id").eq("blocker_id", b).eq("blocked_id", a).maybeSingle(),
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
        const personalTarget = isPersonalizedChallenge(c!)
          ? (op.personalTarget ?? undefined)
          : undefined;
        const { error: progErr } = await db.from("challenge_progress").upsert(
          {
            device_id: op.deviceId,
            user_id: identity.userId,
            challenge_id: op.challengeId,
            value: op.baseline,
            baseline_value: op.baseline,
            pct_value: 0,
            personal_target: personalTarget ?? null,
            proof_status: "self_reported",
            proof_source:
              c!.metric === "steps" || c!.metric === "football_sessions"
                ? "app_manual"
                : "app_session",
            fraud_flags: [],
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
      await assertDevice(op.deviceId);
      await db.from("challenge_entries").delete().eq("device_id", op.deviceId).eq("challenge_id", op.challengeId);
      await db.from("challenge_progress").delete().eq("device_id", op.deviceId).eq("challenge_id", op.challengeId);
      return { ok: true };
    }
    case "syncChallengeProgress": {
      const identity = await assertDevice(op.deviceId);
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      const c = challengeById(op.challengeId);
      const relative = c ? isRelativeChallenge(c) : false;
      const personalized = c ? isPersonalizedChallenge(c) : false;
      const baseline = op.baseline ?? 0;
      const personalTarget = op.personalTarget;
      let pct = op.pct ?? null;
      if (pct == null && relative) {
        pct = ((op.value - baseline) / Math.max(baseline, 1)) * 100;
      } else if (pct == null && personalized && personalTarget) {
        pct = (op.value / Math.max(personalTarget, 1)) * 100;
      }
      const fraud =
        op.fraudFlags ??
        validateChallengeProgress({
          value: op.value,
          baseline,
          metric: c?.metric ?? "sessoes",
          ...(personalTarget != null ? { personalTarget } : {}),
        }).flags;
      const { error } = await db.from("challenge_progress").upsert(
        {
          device_id: op.deviceId,
          user_id: identity.userId,
          challenge_id: op.challengeId,
          value: op.value,
          baseline_value: baseline,
          pct_value: pct,
          personal_target: personalTarget ?? null,
          proof_status: op.proofStatus ?? "self_reported",
          proof_source: op.proofSource ?? "app_session",
          fraud_flags: fraud,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id,challenge_id" },
      );
      if (error) throw error;
      const done =
        op.complete ??
        (c
          ? relative
            ? (pct ?? 0) >= (c.targetPct ?? c.target)
            : personalized && personalTarget
              ? op.value >= personalTarget
              : op.value >= c.target
          : false);
      if (c && done) {
        await executeSocialWrite({
          op: "publishEvent",
          deviceId: op.deviceId,
          displayName: op.displayName,
          kind: "challenge_complete",
          payload: {
            challengeId: op.challengeId,
            title: c.title,
            value: op.value,
            pct: pct ?? undefined,
            relative,
            personalized,
            personalTarget,
            proofStatus: "self_reported",
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
              value: op.value,
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
      return { ok: true, done };
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
      await db.from("club_members").upsert(
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
      await assertDevice(op.deviceId);
      await executeSocialWrite({
        op: "ensureProfile",
        deviceId: op.deviceId,
        displayName: op.displayName,
      });
      const { data: memberships } = await db
        .from("club_members")
        .select("club_id")
        .eq("device_id", op.deviceId);
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
        const points = Math.max(prev, op.points);
        await db.from("club_league_weeks").upsert(
          {
            club_id: m.club_id,
            week_start: weekStart,
            device_id: op.deviceId,
            points,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "club_id,week_start,device_id" },
        );
      }
      return { ok: true };
    }
    case "ensureFriendQuest": {
      const identity = await assertDevice(op.deviceId);
      const partnerIdentity = await resolveTrustedIdentity({
        deviceId: op.partnerDeviceId,
        requireAccess: false,
      });
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
          ...(partnerIdentity?.userId ? { user_id_b: partnerIdentity.userId } : {}),
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
      await assertDevice(op.deviceId);
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
      return { ok: true };
    }
    case "publishClubStory": {
      await assertDevice(op.deviceId);
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
      const { error } = await db.from("hub_members").upsert(
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
      const { linkAuthUserId } = await import("@/lib/identity");
      await linkAuthUserId({ userId: identity.userId, authUserId: op.authUserId });
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
      const { error } = await db.from("social_follows").upsert(
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
      const { error } = await db.from("social_blocks").upsert(
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
      const { error } = await db.from("social_mutes").upsert(
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
      const { error } = await db.from("activity_reactions").upsert(
        { event_id: op.eventId, user_id: identity.userId, kind: op.kind },
        { onConflict: "event_id,user_id" },
      );
      if (error) throw error;
      if (op.kind === "fire") {
        await db.from("activity_kudos").upsert(
          { event_id: op.eventId, device_id: op.deviceId },
          { onConflict: "event_id,device_id" },
        );
      }
      const { data: reacts } = await db
        .from("activity_reactions")
        .select("kind")
        .eq("event_id", op.eventId);
      const fireCount = ((reacts ?? []) as Array<{ kind: string }>).filter((r) => r.kind === "fire").length;
      await db.from("activity_events").update({ kudos_count: fireCount }).eq("id", op.eventId);
      try {
        const { data: ev } = await db
          .from("activity_events")
          .select("user_id, device_id")
          .eq("id", op.eventId)
          .maybeSingle();
        let targetUserId = (ev?.user_id as string | null) ?? null;
        if (!targetUserId && ev?.device_id) {
          const { getUserIdForDevice } = await import("@/lib/identity");
          targetUserId = await getUserIdForDevice(String(ev.device_id));
        }
        if (targetUserId && targetUserId !== identity.userId) {
          const { notifyUserPush } = await import("@/lib/push.server");
          await notifyUserPush({
            userId: targetUserId,
            category: "kudos",
            title: "Reação",
            body: "Alguém reagiu ao seu check-in.",
            respectQuietHours: false,
          });
        }
      } catch {
        /* best-effort */
      }
      return { ok: true, kind: op.kind };
    }
    case "comment": {
      const identity = await assertDevice(op.deviceId);
      const body = sanitizeCommentBody(op.body);
      if (!body) throw new Error("Comentário vazio");
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
      if (!invite || String(invite.to_user_id) !== identity.userId) throw new Error("Convite inválido");
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
