import { createServerFn } from "@tanstack/react-start";
import { isPhotoPose, isPhotoVisibility } from "@/lib/progress/body";
import type { PhotoPose, PhotoVisibility } from "@/lib/types";

function parseDevice(input: unknown) {
  const v = input as { deviceId?: string } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) throw new Error("deviceId inválido");
  return { deviceId };
}

function parseSave(input: unknown) {
  const base = parseDevice(input);
  const v = input as {
    id?: string;
    takenOn?: string;
    pose?: string;
    storagePath?: string;
    visibility?: string;
  } | null;
  const id = String(v?.id ?? "").trim();
  const takenOn = String(v?.takenOn ?? "").slice(0, 10);
  const pose = v?.pose;
  const storagePath = String(v?.storagePath ?? "").trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn) || !isPhotoPose(pose) || !storagePath) {
    throw new Error("foto inválida");
  }
  const visibility = isPhotoVisibility(v?.visibility) ? v.visibility : undefined;
  return {
    ...base,
    id,
    takenOn,
    pose: pose as PhotoPose,
    storagePath,
    ...(visibility ? { visibility: visibility as PhotoVisibility } : {}),
  };
}

function parseDelete(input: unknown) {
  const base = parseDevice(input);
  const id = String((input as { photoId?: string } | null)?.photoId ?? "").trim();
  if (!id) throw new Error("photoId inválido");
  return { ...base, photoId: id };
}

function parseVisibility(input: unknown) {
  const base = parseDelete(input);
  const visibility = (input as { visibility?: string } | null)?.visibility;
  if (!isPhotoVisibility(visibility)) throw new Error("visibilidade inválida");
  return { ...base, visibility: visibility as PhotoVisibility };
}

export const saveProgressPhotoFn = createServerFn({ method: "POST" })
  .inputValidator(parseSave)
  .handler(async ({ data }) => {
    const { saveProgressPhotoServer } = await import("@/lib/progress/photos.server");
    return saveProgressPhotoServer(data.deviceId, {
      id: data.id,
      takenOn: data.takenOn,
      pose: data.pose,
      storagePath: data.storagePath,
      ...(data.visibility ? { visibility: data.visibility } : {}),
    });
  });

function parseUpload(input: unknown) {
  const base = parseDevice(input);
  const v = input as {
    id?: string;
    takenOn?: string;
    pose?: string;
    bytesBase64?: string;
    contentType?: string;
  } | null;
  const id = String(v?.id ?? "").trim();
  const takenOn = String(v?.takenOn ?? "").slice(0, 10);
  const pose = v?.pose;
  const bytesBase64 = String(v?.bytesBase64 ?? "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn) || !isPhotoPose(pose) || bytesBase64.length < 32) {
    throw new Error("upload inválido");
  }
  return {
    ...base,
    id,
    takenOn,
    pose: pose as PhotoPose,
    bytesBase64,
    contentType: String(v?.contentType ?? "image/jpeg"),
  };
}

export const uploadProgressPhotoFn = createServerFn({ method: "POST" })
  .inputValidator(parseUpload)
  .handler(async ({ data }) => {
    const { uploadProgressPhotoBytesServer } = await import("@/lib/progress/photos.server");
    return uploadProgressPhotoBytesServer(data.deviceId, {
      id: data.id,
      takenOn: data.takenOn,
      pose: data.pose,
      bytesBase64: data.bytesBase64,
      contentType: data.contentType,
    });
  });

function parseSignedUrl(input: unknown) {
  const base = parseDevice(input);
  const storagePath = String((input as { storagePath?: string } | null)?.storagePath ?? "").trim();
  if (!storagePath) throw new Error("storagePath inválido");
  return { ...base, storagePath };
}

export const signedProgressPhotoUrlFn = createServerFn({ method: "POST" })
  .inputValidator(parseSignedUrl)
  .handler(async ({ data }) => {
    const { signedProgressPhotoUrlServer } = await import("@/lib/progress/photos.server");
    const url = await signedProgressPhotoUrlServer(data.deviceId, data.storagePath);
    return { ok: Boolean(url), url };
  });

export const deleteProgressPhotoFn = createServerFn({ method: "POST" })
  .inputValidator(parseDelete)
  .handler(async ({ data }) => {
    const { deleteProgressPhotoServer } = await import("@/lib/progress/photos.server");
    return deleteProgressPhotoServer(data.deviceId, data.photoId);
  });

export const updateProgressPhotoVisibilityFn = createServerFn({ method: "POST" })
  .inputValidator(parseVisibility)
  .handler(async ({ data }) => {
    const { updateProgressPhotoVisibilityServer } = await import("@/lib/progress/photos.server");
    return updateProgressPhotoVisibilityServer(data.deviceId, data.photoId, data.visibility);
  });
