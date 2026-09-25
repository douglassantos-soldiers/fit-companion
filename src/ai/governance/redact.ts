/**
 * Redact secrets and oversized payloads before audit / diagnostics.
 * Never log API keys, access tokens, service_role, or unnecessary PII.
 */

const SENSITIVE_KEY =
  /api[_-]?key|access[_-]?token|service[_-]?role|authorization|secret|password|bearer|refresh[_-]?token|private[_-]?key/i;

const MAX_STRING = 240;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function redactString(value: string): string {
  const t = value.trim();
  if (t.length <= MAX_STRING) return t;
  return `${t.slice(0, MAX_STRING - 1)}…`;
}

export function redactForAudit(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((v) => redactForAudit(v));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = redactForAudit(v);
    }
    return out;
  }
  return String(value).slice(0, MAX_STRING);
}

export function redactMetadata(
  meta: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (isSensitiveKey(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (typeof v === "string") out[k] = redactString(v);
    else out[k] = v;
  }
  return out;
}
