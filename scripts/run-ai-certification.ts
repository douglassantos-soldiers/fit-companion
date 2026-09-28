/**
 * FASE 22.7 — CLI: real production certification.
 * Usage: npm run ai:certification [-- --report-only]
 */
import { runProductionCertification } from "../src/ai/certification/run-production-certification.ts";

async function main() {
  const reportOnly = process.argv.includes("--report-only");

  console.log("FASE 22.7 — Running production certification (probes + vitest)...");
  const { report, persisted } = await runProductionCertification({
    skipPersist: false,
  });

  console.log(`commit_sha: ${report.commit_sha}`);
  console.log(`environment: ${report.environment}`);
  console.log(`production_ready: ${report.production_ready}`);
  console.log(`checks: ${report.checks.length}`);
  console.log(`failures: ${report.failures.length}`);
  console.log(`test_suite.executed: ${report.test_suite.executed} ok: ${report.test_suite.ok}`);
  if (persisted) {
    console.log(`persisted: ${persisted.jsonPath}`);
    console.log(`markdown: ${persisted.mdPath}`);
  }

  for (const c of report.checks) {
    const mark = c.status === "PASS" ? "OK" : c.status;
    console.log(`  [${mark}] ${c.check_id} (${c.duration_ms ?? "-"}ms)`);
  }

  if (!report.production_ready && !reportOnly) {
    console.error("\nCertification FAILED — production_ready=false");
    process.exit(1);
  }
  if (!report.production_ready && reportOnly) {
    console.warn("\nReport written; production_ready=false (report-only mode, exit 0)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
