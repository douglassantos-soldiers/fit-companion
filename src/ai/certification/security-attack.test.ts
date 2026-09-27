/**
 * FASE 21 — Security attack certification suite.
 */
import { describe, expect, it } from "vitest";
import { invokeTool } from "@/ai/mcp/core/invoke";
import { registerAllMcpTools } from "@/ai/mcp/register";
import { isSensitiveKey, redactForAudit } from "@/ai/governance/redact";
import {
  assertDiagnosticOwnership,
  parseListIgnoresClientUserId,
  CERT_SECURITY_CHECKS,
} from "@/ai/certification";
import { unauthorizedOrContinue } from "@/lib/governance-console-auth";
import { vi } from "vitest";

vi.mock("@/lib/access-session.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-session.server")>();
  return {
    ...actual,
    requireAdminSession: vi.fn(() => {
      throw new Error("no session");
    }),
  };
});

describe("FASE 21 security attacks", () => {
  it("exports security checklist", () => {
    expect(CERT_SECURITY_CHECKS).toContain("wrong_user");
    expect(CERT_SECURITY_CHECKS).toContain("unauthorized_tool");
  });

  it("list parse ignores client userId (ownership contract)", () => {
    const p = parseListIgnoresClientUserId({
      deviceId: "device-abcdefgh",
      userId: "attacker-forged-id",
      runId: "ar_1",
    });
    expect(p.clientUserIdIgnored).toBe(true);
    expect(p.deviceId).toBe("device-abcdefgh");
    expect((p as { userId?: string }).userId).toBeUndefined();
  });

  it("wrong resource → forbidden when audits belong to other user", () => {
    const r = assertDiagnosticOwnership({
      trustedUserId: "user_a",
      auditUserIds: ["user_b"],
      agentUserId: "user_b",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("forbidden");
  });

  it("unauthorized tool denied", async () => {
    registerAllMcpTools();
    const res = await invokeTool({
      toolId: "admin_wipe_everything",
      trustedUserId: "user_cert_1",
      agentId: "specialist_training",
      input: {},
    });
    expect(res.ok).toBe(false);
  });

  it("direct governance endpoint unauthorized without admin", () => {
    const r = unauthorizedOrContinue(() => ({ ok: true as const }));
    expect(r).toEqual({ ok: false, error: "unauthorized" });
  });

  it("redacts token and api_key keys", () => {
    expect(isSensitiveKey("token")).toBe(true);
    expect(isSensitiveKey("session_token")).toBe(true);
    const redacted = redactForAudit({ token: "sk-secret", api_key: "x", ok: true }) as Record<
      string,
      unknown
    >;
    expect(redacted["token"]).toBe("[REDACTED]");
    expect(redacted["api_key"]).toBe("[REDACTED]");
    expect(redacted["ok"]).toBe(true);
  });
});
