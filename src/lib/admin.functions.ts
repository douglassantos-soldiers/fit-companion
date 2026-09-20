/**
 * Admin Console server functions (PIN session required for mutations + admin reads).
 */
import { createServerFn } from "@tanstack/react-start";
import type { CmsState } from "@/lib/cms";
import type { AccessTier } from "@/data/shopify-product-map";

function parseCmsState(input: unknown): CmsState {
  const raw = (input as { cms?: CmsState } | null)?.cms;
  if (!raw || typeof raw !== "object") throw new Error("CMS inválido");
  return {
    exerciseMedia: { ...(raw.exerciseMedia ?? {}) },
    mealImages: { ...(raw.mealImages ?? {}) },
    workoutNotes: { ...(raw.workoutNotes ?? {}) },
  };
}

function parseEmail(input: unknown): { email: string } {
  const email = String((input as { email?: string } | null)?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  return { email };
}

function parseEntitlementManual(input: unknown): {
  email: string;
  action: "grant" | "revoke";
  tier: AccessTier;
} {
  const raw = input as { email?: string; action?: string; tier?: string } | null;
  const email = String(raw?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  const action = raw?.action === "revoke" ? "revoke" : "grant";
  const tier: AccessTier = raw?.tier === "performance" ? "performance" : "base";
  return { email, action, tier };
}

/** Public read — app hydrate (service_role via server). */
export const getPublicCms = createServerFn({ method: "GET" }).handler(async () => {
  const { readCmsOverrides } = await import("@/lib/admin.server");
  return await readCmsOverrides();
});

export const loadCmsRemote = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin, readCmsOverrides } = await import("@/lib/admin.server");
  assertAdmin();
  return await readCmsOverrides();
});

export const saveCmsRemote = createServerFn({ method: "POST" })
  .inputValidator(parseCmsState)
  .handler(async ({ data }) => {
    const { assertAdmin, readCmsOverrides, upsertCmsOverrides } = await import(
      "@/lib/admin.server"
    );
    assertAdmin();
    const result = await upsertCmsOverrides(data);
    if (!result.ok) return { ok: false as const, reason: result.reason };
    const next = await readCmsOverrides();
    return { ok: true as const, count: result.count, cms: next };
  });

export const lookupUserByEmail = createServerFn({ method: "POST" })
  .inputValidator(parseEmail)
  .handler(async ({ data }) => {
    const { assertAdmin, lookupUserByEmail: lookup } = await import("@/lib/admin.server");
    assertAdmin();
    return await lookup(data.email);
  });

export const resyncEntitlement = createServerFn({ method: "POST" })
  .inputValidator(parseEmail)
  .handler(async ({ data }) => {
    const { assertAdmin, resyncEntitlementForEmail } = await import("@/lib/admin.server");
    assertAdmin();
    return await resyncEntitlementForEmail(data.email);
  });

export const setEntitlementManual = createServerFn({ method: "POST" })
  .inputValidator(parseEntitlementManual)
  .handler(async ({ data }) => {
    const { assertAdmin, setEntitlementManual: setManual } = await import("@/lib/admin.server");
    assertAdmin();
    return await setManual({
      email: data.email,
      action: data.action,
      tier: data.tier,
    });
  });

export const listShopifyOps = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin, listShopifyOps: listOps } = await import("@/lib/admin.server");
  assertAdmin();
  return await listOps(40);
});

export const importShopifyCustomersBatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ({
    reset: (input as { reset?: boolean } | null)?.reset === true,
  }))
  .handler(async ({ data }) => {
    const { assertAdmin, importShopifyCustomersBatch: runBatch } = await import(
      "@/lib/admin.server"
    );
    assertAdmin();
    return await runBatch({ reset: data.reset });
  });

export const loadProductAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("@/lib/admin.server");
  assertAdmin();
  const { loadProductAnalyticsServer } = await import("@/lib/analytics.server");
  return loadProductAnalyticsServer();
});

/** Public catalog hydrate (service_role). Wire as JSON string (serializable). */
export const getPublicCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { loadPublicCatalogServer } = await import("@/lib/catalog.server");
  const c = await loadPublicCatalogServer();
  return { json: JSON.stringify(c) };
});

function parseUserStatus(input: unknown): {
  email: string;
  status: "active" | "suspended" | "banned";
  statusUntil?: string | null;
  reason?: string | null;
} {
  const raw = input as {
    email?: string;
    status?: string;
    statusUntil?: string | null;
    reason?: string | null;
  } | null;
  const email = String(raw?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido");
  const status =
    raw?.status === "suspended" || raw?.status === "banned" || raw?.status === "active"
      ? raw.status
      : "active";
  return {
    email,
    status,
    statusUntil: raw?.statusUntil ?? null,
    reason: raw?.reason ?? null,
  };
}

export const setUserStatus = createServerFn({ method: "POST" })
  .inputValidator(parseUserStatus)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { setUserAccountStatus } = await import("@/lib/account-status.server");
    return await setUserAccountStatus(data);
  });

export const listAdminExercises = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("@/lib/admin.server");
  assertAdmin();
  const { listMergedExercisesAdmin } = await import("@/lib/catalog.server");
  return await listMergedExercisesAdmin();
});

function parseExerciseSave(input: unknown) {
  const raw = input as Record<string, unknown> | null;
  const id = String(raw?.["id"] ?? "").trim();
  const name = String(raw?.["name"] ?? "").trim();
  if (!id || !name) throw new Error("Exercício inválido");
  const parsed: import("@/lib/catalog.server").ExerciseSaveInput = {
    id,
    name,
    group: String(raw?.["group"] ?? "peito") as import("@/data/exercises").MuscleGroup,
    equipment: (raw?.["equipment"] === "casa" || raw?.["equipment"] === "academia"
      ? raw["equipment"]
      : "ambos") as import("@/data/exercises").Exercise["equipment"],
    swapGroup: String(raw?.["swapGroup"] ?? ""),
    joints: (Array.isArray(raw?.["joints"]) ? raw!["joints"] : []) as import("@/data/exercises").Joint[],
    unit: (raw?.["unit"] === "corpo" || raw?.["unit"] === "min" ? raw["unit"] : "kg") as
      | "kg"
      | "corpo"
      | "min",
    baseLoad: Number(raw?.["baseLoad"] ?? 20),
    priority: Number(raw?.["priority"] ?? 2),
    primaryMuscles: (Array.isArray(raw?.["primaryMuscles"])
      ? raw!["primaryMuscles"]
      : []) as import("@/data/exercises").MuscleGroup[],
    secondaryMuscles: (Array.isArray(raw?.["secondaryMuscles"])
      ? raw!["secondaryMuscles"]
      : []) as import("@/data/exercises").MuscleGroup[],
    plannerEligible: raw?.["plannerEligible"] !== false,
    active: raw?.["active"] !== false,
    instructions: Array.isArray(raw?.["instructions"])
      ? (raw!["instructions"] as unknown[]).map(String)
      : [],
    videoUrl: raw?.["videoUrl"] != null ? String(raw["videoUrl"]) : null,
    mediaUrl: raw?.["mediaUrl"] != null ? String(raw["mediaUrl"]) : null,
    cues: raw?.["cues"] != null ? String(raw["cues"]) : null,
    alternativeIds: Array.isArray(raw?.["alternativeIds"])
      ? (raw!["alternativeIds"] as unknown[]).map(String)
      : [],
  };
  if (raw?.["movementPattern"] != null) parsed.movementPattern = String(raw["movementPattern"]);
  if (raw?.["difficulty"] != null) parsed.difficulty = String(raw["difficulty"]);
  return parsed;
}

export const saveAdminExercise = createServerFn({ method: "POST" })
  .inputValidator(parseExerciseSave)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { upsertCatalogExercise } = await import("@/lib/catalog.server");
    return await upsertCatalogExercise(data);
  });

export const listAdminChallenges = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("@/lib/admin.server");
  assertAdmin();
  const { listMergedChallengesAdmin } = await import("@/lib/catalog.server");
  return await listMergedChallengesAdmin();
});

function parseChallengeSave(input: unknown) {
  const raw = input as Record<string, unknown> | null;
  const id = String(raw?.["id"] ?? "").trim();
  const title = String(raw?.["title"] ?? "").trim();
  if (!id || !title) throw new Error("Desafio inválido");
  return {
    id,
    title,
    description: String(raw?.["description"] ?? ""),
    category: String(raw?.["category"] ?? "consistency"),
    metric: String(raw?.["metric"] ?? "sessoes"),
    target: Number(raw?.["target"] ?? 1),
    unit: String(raw?.["unit"] ?? "treinos"),
    durationDays: Number(raw?.["durationDays"] ?? 7),
    rankingMode: String(raw?.["rankingMode"] ?? "absolute"),
    reward: raw?.["reward"] != null ? String(raw["reward"]) : null,
    active: raw?.["active"] !== false,
    startsAt: raw?.["startsAt"] != null ? String(raw["startsAt"]) : null,
    endsAt: raw?.["endsAt"] != null ? String(raw["endsAt"]) : null,
    requiresPerformance: Boolean(raw?.["requiresPerformance"]),
    targetPct: raw?.["targetPct"] != null ? Number(raw["targetPct"]) : null,
    personalTargetMin: raw?.["personalTargetMin"] != null ? Number(raw["personalTargetMin"]) : null,
    personalTargetMax: raw?.["personalTargetMax"] != null ? Number(raw["personalTargetMax"]) : null,
    personalTargetFactor:
      raw?.["personalTargetFactor"] != null ? Number(raw["personalTargetFactor"]) : null,
    personalTargetOffset:
      raw?.["personalTargetOffset"] != null ? Number(raw["personalTargetOffset"]) : null,
  };
}

export const saveAdminChallenge = createServerFn({ method: "POST" })
  .inputValidator(parseChallengeSave)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { upsertCatalogChallenge } = await import("@/lib/catalog.server");
    return await upsertCatalogChallenge(data);
  });

export const loadAdminTrainingRules = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("@/lib/admin.server");
  assertAdmin();
  const { loadTrainingRulesAdmin } = await import("@/lib/catalog.server");
  return await loadTrainingRulesAdmin();
});

export const saveAdminTrainingRules = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as import("@/lib/training/training-rules").TrainingRules)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { saveTrainingRulesAdmin } = await import("@/lib/catalog.server");
    return await saveTrainingRulesAdmin(data);
  });

export const listAdminContent = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("@/lib/admin.server");
  assertAdmin();
  const { listContentItemsAdmin } = await import("@/lib/catalog.server");
  return await listContentItemsAdmin();
});

function parseContentSave(input: unknown) {
  const raw = input as Record<string, unknown> | null;
  const title = String(raw?.["title"] ?? "").trim();
  if (!title) throw new Error("Título obrigatório");
  const kinds = ["article", "tip", "technique", "nutrition", "recovery", "motivation"] as const;
  const kind = kinds.includes(raw?.["kind"] as (typeof kinds)[number])
    ? (raw!["kind"] as (typeof kinds)[number])
    : "tip";
  const parsed: {
    id?: string;
    kind: (typeof kinds)[number];
    title: string;
    body: string;
    mediaUrl: string | null;
    goals: string[];
    levels: string[];
    published: boolean;
    sortOrder: number;
  } = {
    kind,
    title,
    body: String(raw?.["body"] ?? ""),
    mediaUrl: raw?.["mediaUrl"] != null ? String(raw["mediaUrl"]) : null,
    goals: Array.isArray(raw?.["goals"]) ? (raw!["goals"] as unknown[]).map(String) : [],
    levels: Array.isArray(raw?.["levels"]) ? (raw!["levels"] as unknown[]).map(String) : [],
    published: Boolean(raw?.["published"]),
    sortOrder: Number(raw?.["sortOrder"] ?? 0),
  };
  if (raw?.["id"]) parsed.id = String(raw["id"]);
  return parsed;
}

export const saveAdminContent = createServerFn({ method: "POST" })
  .inputValidator(parseContentSave)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { upsertContentItem } = await import("@/lib/catalog.server");
    return await upsertContentItem(data);
  });

export const deleteAdminContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const id = String((input as { id?: string } | null)?.id ?? "").trim();
    if (!id) throw new Error("id obrigatório");
    return { id };
  })
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { deleteContentItem } = await import("@/lib/catalog.server");
    return await deleteContentItem(data.id);
  });

export const listAdminReports = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("@/lib/admin.server");
  assertAdmin();
  const { listOpenReports } = await import("@/lib/moderation.server");
  return await listOpenReports();
});

function parseReportResolve(input: unknown) {
  const raw = input as { reportId?: string; status?: string; hideEvent?: boolean } | null;
  const reportId = String(raw?.reportId ?? "").trim();
  if (!reportId) throw new Error("reportId obrigatório");
  return {
    reportId,
    status: raw?.status === "dismissed" ? ("dismissed" as const) : ("resolved" as const),
    hideEvent: Boolean(raw?.hideEvent),
  };
}

export const resolveAdminReport = createServerFn({ method: "POST" })
  .inputValidator(parseReportResolve)
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { resolveReport } = await import("@/lib/moderation.server");
    return await resolveReport(data);
  });

export const hideAdminActivity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const eventId = String((input as { eventId?: string } | null)?.eventId ?? "").trim();
    if (!eventId) throw new Error("eventId obrigatório");
    return { eventId };
  })
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { hideActivityEvent } = await import("@/lib/moderation.server");
    return await hideActivityEvent(data.eventId);
  });

export const hideAdminComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const commentId = String((input as { commentId?: string } | null)?.commentId ?? "").trim();
    if (!commentId) throw new Error("commentId obrigatório");
    return { commentId };
  })
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    assertAdmin();
    const { hideComment } = await import("@/lib/moderation.server");
    return await hideComment(data.commentId);
  });
