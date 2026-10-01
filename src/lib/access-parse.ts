/**
 * Pure validators for access session (no server/cookie imports).
 * Safe to use from unit tests.
 */
import { DeviceIdSchema, DisplayNameSchema, EmailSchema } from "@/lib/validation/common";

function requireEmail(raw: unknown): string {
  const parsed = EmailSchema.safeParse(raw ?? "");
  if (!parsed.success) throw new Error("E-mail inválido");
  return parsed.data;
}

function requireDeviceId(raw: unknown): string {
  const parsed = DeviceIdSchema.safeParse(String(raw ?? "").trim());
  if (!parsed.success) throw new Error("deviceId inválido");
  return parsed.data;
}

/** Public validator — strips client-sent tier/productIds/orderCount. */
export function parseEstablishAccessInput(input: unknown): { email: string; deviceId: string } {
  const v = input as { email?: string; deviceId?: string } | null;
  return {
    email: requireEmail(v?.email),
    deviceId: requireDeviceId(v?.deviceId),
  };
}

export function parseCompleteAccountInput(input: unknown): {
  email: string;
  deviceId: string;
  authUserId: string;
  displayName: string;
  isNewUser: boolean;
} {
  const v = input as {
    email?: string;
    deviceId?: string;
    authUserId?: string;
    displayName?: string;
    isNewUser?: boolean;
  } | null;
  return {
    email: requireEmail(v?.email),
    deviceId: requireDeviceId(v?.deviceId),
    authUserId: String(v?.authUserId ?? "").trim().slice(0, 128),
    displayName: DisplayNameSchema.parse(v?.displayName ?? "Soldado"),
    isNewUser: v?.isNewUser === true,
  };
}

export function parseAdminLogin(input: unknown): { email: string; password: string } {
  const v = input as { email?: string; password?: string; pin?: string } | null;
  const email = requireEmail(v?.email);
  const password = String(v?.password ?? v?.pin ?? "");
  if (!password) throw new Error("Senha ausente");
  return { email, password };
}
