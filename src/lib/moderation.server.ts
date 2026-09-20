/**
 * Social moderation queue (reports + hide activity events / comments).
 */
import { adminDbLoose } from "@/lib/db-admin";
import { ADMIN_ACTOR, writeAudit } from "@/lib/admin.server";

export type ReportTargetKind = "activity_event" | "comment" | "user";

export type ContentReportRow = {
  id: string;
  reporterUserId: string | null;
  targetKind: string;
  targetId: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  eventPreview: string | null;
  authorUserId: string | null;
  authorDeviceId: string | null;
  hiddenAt: string | null;
};

function isTargetKind(value: unknown): value is ReportTargetKind {
  return value === "activity_event" || value === "comment" || value === "user";
}

export async function listOpenReports(): Promise<ContentReportRow[]> {
  const db = await adminDbLoose();
  if (!db) return [];
  const { data } = await db
    .from("content_reports")
    .select("id, reporter_user_id, target_kind, target_id, reason, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(80);

  const rows = (data ?? []) as Array<{
    id: string;
    reporter_user_id: string | null;
    target_kind: string;
    target_id: string;
    reason: string;
    status: string;
    created_at: string;
  }>;

  const eventIds = rows.filter((r) => r.target_kind === "activity_event").map((r) => r.target_id);
  const commentIds = rows.filter((r) => r.target_kind === "comment").map((r) => r.target_id);
  const userIds = rows.filter((r) => r.target_kind === "user").map((r) => r.target_id);

  const eventsById = new Map<
    string,
    { preview: string; userId: string | null; deviceId: string; hiddenAt: string | null }
  >();
  if (eventIds.length) {
    const { data: events } = await db
      .from("activity_events")
      .select("id, display_name, kind, payload, user_id, device_id, hidden_at")
      .in("id", eventIds);
    for (const e of (events ?? []) as Array<Record<string, unknown>>) {
      const title =
        e["payload"] && typeof e["payload"] === "object" && "title" in (e["payload"] as object)
          ? String((e["payload"] as { title?: unknown }).title ?? "")
          : "";
      eventsById.set(String(e["id"]), {
        preview: `${String(e["display_name"] ?? "")} · ${String(e["kind"] ?? "")}${title ? ` · ${title}` : ""}`,
        userId: (e["user_id"] as string | null) ?? null,
        deviceId: String(e["device_id"] ?? ""),
        hiddenAt: (e["hidden_at"] as string | null) ?? null,
      });
    }
  }

  const commentsById = new Map<
    string,
    { preview: string; userId: string | null; hiddenAt: string | null }
  >();
  if (commentIds.length) {
    const { data: comments } = await db
      .from("activity_comments")
      .select("id, user_id, body, hidden_at")
      .in("id", commentIds);
    for (const c of (comments ?? []) as Array<Record<string, unknown>>) {
      commentsById.set(String(c["id"]), {
        preview: `comentário · ${String(c["body"] ?? "").slice(0, 80)}`,
        userId: (c["user_id"] as string | null) ?? null,
        hiddenAt: (c["hidden_at"] as string | null) ?? null,
      });
    }
  }

  const usersById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await db
      .from("social_profiles")
      .select("app_user_id, display_name")
      .in("app_user_id", userIds);
    for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
      usersById.set(String(p["app_user_id"]), String(p["display_name"] ?? "Soldado"));
    }
  }

  return rows.map((r) => {
    if (r.target_kind === "comment") {
      const c = commentsById.get(r.target_id);
      return {
        id: r.id,
        reporterUserId: r.reporter_user_id,
        targetKind: r.target_kind,
        targetId: r.target_id,
        reason: r.reason,
        status: r.status as ContentReportRow["status"],
        createdAt: r.created_at,
        eventPreview: c?.preview ?? `comentário ${r.target_id.slice(0, 8)}`,
        authorUserId: c?.userId ?? null,
        authorDeviceId: null,
        hiddenAt: c?.hiddenAt ?? null,
      };
    }
    if (r.target_kind === "user") {
      return {
        id: r.id,
        reporterUserId: r.reporter_user_id,
        targetKind: r.target_kind,
        targetId: r.target_id,
        reason: r.reason,
        status: r.status as ContentReportRow["status"],
        createdAt: r.created_at,
        eventPreview: `perfil · ${usersById.get(r.target_id) ?? r.target_id.slice(0, 8)}`,
        authorUserId: r.target_id,
        authorDeviceId: null,
        hiddenAt: null,
      };
    }
    const ev = eventsById.get(r.target_id);
    return {
      id: r.id,
      reporterUserId: r.reporter_user_id,
      targetKind: r.target_kind,
      targetId: r.target_id,
      reason: r.reason,
      status: r.status as ContentReportRow["status"],
      createdAt: r.created_at,
      eventPreview: ev?.preview ?? null,
      authorUserId: ev?.userId ?? null,
      authorDeviceId: ev?.deviceId ?? null,
      hiddenAt: ev?.hiddenAt ?? null,
    };
  });
}

export async function hideActivityEvent(
  eventId: string,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const { error } = await db
    .from("activity_events")
    .update({ hidden_at: new Date().toISOString(), hidden_by: actor })
    .eq("id", eventId);
  if (error) {
    console.error("hide activity failed", error);
    return { ok: false, reason: "update_failed" };
  }
  await writeAudit("activity_hide", { eventId }, actor);
  return { ok: true };
}

export async function unhideActivityEvent(
  eventId: string,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const { error } = await db
    .from("activity_events")
    .update({ hidden_at: null, hidden_by: null })
    .eq("id", eventId);
  if (error) return { ok: false, reason: "update_failed" };
  await writeAudit("activity_unhide", { eventId }, actor);
  return { ok: true };
}

export async function hideComment(
  commentId: string,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const { error } = await db
    .from("activity_comments")
    .update({ hidden_at: new Date().toISOString(), hidden_by: actor })
    .eq("id", commentId);
  if (error) {
    console.error("hide comment failed", error);
    return { ok: false, reason: "update_failed" };
  }
  await writeAudit("comment_hide", { commentId }, actor);
  return { ok: true };
}

export async function unhideComment(
  commentId: string,
  actor: string = ADMIN_ACTOR,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const { error } = await db
    .from("activity_comments")
    .update({ hidden_at: null, hidden_by: null })
    .eq("id", commentId);
  if (error) return { ok: false, reason: "update_failed" };
  await writeAudit("comment_unhide", { commentId }, actor);
  return { ok: true };
}

export async function resolveReport(opts: {
  reportId: string;
  status: "resolved" | "dismissed";
  hideEvent?: boolean;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const { data: report } = await db
    .from("content_reports")
    .select("id, target_kind, target_id")
    .eq("id", opts.reportId)
    .maybeSingle();
  if (!report) return { ok: false, reason: "not_found" };

  if (opts.hideEvent && report.target_kind === "activity_event") {
    await hideActivityEvent(String(report.target_id));
  }
  if (opts.hideEvent && report.target_kind === "comment") {
    await hideComment(String(report.target_id));
  }

  const { error } = await db
    .from("content_reports")
    .update({
      status: opts.status,
      resolved_at: new Date().toISOString(),
      resolved_by: ADMIN_ACTOR,
    })
    .eq("id", opts.reportId);
  if (error) return { ok: false, reason: "update_failed" };
  await writeAudit("content_report_resolve", {
    reportId: opts.reportId,
    status: opts.status,
    hideEvent: Boolean(opts.hideEvent),
    targetKind: report.target_kind,
  });
  return { ok: true };
}

export async function insertContentReport(opts: {
  reporterUserId: string;
  targetId: string;
  reason: string;
  targetKind?: ReportTargetKind;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false, reason: "db_unavailable" };
  const targetKind = isTargetKind(opts.targetKind) ? opts.targetKind : "activity_event";
  const { error } = await db.from("content_reports").insert({
    reporter_user_id: opts.reporterUserId,
    target_kind: targetKind,
    target_id: opts.targetId,
    reason: opts.reason.slice(0, 80) || "other",
    status: "open",
  });
  if (error) {
    console.error("content_reports insert failed", error);
    return { ok: false, reason: "insert_failed" };
  }
  return { ok: true };
}
