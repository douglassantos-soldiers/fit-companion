/**
 * Legacy entry — delegates to FASE 22.7 runProductionCertification.
 * Never hardcodes test_suite_ok: true.
 */
import { runProductionCertification } from "@/ai/certification/run-production-certification";
import { buildProductionReadinessReport, formatReadinessMarkdown } from "@/ai/certification/readiness";

export async function runAiCertification(opts?: {
  skipMigrations?: boolean;
  skipTestSuite?: boolean;
  skipPersist?: boolean;
}): Promise<{
  report: ReturnType<typeof buildProductionReadinessReport>;
  markdown: string;
}> {
  const { report: cert, markdown } = await runProductionCertification({
    skipTestSuite: opts?.skipTestSuite ?? false,
    skipPersist: opts?.skipPersist ?? true,
  });

  const report = buildProductionReadinessReport({
    checks: cert.checks,
    commit_sha: cert.commit_sha,
    environment: cert.environment,
  });
  // Attach full certification + force production_ready from real eval
  report.production_ready = cert.production_ready;
  report.certification = cert;
  report.generated_at = cert.timestamp;
  report.report_version = cert.report_version;

  return { report, markdown: markdown || formatReadinessMarkdown(report) };
}
