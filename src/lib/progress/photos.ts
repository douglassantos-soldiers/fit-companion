/**
 * Client-side progress photo bytes: compress, signed URL, upload/delete.
 * Originals never go to the public checkins bucket.
 */
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth";
import {
  buildProgressPhotoPath,
  DEFAULT_PHOTO_VISIBILITY,
  isValidProgressPhotoPath,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_EDGE_PX,
  PROGRESS_PHOTOS_BUCKET,
  SIGNED_URL_TTL_SEC,
} from "@/lib/progress/body";
import type { PhotoPose, PhotoVisibility, ProgressPhotoEntry } from "@/lib/types";

export async function compressProgressPhoto(file: File): Promise<Blob> {
  if (typeof document === "undefined") return file;
  const bitmap = await loadImage(file);
  if (!bitmap) return file;
  const { width, height } = fitMaxEdge(bitmap.width, bitmap.height, PHOTO_MAX_EDGE_PX);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", PHOTO_JPEG_QUALITY);
  });
  return blob ?? file;
}

function fitMaxEdge(w: number, h: number, max: number) {
  const edge = Math.max(w, h);
  if (edge <= max) return { width: w, height: h };
  const scale = max / edge;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function loadImage(file: File): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function signedProgressPhotoUrl(storagePath: string): Promise<string | null> {
  if (!isValidProgressPhotoPath(storagePath)) return null;
  const { data, error } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadProgressPhotoFile(opts: {
  file: File;
  takenOn: string;
  pose: PhotoPose;
  id?: string;
}): Promise<{ photo: ProgressPhotoEntry } | { error: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Entre na conta para enviar fotos privadas." };
  const id = opts.id ?? crypto.randomUUID();
  const takenOn = opts.takenOn.slice(0, 10);
  const path = buildProgressPhotoPath({
    authUserId: user.id,
    takenOn,
    pose: opts.pose,
    id,
  });
  if (!isValidProgressPhotoPath(path, user.id)) {
    return { error: "Caminho de foto inválido." };
  }
  const blob = await compressProgressPhoto(opts.file);
  const { error } = await supabase.storage.from(PROGRESS_PHOTOS_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "3600",
  });
  if (error) {
    console.error("upload progress photo failed", error);
    return { error: "Não foi possível enviar a foto." };
  }
  return {
    photo: {
      id,
      takenOn,
      pose: opts.pose,
      storagePath: path,
      visibility: DEFAULT_PHOTO_VISIBILITY,
    },
  };
}

export async function deleteProgressPhotoFile(storagePath: string): Promise<boolean> {
  if (!isValidProgressPhotoPath(storagePath)) return false;
  const { error } = await supabase.storage.from(PROGRESS_PHOTOS_BUCKET).remove([storagePath]);
  if (error) {
    console.error("delete progress photo failed", error);
    return false;
  }
  return true;
}

export function visibilityAfterCardPublish(current: PhotoVisibility): PhotoVisibility {
  if (current === "card") return "feed";
  return current;
}
