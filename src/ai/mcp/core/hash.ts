/**
 * MCP Tool Layer — input hash + redaction (never store secrets).
 */

const SECRET_KEYS = /^(password|token|secret|authorization|api[_-]?key|cookie|refresh)/i;

export function redactInput(
  input: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SECRET_KEYS.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      out[k] = "[object]";
    }
  }
  return out;
}

/** Deterministic non-crypto hash for audit (djb2). */
export function hashInput(input: Record<string, unknown>): string {
  const canonical = JSON.stringify(redactInput(input), Object.keys(redactInput(input)).sort());
  let h = 5381;
  for (let i = 0; i < canonical.length; i += 1) {
    h = (h << 5) + h + canonical.charCodeAt(i);
    h |= 0;
  }
  return `h_${(h >>> 0).toString(16)}`;
}

export function newToolCallId(): string {
  return `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
