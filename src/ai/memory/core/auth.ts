/**
 * Resolve TrustedUserId for Memory API (anonymous deny).
 */

import { asTrustedUserId, type TrustedUserId } from "@/ai/contracts/trusted-user-id";
import { MEMORY_ERROR, MemoryError } from "@/ai/memory/core/errors";

export function requireTrustedMemoryUser(trustedUserId: string | null): TrustedUserId {
  const raw = trustedUserId?.trim() ?? "";
  if (!raw) {
    throw new MemoryError(MEMORY_ERROR.ANONYMOUS_DENIED, "authentication_required");
  }
  try {
    return asTrustedUserId(raw);
  } catch {
    throw new MemoryError(MEMORY_ERROR.INVALID_TRUSTED_USER, "invalid_trusted_user_id");
  }
}
