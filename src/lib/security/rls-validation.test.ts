import { describe, expect, it } from "vitest";
import {
  HARDEN_MIGRATIONS,
  probeRemoteRlsPolicies,
  scanMigrationsForRlsRisk,
} from "./rls-validation";

describe("RLS migration harden scan (P0-5)", () => {
  it("finds FASE1/FASE2 harden migrations with REVOKE", () => {
    const findings = scanMigrationsForRlsRisk();
    const blockers = findings.filter((f) => f.severity === "blocker");
    expect(blockers).toEqual([]);
    for (const name of HARDEN_MIGRATIONS) {
      expect(findings.some((f) => f.file === name && f.severity === "info")).toBe(true);
    }
  });

  it("warns that DEPLOY bundles reopen USING(true)", () => {
    const findings = scanMigrationsForRlsRisk();
    const deployWarns = findings.filter(
      (f) => f.severity === "warn" && f.file.startsWith("DEPLOY"),
    );
    expect(deployWarns.length).toBeGreaterThan(0);
  });
});

describe("remote RLS probe", () => {
  it("returns pending_operator without inventing PASS when credentials absent", async () => {
    const prevUrl = process.env["SUPABASE_URL"];
    const prevKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const result = await probeRemoteRlsPolicies();
    expect(result.status).toBe("pending_operator");
    expect(result.evidence.some((e) => /absent/i.test(e))).toBe(true);
    if (prevUrl !== undefined) process.env["SUPABASE_URL"] = prevUrl;
    if (prevKey !== undefined) process.env["SUPABASE_SERVICE_ROLE_KEY"] = prevKey;
  });
});
