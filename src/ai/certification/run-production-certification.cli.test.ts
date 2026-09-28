/**
 * CLI entry for `npm run ai:certification` — runs via Vitest so `@/` aliases resolve.
 * Nested suite runs in a child process (see runCertificationTestSuite).
 */
import { describe, expect, it } from "vitest";
import { runProductionCertification } from "@/ai/certification/run-production-certification";

const REPORT_ONLY =
  process.env["CERT_REPORT_ONLY"] === "1" ||
  process.argv.includes("--report-only");

describe("FASE 22.7 production certification CLI", () => {
  it(
    "executes probes + real test suite + persists report",
    async () => {
      const { report, persisted } = await runProductionCertification({
        skipPersist: false,
      });

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            production_ready: report.production_ready,
            commit_sha: report.commit_sha,
            environment: report.environment,
            failures: report.failures,
            test_suite: report.test_suite,
            checks: report.checks.map((c) => ({
              id: c.check_id,
              status: c.status,
              ms: c.duration_ms,
              error: c.error,
            })),
            persisted,
          },
          null,
          2,
        ),
      );

      expect(report.checks.length).toBeGreaterThanOrEqual(17);
      expect(report.checks.every((c) => c.status !== "UNTESTED" || c.executed_at == null)).toBe(
        true,
      );
      // Every probe must have been executed (not left UNTESTED by omission)
      expect(report.checks.every((c) => c.executed_at != null)).toBe(true);
      expect(report.test_suite.executed).toBe(true);
      expect(report.commit_sha).toBeTruthy();
      expect(persisted?.jsonPath).toBeTruthy();

      // Fail the process when not production-ready unless CERT_REPORT_ONLY=1
      if (!REPORT_ONLY && !report.production_ready) {
        expect.fail(
          `production_ready=false failures=${report.failures.join(" | ")}`,
        );
      }
    },
    600_000,
  );
});
