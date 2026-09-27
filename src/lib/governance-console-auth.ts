/**
 * Auth helpers for Governance Console (safe to unit-test without createServerFn).
 */
import { requireAdminSession, type AdminRole } from "@/lib/access-session.server";

export const GOV_CONSOLE_ROLES: AdminRole[] = ["admin", "editor", "support", "analyst"];

/** Pure gate used by handlers + unit tests (throws → unauthorized). */
export function assertGovAdmin() {
  return requireAdminSession(GOV_CONSOLE_ROLES);
}

/** Map admin gate failure to API shape (no secrets). */
export function unauthorizedOrContinue<T>(run: () => T): T | { ok: false; error: "unauthorized" } {
  try {
    assertGovAdmin();
    return run();
  } catch {
    return { ok: false as const, error: "unauthorized" as const };
  }
}
