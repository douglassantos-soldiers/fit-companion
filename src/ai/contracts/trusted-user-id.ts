/**
 * Branded trusted user id for AI contracts.
 * MUST be filled only from resolveTrustedIdentity() / toTrustedUserId().
 * Never accept raw client-supplied userId as TrustedUserId.
 */
export type TrustedUserId = string & { readonly __brand: "TrustedUserId" };

/** Narrow a trusted identity userId into the branded type (server-side only). */
export function asTrustedUserId(userId: string): TrustedUserId {
  if (!userId || userId.length < 8) {
    throw new Error("invalid_trusted_user_id");
  }
  return userId as TrustedUserId;
}
