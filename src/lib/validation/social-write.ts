import { z } from "zod";
import {
  DeviceIdSchema,
  DisplayNameSchema,
  IsoDateSchema,
  UuidLikeSchema,
  sanitizePlainText,
} from "@/lib/validation/common";
import type { SocialWriteOp } from "@/lib/social-write.server";

const ActivityKindSchema = z.enum([
  "session",
  "badge",
  "challenge_join",
  "challenge_complete",
  "xp_goal",
  "league_rank",
  "friend_quest_complete",
  "freeze_used",
  "proof",
  "user_followed",
  "challenge_invite",
  "editorial",
]);

const ReactionKindSchema = z.enum(["fire", "muscle", "clap", "trophy", "heart"]);

const PrivacyLevelSchema = z.enum(["public", "friends", "private"]);

const cappedPayload = z
  .record(z.unknown())
  .optional()
  .transform((p) => {
    if (!p) return undefined;
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(p)) {
      if (n >= 40) break;
      const key = String(k).slice(0, 64);
      if (typeof v === "string") out[key] = v.slice(0, 2000);
      else if (typeof v === "number" || typeof v === "boolean" || v == null) out[key] = v;
      else if (Array.isArray(v)) out[key] = v.slice(0, 50);
      else if (typeof v === "object") out[key] = v;
      n += 1;
    }
    return out;
  });

const baseDevice = { deviceId: DeviceIdSchema };
const withName = { ...baseDevice, displayName: DisplayNameSchema };

export const SocialWriteOpSchema: z.ZodType<SocialWriteOp> = z.discriminatedUnion("op", [
  z.object({ op: z.literal("ensureProfile"), ...withName }),
  z.object({
    op: z.literal("joinChallenge"),
    ...withName,
    challengeId: UuidLikeSchema,
    baseline: z.number().finite().min(0).max(1_000_000).optional(),
    personalTarget: z.number().finite().min(0).max(1_000_000).optional(),
  }),
  z.object({
    op: z.literal("leaveChallenge"),
    ...baseDevice,
    challengeId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("syncChallengeProgress"),
    ...withName,
    challengeId: UuidLikeSchema,
    value: z.number().finite().min(0).max(1_000_000),
    baseline: z.number().finite().min(0).max(1_000_000).optional(),
    personalTarget: z.number().finite().min(0).max(1_000_000).optional(),
    pct: z.number().finite().optional(),
    complete: z.boolean().optional(),
    fraudFlags: z.array(z.unknown()).max(20).optional(),
    proofStatus: z.string().max(40).optional(),
    proofSource: z.string().max(40).optional(),
  }),
  z.object({
    op: z.literal("createClub"),
    ...withName,
    name: z
      .string()
      .trim()
      .max(80)
      .transform((s) => sanitizePlainText(s, 80) || "Clube Soldiers"),
  }),
  z.object({
    op: z.literal("joinClub"),
    ...withName,
    code: z.string().trim().min(4).max(12),
  }),
  z.object({
    op: z.literal("publishEvent"),
    ...withName,
    kind: ActivityKindSchema,
    payload: cappedPayload,
  }),
  z.object({
    op: z.literal("giveKudos"),
    ...baseDevice,
    eventId: UuidLikeSchema,
    current: z.number().finite().min(0).max(1_000_000),
  }),
  z.object({
    op: z.literal("syncLeague"),
    ...withName,
    points: z.number().finite().optional(),
  }),
  z.object({
    op: z.literal("ensureFriendQuest"),
    ...withName,
    clubId: UuidLikeSchema,
    weekStart: IsoDateSchema,
    partnerDeviceId: DeviceIdSchema,
  }),
  z.object({
    op: z.literal("bumpFriendQuest"),
    ...baseDevice,
    weekStart: IsoDateSchema,
  }),
  z.object({
    op: z.literal("publishClubStory"),
    ...baseDevice,
    clubId: UuidLikeSchema,
    imageUrl: z.string().url().max(2000),
  }),
  z.object({ op: z.literal("hubJoin"), ...baseDevice, hubId: UuidLikeSchema }),
  z.object({ op: z.literal("hubLeave"), ...baseDevice, hubId: UuidLikeSchema }),
  z.object({
    op: z.literal("linkAuthSocial"),
    ...withName,
    authUserId: z.string().max(128).optional(),
  }),
  z.object({
    op: z.literal("reportEvent"),
    ...baseDevice,
    eventId: UuidLikeSchema,
    reason: z.string().trim().max(200),
  }),
  z.object({
    op: z.literal("follow"),
    ...withName,
    targetUserId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("unfollow"),
    ...baseDevice,
    targetUserId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("block"),
    ...baseDevice,
    targetUserId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("unblock"),
    ...baseDevice,
    targetUserId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("mute"),
    ...baseDevice,
    targetUserId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("unmute"),
    ...baseDevice,
    targetUserId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("react"),
    ...baseDevice,
    eventId: UuidLikeSchema,
    kind: ReactionKindSchema,
  }),
  z.object({
    op: z.literal("comment"),
    ...baseDevice,
    eventId: UuidLikeSchema,
    body: z.string().max(500),
  }),
  z.object({
    op: z.literal("dismissFeed"),
    ...baseDevice,
    authorUserId: UuidLikeSchema.optional(),
    kind: z.string().trim().min(1).max(64),
    contentId: UuidLikeSchema.optional(),
  }),
  z.object({
    op: z.literal("markSeen"),
    ...baseDevice,
    eventId: UuidLikeSchema.optional(),
    contentId: UuidLikeSchema.optional(),
  }),
  z.object({
    op: z.literal("inviteChallenge"),
    ...withName,
    challengeId: UuidLikeSchema,
    toUserId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("acceptInvite"),
    ...withName,
    inviteId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("declineInvite"),
    ...baseDevice,
    inviteId: UuidLikeSchema,
  }),
  z.object({
    op: z.literal("reportContent"),
    ...baseDevice,
    targetKind: z.enum(["activity_event", "comment", "user"]),
    targetId: UuidLikeSchema,
    reason: z.string().trim().max(200),
  }),
  z.object({
    op: z.literal("savePrivacy"),
    ...baseDevice,
    privacy: z.record(PrivacyLevelSchema).or(z.record(z.string())),
  }),
  z.object({
    op: z.literal("enrollProgram"),
    ...baseDevice,
    programId: UuidLikeSchema,
  }),
]);

export function parseSocialWriteOp(input: unknown): SocialWriteOp {
  const parsed = SocialWriteOpSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "op inválida";
    throw new Error(msg);
  }
  return parsed.data;
}
