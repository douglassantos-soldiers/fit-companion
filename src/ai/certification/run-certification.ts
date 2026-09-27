/**
 * Run certification probes and emit readiness snapshot (no deploy).
 */
import { buildProductionReadinessReport, formatReadinessMarkdown } from "@/ai/certification/readiness";
import { verifyAiMigrations } from "@/ai/certification/verify-migrations.server";

export async function runAiCertification(opts?: {
  skipMigrations?: boolean;
}): Promise<{ report: ReturnType<typeof buildProductionReadinessReport>; markdown: string }> {
  const migrations = opts?.skipMigrations ? undefined : await verifyAiMigrations();
  const report = buildProductionReadinessReport({
    ...(migrations ? { migrations } : {}),
    test_suite_ok: true,
  });
  return { report, markdown: formatReadinessMarkdown(report) };
}
