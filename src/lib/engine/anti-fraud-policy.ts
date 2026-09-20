/**
 * Anti-fraud policy — warn or block input. NEVER bans or suspends.
 * Account block remains admin-only (account-status).
 */
import type { FraudFlag, FraudValidationResult } from "@/lib/engine/anti-fraud";

export type FraudPolicyAction = "allow" | "warn" | "block_input";

export type FraudPolicyDecision = {
  action: FraudPolicyAction;
  userMessage: string | null;
};

const WARN_SUFFIX = "Valor em revisão — não é banimento";

export function applyFraudPolicy(result: FraudValidationResult): FraudPolicyDecision {
  const high = result.flags.find((f) => f.severity === "high");
  if (!result.ok || high) {
    return {
      action: "block_input",
      userMessage: high?.message ?? result.flags[0]?.message ?? "Valor inválido",
    };
  }
  const warnFlag = result.flags.find((f) => f.severity === "medium" || f.severity === "low");
  if (warnFlag) {
    return { action: "warn", userMessage: `${warnFlag.message}. ${WARN_SUFFIX}` };
  }
  return { action: "allow", userMessage: null };
}

export function fraudWarningFromFlags(flags: FraudFlag[] | unknown[] | undefined): string | null {
  if (!Array.isArray(flags) || !flags.length) return null;
  const parsed: FraudFlag[] = [];
  for (const f of flags) {
    if (!f || typeof f !== "object") continue;
    const rec = f as Record<string, unknown>;
    if (typeof rec["message"] !== "string") continue;
    const severity = rec["severity"];
    if (severity !== "low" && severity !== "medium" && severity !== "high") continue;
    const code = rec["code"];
    if (typeof code !== "string") continue;
    parsed.push({
      code: code as FraudFlag["code"],
      message: rec["message"],
      severity,
    });
  }
  if (!parsed.length) return null;
  const fake: FraudValidationResult = {
    ok: parsed.every((x) => x.severity !== "high"),
    flags: parsed,
  };
  const d = applyFraudPolicy(fake);
  return d.action === "warn" || d.action === "block_input" ? d.userMessage : null;
}
