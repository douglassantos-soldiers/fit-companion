/**
 * Server metadata for progress photos (service_role). Bytes stay in private storage.
 */
import { adminDbLoose } from "@/lib/db-admin";
import {
  isPhotoPose,
  isPhotoVisibility,
  isValidProgressPhotoPath,
  mapPhotoRow,
  DEFAULT_PHOTO_VISIBILITY,
} from "@/lib/progress/body";
import { resolveTrustedIdentity } from "@/lib/session-identity.server";
import type { PhotoPose, PhotoVisibility, ProgressPhotoEntry } from "@/lib/types";

type Row = Record<string, unknown>;

export async function saveProgressPhotoServer(
  deviceId: string,
  input: {
    id: string;
    takenOn: string;
    pose: PhotoPose;
    storagePath: string;
    visibility?: PhotoVisibility;
  },
): Promise<{ ok: boolean; photo?: ProgressPhotoEntry }> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false };
  if (!isPhotoPose(input.pose)) return { ok: false };
  if (!isValidProgressPhotoPath(input.storagePath)) return { ok: false };
  const visibility = isPhotoVisibility(input.visibility) ? input.visibility : DEFAULT_PHOTO_VISIBILITY;
  const db = await adminDbLoose();
  if (!db) return { ok: false };

  const { data, error } = await db
    .from("progress_photos")
    .upsert(
      {
        id: input.id,
        user_id: identity.userId,
        device_id: deviceId,
        taken_on: input.takenOn.slice(0, 10),
        pose: input.pose,
        storage_path: input.storagePath,
        visibility,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,taken_on,pose" },
    )
    .select("id, taken_on, pose, storage_path, visibility")
    .maybeSingle();

  if (error) {
    console.error("saveProgressPhoto failed", error);
    return { ok: false };
  }
  const photo = data ? mapPhotoRow(data as Row) : {
    id: input.id,
    takenOn: input.takenOn.slice(0, 10),
    pose: input.pose,
    storagePath: input.storagePath,
    visibility,
  };
  if (!photo) return { ok: false };
  return { ok: true, photo };
}

export async function deleteProgressPhotoServer(
  deviceId: string,
  photoId: string,
): Promise<{ ok: boolean; storagePath?: string }> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false };
  const db = await adminDbLoose();
  if (!db) return { ok: false };

  const { data } = await db
    .from("progress_photos")
    .select("storage_path")
    .eq("user_id", identity.userId)
    .eq("id", photoId)
    .maybeSingle();
  const storagePath = data ? String((data as Row)["storage_path"] ?? "") : "";

  const { error } = await db
    .from("progress_photos")
    .delete()
    .eq("user_id", identity.userId)
    .eq("id", photoId);
  if (error) {
    console.error("deleteProgressPhoto failed", error);
    return { ok: false };
  }
  return { ok: true, ...(storagePath ? { storagePath } : {}) };
}

export async function updateProgressPhotoVisibilityServer(
  deviceId: string,
  photoId: string,
  visibility: PhotoVisibility,
): Promise<{ ok: boolean }> {
  const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
  if (!identity) return { ok: false };
  if (!isPhotoVisibility(visibility)) return { ok: false };
  const db = await adminDbLoose();
  if (!db) return { ok: false };
  const { error } = await db
    .from("progress_photos")
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq("user_id", identity.userId)
    .eq("id", photoId);
  if (error) {
    console.error("update photo visibility failed", error);
    return { ok: false };
  }
  return { ok: true };
}

/** Remove private photo objects for an account wipe. Uses table paths + folder prefixes. */
export async function removeProgressPhotosForUser(userId: string): Promise<void> {
  const db = await adminDbLoose();
  if (!db || !userId) return;
  const { data: rows } = await db.from("progress_photos").select("storage_path").eq("user_id", userId);
  const fromTable = ((rows ?? []) as Row[])
    .map((r) => String(r["storage_path"] ?? ""))
    .filter((p) => isValidProgressPhotoPath(p));

  let authFolder: string | null = null;
  const { data: user } = await db.from("users").select("auth_user_id").eq("id", userId).maybeSingle();
  if (user && typeof (user as Row)["auth_user_id"] === "string") {
    authFolder = String((user as Row)["auth_user_id"]);
  }

  const extras = await listProgressPhotoPathsUnderPrefixes([userId, authFolder].filter(Boolean) as string[]);
  const paths = [...new Set([...fromTable, ...extras])];
  if (!paths.length) return;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const chunk = 50;
    for (let i = 0; i < paths.length; i += chunk) {
      await supabaseAdmin.storage.from("progress-photos").remove(paths.slice(i, i + chunk));
    }
  } catch (e) {
    console.error("removeProgressPhotosForUser failed", e);
  }
}

async function listProgressPhotoPathsUnderPrefixes(prefixes: string[]): Promise<string[]> {
  const out: string[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const prefix of prefixes) {
      const { data: dates } = await supabaseAdmin.storage.from("progress-photos").list(prefix, { limit: 200 });
      for (const dateFolder of dates ?? []) {
        const name = dateFolder.name;
        if (!name) continue;
        const { data: files } = await supabaseAdmin.storage
          .from("progress-photos")
          .list(`${prefix}/${name}`, { limit: 50 });
        for (const file of files ?? []) {
          if (!file.name) continue;
          const path = `${prefix}/${name}/${file.name}`;
          if (isValidProgressPhotoPath(path)) out.push(path);
        }
      }
    }
  } catch {
    // Bucket or list may be missing before migration.
  }
  return out;
}
