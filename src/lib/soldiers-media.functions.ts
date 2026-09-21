/**
 * Soldiers media server functions.
 * Public: published packages only (RLS).
 * Admin: list all + status transitions (service_role + assertAdmin).
 */
import { createServerFn } from "@tanstack/react-start";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  canTransitionStatus,
  isProductionPackage,
  projectCatalogMediaStatus,
  validateMediaPackage,
} from "@/lib/soldiers-media-governance";
import {
  MEDIA_REGION_GLOBAL,
  MEDIA_VARIANT_DEFAULT,
  isSoldiersMediaKind,
  isSoldiersMediaStatus,
  normalizeMediaStatus,
  type AnimationSpec,
  type MediaChecksums,
  type SoldiersMediaAsset,
  type SoldiersMediaKind,
  type SoldiersMediaStatus,
} from "@/lib/soldiers-media-types";

type SoldiersMediaRow = Database["public"]["Tables"]["soldiers_media"]["Row"];

function asChecksums(raw: Json | null): MediaChecksums | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: MediaChecksums = {};
  if (typeof o["poster"] === "string") out.poster = o["poster"];
  if (typeof o["thumbnail"] === "string") out.thumbnail = o["thumbnail"];
  if (typeof o["webm"] === "string") out.webm = o["webm"];
  if (typeof o["mp4"] === "string") out.mp4 = o["mp4"];
  if (typeof o["gif"] === "string") out.gif = o["gif"];
  return Object.keys(out).length ? out : undefined;
}

function asAnimationSpec(raw: Json | null): AnimationSpec | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const tempo = o["tempo"];
  const camera = o["camera"];
  if (typeof o["start"] !== "string" || typeof o["end"] !== "string") return undefined;
  if (tempo !== "controlled" && tempo !== "explosive" && tempo !== "hold") return undefined;
  if (camera !== "three-quarter" && camera !== "side" && camera !== "front") return undefined;
  return {
    start: o["start"],
    end: o["end"],
    tempo,
    durationSec: Number(o["durationSec"] ?? 4) || 4,
    loop: o["loop"] !== false,
    camera,
  };
}

export function mapSoldiersMediaRow(row: SoldiersMediaRow): SoldiersMediaAsset | null {
  if (!isSoldiersMediaKind(row.kind)) return null;
  const pack: SoldiersMediaAsset = {
    kind: row.kind,
    entityId: row.entity_id,
    version: row.version,
    style: row.style,
    source: "soldiers",
    ownership: "owned",
    license: "soldiers-owned",
    needsMotion: row.needs_motion,
    status: normalizeMediaStatus(row.status),
    variant: row.variant || MEDIA_VARIANT_DEFAULT,
    region: row.region || MEDIA_REGION_GLOBAL,
  };
  if (row.poster_url) pack.posterUrl = row.poster_url;
  if (row.thumbnail_url) pack.thumbnailUrl = row.thumbnail_url;
  if (row.webm_url) pack.webmUrl = row.webm_url;
  if (row.mp4_url) pack.mp4Url = row.mp4_url;
  if (row.gif_url) pack.gifUrl = row.gif_url;
  if (row.duration_sec != null) pack.durationSec = Number(row.duration_sec);
  const spec = asAnimationSpec(row.animation_spec);
  if (spec) pack.animationSpec = spec;
  if (row.prompt) pack.prompt = row.prompt;
  if (row.qa_notes) pack.qaNotes = row.qa_notes;
  if (row.created_at) pack.createdAt = row.created_at;
  if (row.updated_at) pack.updatedAt = row.updated_at;
  const sums = asChecksums(row.checksums);
  if (sums) pack.checksums = sums;
  return pack;
}

const SELECT_COLS =
  "kind, entity_id, version, variant, region, style, source, ownership, license, status, needs_motion, poster_url, thumbnail_url, webm_url, mp4_url, gif_url, duration_sec, prompt, animation_spec, qa_notes, checksums, created_at, updated_at";

export const getPublishedSoldiersMedia = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase
      .from("soldiers_media")
      .select(SELECT_COLS)
      .eq("status", "published")
      .eq("variant", MEDIA_VARIANT_DEFAULT)
      .eq("region", MEDIA_REGION_GLOBAL);
    if (error) {
      console.warn("soldiers_media read failed", error.message);
      return [] as SoldiersMediaAsset[];
    }
    const rows: SoldiersMediaAsset[] = [];
    for (const row of data ?? []) {
      const mapped = mapSoldiersMediaRow(row);
      if (mapped && isProductionPackage(mapped)) rows.push(mapped);
    }
    return rows;
  } catch (e) {
    console.warn("soldiers_media hydrate skipped", e);
    return [] as SoldiersMediaAsset[];
  }
});

export const listAdminSoldiersMedia = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("@/lib/admin.server");
  assertAdmin();
  const { adminDbLoose } = await import("@/lib/db-admin");
  const db = await adminDbLoose();
  if (!db) return [] as SoldiersMediaAsset[];
  const { data, error } = await db.from("soldiers_media").select(SELECT_COLS);
  if (error) {
    console.error("soldiers_media admin list failed", error.message);
    return [] as SoldiersMediaAsset[];
  }
  const rows: SoldiersMediaAsset[] = [];
  for (const row of data ?? []) {
    const mapped = mapSoldiersMediaRow(row);
    if (mapped) rows.push(mapped);
  }
  return rows;
});

function parseStatusUpdate(input: unknown): {
  kind: SoldiersMediaKind;
  entityId: string;
  version: string;
  variant: string;
  region: string;
  status: SoldiersMediaStatus;
  qaNotes?: string;
} {
  const raw = input as Record<string, unknown> | null;
  const kind = String(raw?.["kind"] ?? "");
  const entityId = String(raw?.["entityId"] ?? "").trim();
  const status = String(raw?.["status"] ?? "");
  if (!isSoldiersMediaKind(kind) || !entityId || !isSoldiersMediaStatus(status)) {
    throw new Error("Pacote de mídia inválido");
  }
  const parsed: {
    kind: SoldiersMediaKind;
    entityId: string;
    version: string;
    variant: string;
    region: string;
    status: SoldiersMediaStatus;
    qaNotes?: string;
  } = {
    kind,
    entityId,
    version: String(raw?.["version"] ?? "v1").trim() || "v1",
    variant: String(raw?.["variant"] ?? MEDIA_VARIANT_DEFAULT).trim() || MEDIA_VARIANT_DEFAULT,
    region: String(raw?.["region"] ?? MEDIA_REGION_GLOBAL).trim() || MEDIA_REGION_GLOBAL,
    status,
  };
  if (typeof raw?.["qaNotes"] === "string" && raw["qaNotes"].trim()) {
    parsed.qaNotes = raw["qaNotes"].trim();
  }
  return parsed;
}

export const updateSoldiersMediaStatus = createServerFn({ method: "POST" })
  .inputValidator(parseStatusUpdate)
  .handler(async ({ data }) => {
    const { assertAdmin, writeAudit, ADMIN_ACTOR } = await import("@/lib/admin.server");
    assertAdmin();
    const { adminDbLoose } = await import("@/lib/db-admin");
    const db = await adminDbLoose();
    if (!db) return { ok: false as const, reason: "db_unavailable" };

    const { data: row, error: readErr } = await db
      .from("soldiers_media")
      .select(SELECT_COLS)
      .eq("kind", data.kind)
      .eq("entity_id", data.entityId)
      .eq("version", data.version)
      .eq("variant", data.variant)
      .eq("region", data.region)
      .maybeSingle();
    if (readErr || !row) return { ok: false as const, reason: "not_found" };

    const current = mapSoldiersMediaRow(row);
    if (!current) return { ok: false as const, reason: "invalid_row" };
    if (!canTransitionStatus(current.status, data.status)) {
      return { ok: false as const, reason: "illegal_transition" };
    }

    const next: SoldiersMediaAsset = {
      ...current,
      status: data.status,
      ...(data.qaNotes ? { qaNotes: data.qaNotes } : {}),
    };
    if (data.status === "published") {
      const issues = validateMediaPackage(next, { asPublished: true });
      if (issues.length) {
        console.warn("soldiers_media publish blocked", issues);
        return { ok: false as const, reason: "validation_failed" };
      }
    }

    const { error: updErr } = await db
      .from("soldiers_media")
      .update({
        status: data.status,
        qa_notes: data.qaNotes ?? current.qaNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("kind", data.kind)
      .eq("entity_id", data.entityId)
      .eq("version", data.version)
      .eq("variant", data.variant)
      .eq("region", data.region);
    if (updErr) {
      console.error("soldiers_media status update failed", updErr.message);
      return { ok: false as const, reason: "upsert_failed" };
    }

    if (next.kind === "exercise") {
      const projected = projectCatalogMediaStatus(next);
      const catA = await db
        .from("catalog_exercises")
        .update({ media_status: projected })
        .eq("id", next.entityId);
      if (catA.error) console.warn("catalog media_status sync failed", catA.error.message);
      const catB = await db
        .from("catalog_exercises")
        .update({ media_status: projected })
        .eq("media_id", next.entityId);
      if (catB.error) console.warn("catalog media_status sync failed", catB.error.message);
    }

    await writeAudit(
      "media_status_change",
      {
        kind: data.kind,
        entityId: data.entityId,
        from: current.status,
        to: data.status,
      },
      ADMIN_ACTOR,
    );
    return { ok: true as const, package: next };
  });
