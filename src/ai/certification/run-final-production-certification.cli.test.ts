/**
 * CLI entry for `npm run ai:certification:final`.
 * Without secrets → production_ready false / BLOCKED remotes is expected (not a process failure).
 * Set CERT_REQUIRE_READY=1 to fail when not production_ready.
 */
import { describe, expect, it } from "vitest";
import { runFinalProductionCertification } from "@/ai/certification/run-final-production-certification";
import { FINAL_REPORT_VERSION } from "@/ai/certification/final-types";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REQUIRE_READY = process.env["CERT_REQUIRE_READY"] === "1";

describe("FASE 22.13 final production certification CLI", () => {
  it(
    "runs final certification + persists FINAL report",
    async () => {
      const { report, persisted } = await runFinalProductionCertification({
        skipPersist: false,
      });

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            report_version: report.report_version,
            production_ready: report.production_ready,
            commit_sha: report.commit_sha,
            environment: report.environment,
            failed_checks: report.failed_checks,
            blocked_checks: report.blocked_checks,
            untested_checks: report.untested_checks,
            failures: report.failures,
            side_artifacts: report.side_artifacts,
            persisted,
          },
          null,
          2,
        ),
      );

      expect(report.report_version).toBe(FINAL_REPORT_VERSION);
      expect(report.checks.every((c) => c.executed_at != null || c.status === "UNTESTED")).toBe(
        true,
      );
      expect(report.components.length).toBeGreaterThan(0);
      expect(report.commit_sha).toBeTruthy();
      expect(persisted?.jsonPath).toBeTruthy();
      expect(existsSync(join(process.cwd(), "docs", "AI_PRODUCTION_CERTIFICATION_FINAL.md"))).toBe(
        true,
      );
      expect(existsSync(join(process.cwd(), "docs", "certification", "final.json"))).toBe(true);

      // Without service role, ready must be false — never invent PASS
      if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
        expect(report.production_ready).toBe(false);
      }

      if (REQUIRE_READY && !report.production_ready) {
        expect.fail(
          `production_ready=false failures=${report.failures.join(" | ")}`,
        );
      }
    },
    900_000,
  );
});
