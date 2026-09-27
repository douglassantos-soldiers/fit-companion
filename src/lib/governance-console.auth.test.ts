/**
 * Auth gate for Governance Console (FASE 19) — reject without admin session.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/access-session.server", () => ({
  requireAdminSession: vi.fn(),
}));

import { requireAdminSession } from "@/lib/access-session.server";
import {
  assertGovAdmin,
  GOV_CONSOLE_ROLES,
  unauthorizedOrContinue,
} from "@/lib/governance-console-auth";

const mockedRequire = vi.mocked(requireAdminSession);

beforeEach(() => {
  mockedRequire.mockReset();
});

describe("FASE 19 governance console auth", () => {
  it("allows analyst role list", () => {
    expect(GOV_CONSOLE_ROLES).toContain("analyst");
    expect(GOV_CONSOLE_ROLES).toContain("admin");
  });

  it("assertGovAdmin rejects without session", () => {
    mockedRequire.mockImplementation(() => {
      throw new Error("unauthorized");
    });
    expect(() => assertGovAdmin()).toThrow();
  });

  it("unauthorizedOrContinue returns unauthorized without admin", () => {
    mockedRequire.mockImplementation(() => {
      throw new Error("no session");
    });
    const r = unauthorizedOrContinue(() => ({ ok: true as const, value: 1 }));
    expect(r).toEqual({ ok: false, error: "unauthorized" });
  });

  it("unauthorizedOrContinue runs body when admin ok", () => {
    mockedRequire.mockReturnValue({
      email: "admin@test.com",
      role: "analyst",
      exp: Date.now() / 1000 + 3600,
    });
    const r = unauthorizedOrContinue(() => ({ ok: true as const, value: 42 }));
    expect(r).toEqual({ ok: true, value: 42 });
    expect(mockedRequire).toHaveBeenCalledWith(GOV_CONSOLE_ROLES);
  });
});
