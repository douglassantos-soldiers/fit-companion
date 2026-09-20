/**
 * Public published Soldiers media (RLS: status = published).
 */
import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import type { SoldiersMediaAsset, SoldiersMediaKind } from "@/lib/soldiers-media-types";

type SoldiersMediaRow = Database["public"]["Tables"]["soldiers_media"]["Row"];

function mapRow(row: SoldiersMediaRow): SoldiersMediaAsset {
  const kind = row.kind as SoldiersMediaKind;
  return {
    kind,
    entityId: row.entity_id,
    version: row.version,
    style: row.style,
    source: "soldiers",
    ownership: "owned",
    license: "soldiers-owned",
    needsMotion: row.needs_motion,
    status: "published",
    ...(row.poster_url ? { posterUrl: row.poster_url } : {}),
    ...(row.thumbnail_url ? { thumbnailUrl: row.thumbnail_url } : {}),
    ...(row.webm_url ? { webmUrl: row.webm_url } : {}),
    ...(row.mp4_url ? { mp4Url: row.mp4_url } : {}),
    ...(row.gif_url ? { gifUrl: row.gif_url } : {}),
    ...(row.duration_sec != null ? { durationSec: Number(row.duration_sec) } : {}),
  };
}

export const getPublishedSoldiersMedia = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase
      .from("soldiers_media")
      .select(
        "kind, entity_id, version, style, source, ownership, license, status, needs_motion, poster_url, thumbnail_url, webm_url, mp4_url, gif_url, duration_sec",
      )
      .eq("status", "published");
    if (error) {
      console.warn("soldiers_media read failed", error.message);
      return [] as SoldiersMediaAsset[];
    }
    return (data ?? []).map((row) => mapRow(row));
  } catch (e) {
    console.warn("soldiers_media hydrate skipped", e);
    return [] as SoldiersMediaAsset[];
  }
});
