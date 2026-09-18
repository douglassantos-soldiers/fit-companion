/**
 * Social/engagement mutations via service_role after RLS harden.
 * Client must not INSERT/UPDATE/DELETE social tables with anon key.
 */
import { adminDbLoose } from "@/lib/db-admin";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import { challengeById, isRelativeChallenge } from "@/data/challenges";

export type SocialWriteOp =
  | { op: "ensureProfile"; deviceId: string; displayName: string }
  | {
      op: "joinChallenge";
      deviceId: string;
      challengeId: string;
      displayName: string;
      baseline?: number;
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
    };

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
      if (c && isRelativeChallenge(c) && op.baseline !== undefined) {
        const { error: progErr } = await db.from("challenge_progress").upsert(
          {
            device_id: op.deviceId,
            user_id: identity.userId,
            challenge_id: op.challengeId,
            value: op.baseline,
            baseline_value: op.baseline,
            pct_value: 0,
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
        },
      });
      try {
        const { trackUserEvent } = await import("@/lib/events/track");
        await trackUserEvent({
          deviceId: op.deviceId,
          userId: identity.userId,
          eventType: "challenge_joined",
          source: "social",
          entityType: "challenge",
          entityId: op.challengeId,
          metadata: { challengeId: op.challengeId },
          idempotencyKey: `challenge:${op.challengeId}:challenge_joined`,
        });
      } catch {
        /* best-effort */
      }
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
      const baseline = op.baseline ?? 0;
      const pct =
        op.pct ?? (relative ? ((op.value - baseline) / Math.max(baseline, 1)) * 100 : null);
      const { error } = await db.from("challenge_progress").upsert(
        {
          device_id: op.deviceId,
          user_id: identity.userId,
          challenge_id: op.challengeId,
          value: op.value,
          baseline_value: baseline,
          pct_value: pct,
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
          },
        });
        try {
          const { trackUserEvent } = await import("@/lib/events/track");
          await trackUserEvent({
            deviceId: op.deviceId,
            userId: identity.userId,
            eventType: "challenge_completed",
            source: "social",
            entityType: "challenge",
            entityId: op.challengeId,
            metadata: { challengeId: op.challengeId, value: op.value },
            idempotencyKey: `challenge:${op.challengeId}:challenge_completed`,
          });
        } catch {
          /* best-effort */
        }
      }
      return { ok: true, done };
    }
    case "createClub": {
      await assertDevice(op.deviceId);
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
      await db.from("club_members").insert({ club_id: data.id, device_id: op.deviceId });
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
      await assertDevice(op.deviceId);
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
        .upsert({ club_id: club.id, device_id: op.deviceId }, { onConflict: "club_id,device_id" });
      return { ok: true, clubId: club.id };
    }
    case "publishEvent": {
      await assertDevice(op.deviceId);
      const { error } = await db.from("activity_events").insert({
        device_id: op.deviceId,
        display_name: op.displayName || "Soldado",
        kind: op.kind,
        payload: op.payload ?? {},
      });
      if (error) console.error("publishEvent failed", error);
      return { ok: !error };
    }
    case "giveKudos": {
      await assertDevice(op.deviceId);
      const { error: insertErr } = await db.from("activity_kudos").insert({
        event_id: op.eventId,
        device_id: op.deviceId,
      });
      if (insertErr && insertErr.code !== "23505" && !String(insertErr.message || "").includes("duplicate")) {
        throw insertErr;
      }
      if (insertErr && (insertErr.code === "23505" || String(insertErr.message || "").includes("duplicate"))) {
        throw new Error("Você já reagiu a este check-in");
      }
      const { error } = await db
        .from("activity_events")
        .update({ kudos_count: op.current + 1 })
        .eq("id", op.eventId);
      if (error) throw error;
      return { ok: true };
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
      await assertDevice(op.deviceId);
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
      await assertDevice(op.deviceId);
      const { error } = await db.from("hub_members").upsert(
        { hub_id: op.hubId, device_id: op.deviceId },
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
    default:
      throw new Error("op inválida");
  }
}
