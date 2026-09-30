// @ts-nocheck
/**
 * Probe runner wrapper — always records execution timing.
 */
import type { CertCheck, CertEnvironment, CertStatus } from "@/ai/certification/types";
import { normalizeCheck } from "@/ai/certification/types";

export type ProbeContext = {
  environment: CertEnvironment;
};

export type ProbeOutcome = {
  status: CertStatus;
  evidence?: Record<string, string | number | boolean | null | undefined>;
  error?: string | null;
};

export async function runProbe(
  meta: { check_id: string; name: string; critical: boolean },
  ctx: ProbeContext,
  fn: () => Promise<ProbeOutcome>,
): Promise<CertCheck> {
  const started = Date.now();
  const executed_at = new Date().toISOString();
  try {
    const out = await fn();
    return normalizeCheck({
      check_id: meta.check_id,
      name: meta.name,
      status: out.status,
      critical: meta.critical,
      executed_at,
      duration_ms: Date.now() - started,
      evidence: out.evidence ?? {},
      error: out.error ?? null,
      environment: ctx.environment,
    });
  } catch (e) {
    return normalizeCheck({
      check_id: meta.check_id,
      name: meta.name,
      status: "FAIL",
      critical: meta.critical,
      executed_at,
      duration_ms: Date.now() - started,
      evidence: {},
      error: e instanceof Error ? e.message : String(e),
      environment: ctx.environment,
    });
  }
}
