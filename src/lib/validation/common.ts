import { z } from "zod";

/** Shared identity / contact validators (FE + BE). */

export const DEVICE_ID_MIN = 8;
export const DEVICE_ID_MAX = 128;
export const DISPLAY_NAME_MAX = 80;
export const EMAIL_MAX = 254;

/** Strip control chars + HTML-ish tags; collapse whitespace. */
export function sanitizePlainText(raw: string, max: number): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function sanitizeDisplayName(raw: string): string {
  const cleaned = sanitizePlainText(raw, DISPLAY_NAME_MAX);
  return cleaned || "Soldado";
}

export function sanitizeBio(raw: string): string {
  return sanitizePlainText(raw, 280);
}

const DEVICE_ID_RE = /^[A-Za-z0-9_.:\-@]{8,128}$/;

export const DeviceIdSchema = z
  .string()
  .trim()
  .min(DEVICE_ID_MIN, "deviceId inválido")
  .max(DEVICE_ID_MAX)
  .regex(DEVICE_ID_RE, "deviceId inválido");

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX)
  .email("E-mail inválido");

export const DisplayNameSchema = z
  .string()
  .trim()
  .max(DISPLAY_NAME_MAX)
  .transform((s) => sanitizeDisplayName(s));

export const UuidLikeSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_.:\-]+$/, "id inválido");

export const IsoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const AllowedImageMimeSchema = z.enum(ALLOWED_IMAGE_MIME);

export const ALLOWED_IMAGE_EXT = ["jpg", "jpeg", "png", "webp"] as const;

export function normalizeImageUpload(input: {
  contentType?: string;
  fileExt?: string;
}): { contentType: AllowedImageMime; fileExt: (typeof ALLOWED_IMAGE_EXT)[number] } {
  const rawType = String(input.contentType ?? "image/jpeg")
    .trim()
    .toLowerCase()
    .split(";")[0]!
    .trim();
  const mapped: AllowedImageMime =
    rawType === "image/jpg" || rawType === "image/jpeg"
      ? "image/jpeg"
      : rawType === "image/png"
        ? "image/png"
        : rawType === "image/webp"
          ? "image/webp"
          : (() => {
              throw new Error("Tipo de imagem não permitido");
            })();

  const rawExt = String(input.fileExt ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const fromType =
    mapped === "image/jpeg" ? "jpg" : mapped === "image/png" ? "png" : "webp";
  const ext = (ALLOWED_IMAGE_EXT as readonly string[]).includes(rawExt)
    ? (rawExt as (typeof ALLOWED_IMAGE_EXT)[number])
    : fromType;
  if (ext === "jpeg") return { contentType: mapped, fileExt: "jpg" };
  return { contentType: mapped, fileExt: ext === "jpg" || ext === "png" || ext === "webp" ? ext : fromType };
}
