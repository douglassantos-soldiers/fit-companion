/**
 * MCP Tool Layer — fail-closed input validation (JSON-schema-like, no Zod required).
 */
import { TOOL_ERROR } from "@/ai/mcp/core/errors";
import type { JsonSchemaLike } from "@/ai/mcp/core/types";

export type ValidateOk = { ok: true; value: Record<string, unknown> };
export type ValidateFail = { ok: false; error_code: string; error_message: string };

function typeMatches(value: unknown, expected: string | string[] | undefined): boolean {
  if (!expected) return true;
  const types = Array.isArray(expected) ? expected : [expected];
  if (value === null && types.includes("null")) return true;
  const t = typeof value;
  if (t === "number" && Number.isNaN(value)) return false;
  if (types.includes("integer")) {
    return typeof value === "number" && Number.isInteger(value);
  }
  if (types.includes("array")) return Array.isArray(value);
  if (types.includes("object")) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return types.includes(t);
}

export function validateToolInput(raw: unknown, schema: JsonSchemaLike): ValidateOk | ValidateFail {
  const base =
    raw == null
      ? {}
      : typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
  if (!base) {
    return {
      ok: false,
      error_code: TOOL_ERROR.INVALID_INPUT,
      error_message: "input_must_be_object",
    };
  }

  if (schema.type && schema.type !== "object") {
    return {
      ok: false,
      error_code: TOOL_ERROR.INVALID_INPUT,
      error_message: "schema_type_unsupported",
    };
  }

  const required = schema.required ?? [];
  for (const key of required) {
    if (!(key in base) || base[key] === undefined) {
      return {
        ok: false,
        error_code: TOOL_ERROR.INVALID_INPUT,
        error_message: `missing_required:${key}`,
      };
    }
  }

  const props = schema.properties ?? {};
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(base)) {
      if (!(key in props)) {
        return {
          ok: false,
          error_code: TOOL_ERROR.INVALID_INPUT,
          error_message: `unexpected_property:${key}`,
        };
      }
    }
  }

  for (const [key, rule] of Object.entries(props)) {
    if (!(key in base) || base[key] === undefined) continue;
    const value = base[key];
    if (!typeMatches(value, rule.type)) {
      return {
        ok: false,
        error_code: TOOL_ERROR.INVALID_INPUT,
        error_message: `invalid_type:${key}`,
      };
    }
    if (rule.enum && !rule.enum.includes(value as string | number | boolean)) {
      return {
        ok: false,
        error_code: TOOL_ERROR.INVALID_INPUT,
        error_message: `invalid_enum:${key}`,
      };
    }
  }

  return { ok: true, value: { ...base } };
}

/** Minimal output shape check: must be plain object (or explicitly null allowed). */
export function validateToolOutput(
  raw: unknown,
  schema: JsonSchemaLike,
): ValidateOk | ValidateFail {
  if (schema.type === "object" || !schema.type) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return {
        ok: false,
        error_code: TOOL_ERROR.MALFORMED_OUTPUT,
        error_message: "output_must_be_object",
      };
    }
    const obj = raw as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) {
        return {
          ok: false,
          error_code: TOOL_ERROR.MALFORMED_OUTPUT,
          error_message: `missing_output_field:${key}`,
        };
      }
    }
    return { ok: true, value: obj };
  }
  return {
    ok: true,
    value:
      typeof raw === "object" && raw && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {},
  };
}
