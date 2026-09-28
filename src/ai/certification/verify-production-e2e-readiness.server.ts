/**
 * FASE 22.12 — Production E2E readiness wrapper.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  runProductionE2E,
  type ProductionE2EReport,
  type RunProductionE2EOpts,
} from "@/ai/e2e/production-e2e";

export async function verifyProductionE2EReadiness(
  opts?: RunProductionE2EOpts & { persistPath?: string | null },
): Promise<ProductionE2EReport> {
  const report = await runProductionE2E({
    mode: opts?.mode ?? "full",
    requireLlm: opts?.requireLlm,
    persistReport: false,
    persistPath: null,
    ...(opts?.testOverrides ? { testOverrides: opts.testOverrides } : {}),
  });

  if (opts?.persistPath !== null) {
    const path =
      opts?.persistPath ??
      join(process.cwd(), "docs", "certification", "production-e2e.json");
    try {
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, JSON.stringify(report, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }

  return report;
}
