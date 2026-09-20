import { createServerFn } from "@tanstack/react-start";

function parseDevice(input: unknown) {
  const v = input as { deviceId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId };
}

export const getForYouFeedFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const base = parseDevice(input);
    const raw = input as { limit?: number; goal?: string | null; level?: string | null } | null;
    const limit = Number(raw?.limit ?? 30);
    const goal = raw?.goal != null ? String(raw.goal).trim() || null : null;
    const level = raw?.level != null ? String(raw.level).trim() || null : null;
    return {
      ...base,
      limit: Number.isFinite(limit) ? Math.min(50, Math.max(1, limit)) : 30,
      goal,
      level,
    };
  })
  .handler(async ({ data }) => {
    const { getForYouFeedServer } = await import("@/lib/social/graph.server");
    return getForYouFeedServer(data.deviceId, data.limit, { goal: data.goal, level: data.level });
  });

export const getSocialProfileFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const base = parseDevice(input);
    const userId = String((input as { userId?: string } | null)?.userId ?? "").trim();
    if (!userId) throw new Error("userId obrigatório");
    return { ...base, userId };
  })
  .handler(async ({ data }) => {
    const { getSocialProfileServer } = await import("@/lib/social/graph.server");
    return getSocialProfileServer(data.deviceId, data.userId);
  });

export const listFollowsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const base = parseDevice(input);
    const v = input as { userId?: string; dir?: string } | null;
    const userId = String(v?.userId ?? "").trim();
    if (!userId) throw new Error("userId obrigatório");
    const dir = v?.dir === "followers" ? ("followers" as const) : ("following" as const);
    return { ...base, userId, dir };
  })
  .handler(async ({ data }) => {
    const { listFollowsServer } = await import("@/lib/social/graph.server");
    return listFollowsServer(data.deviceId, data.userId, data.dir);
  });

export const listFollowingForInviteFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { listFollowingForInviteServer } = await import("@/lib/social/graph.server");
    return listFollowingForInviteServer(data.deviceId);
  });

export const listEventCommentsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const base = parseDevice(input);
    const eventId = String((input as { eventId?: string } | null)?.eventId ?? "").trim();
    if (!eventId) throw new Error("eventId obrigatório");
    return { ...base, eventId };
  })
  .handler(async ({ data }) => {
    const { listEventCommentsServer } = await import("@/lib/social/graph.server");
    return listEventCommentsServer(data.deviceId, data.eventId);
  });

export const listPendingInvitesFn = createServerFn({ method: "POST" })
  .inputValidator(parseDevice)
  .handler(async ({ data }) => {
    const { listPendingInvitesServer } = await import("@/lib/social/graph.server");
    return listPendingInvitesServer(data.deviceId);
  });
