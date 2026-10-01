import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { completeAccountAccess } from "@/lib/access.functions";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import {
  ACCESS_DENY_NO_PURCHASE,
  ACCESS_DENY_NOT_CONFIGURED,
  ACCESS_DENY_GENERIC,
  ACCESS_GRANT_RATE_LIMITED,
} from "@/lib/ui/platform-copy";

export function accessDenyToast(reason: string | undefined) {
  if (reason === "no_purchase") return ACCESS_DENY_NO_PURCHASE;
  if (reason === "not_configured") return ACCESS_DENY_NOT_CONFIGURED;
  return ACCESS_DENY_GENERIC;
}

export function useCompleteAccessGrant() {
  const navigate = useNavigate();
  const { state, setAccessGranted, setAuthUserId } = useStore();
  const complete = useServerFn(completeAccountAccess);
  const [busy, setBusy] = useState(false);

  const postPath = useCallback(
    (next?: "/" | "/onboarding") => next ?? (state.profile ? "/" : "/onboarding"),
    [state.profile],
  );

  const acessoSearch = useCallback(
    (next?: "/" | "/onboarding") => {
      const out: { next?: "/" | "/onboarding" } = {};
      out.next = next ?? (state.profile ? "/" : "/onboarding");
      return out;
    },
    [state.profile],
  );

  const applyGrant = useCallback(
    async (opts: {
      email: string;
      authUserId: string;
      displayName: string;
      isNewUser: boolean;
      next?: "/" | "/onboarding";
      onBlockedNavigate?: boolean;
    }) => {
      setBusy(true);
      try {
        const deviceId = getDeviceId();
        const result = await complete({
          data: {
            email: opts.email,
            deviceId,
            authUserId: opts.authUserId,
            displayName: opts.displayName,
            isNewUser: opts.isNewUser,
          },
        });
        if (!result.ok) {
          toast.error(accessDenyToast(result.reason === "no_entitlement" ? "no_purchase" : result.reason));
          if (opts.onBlockedNavigate !== false) {
            navigate({ to: "/acesso", search: acessoSearch(opts.next) });
          }
          return { ok: false as const, reason: result.reason };
        }
        setAuthUserId(opts.authUserId);
        const grant = await setAccessGranted({
          email: result.email,
          shopifyCustomerId: result.shopifyCustomerId,
          orderCount: result.orderCount,
          productIds: result.productIds,
          accessTier: result.tier,
          restockEstimates: result.restockEstimates,
          lastPaidAt: result.lastPaidAt,
          accessExpiresAt: result.accessExpiresAt,
          shopifyDisplayName: result.shopifyDisplayName,
        });
        if (!grant.ok) {
          if (grant.reason === "rate_limited") {
            toast.error(ACCESS_GRANT_RATE_LIMITED);
          }
          return { ok: false as const, reason: grant.reason };
        }
        navigate({ to: postPath(opts.next) });
        return { ok: true as const };
      } finally {
        setBusy(false);
      }
    },
    [complete, setAccessGranted, setAuthUserId, navigate, acessoSearch, postPath],
  );

  return { applyGrant, busy, postPath, acessoSearch, setAuthUserId, state };
}
