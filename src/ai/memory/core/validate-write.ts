/**
 * Memory write validation — LLM cannot write directly; sources gated.
 */

import type { MemoryData, MemorySource } from "@/ai/contracts/memory-record";
import { MEMORY_ERROR, MemoryError } from "@/ai/memory/core/errors";
import {
  LOW_CONFIDENCE_THRESHOLD,
  type CreateMemoryInput,
  type ValidatedMemoryWrite,
} from "@/ai/memory/core/types";

const ALLOWED_SOURCES = new Set<MemorySource>([
  "system",
  "coach",
  "user",
  "learning",
  "decision_engine",
]);

const FORBIDDEN_SOURCES = new Set(["llm", "agent_raw", "openai", "anthropic", "model", "gpt"]);

const SENSITIVE_KEY_RE =
  /password|passwd|secret|token|api[_-]?key|ssn|cpf|credit[_-]?card|auth[_-]?header|private[_-]?key|session[_-]?id/i;

const MAX_DATA_KEYS = 24;
const MAX_STRING_LEN = 500;

function sanitizeData(data: MemoryData): MemoryData {
  const out: MemoryData = {};
  const entries = Object.entries(data).slice(0, MAX_DATA_KEYS);
  for (const [k, v] of entries) {
    if (SENSITIVE_KEY_RE.test(k)) {
      throw new MemoryError(MEMORY_ERROR.SENSITIVE_KEY, `sensitive_data_key:${k}`);
    }
    if (typeof v === "string") {
      out[k] = v.slice(0, MAX_STRING_LEN);
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 20).map((s) => String(s).slice(0, 120));
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function validateMemoryWrite(
  input: Pick<
    CreateMemoryInput,
    "family" | "type" | "data" | "source" | "confidence" | "key" | "expiresAt"
  >,
): ValidatedMemoryWrite {
  const family = input.family;
  if (!family || !["user", "decision", "outcome", "learning"].includes(family)) {
    throw new MemoryError(MEMORY_ERROR.INVALID_INPUT, "invalid_family");
  }

  const type = (input.type ?? "").trim();
  if (!type || type.length > 64) {
    throw new MemoryError(MEMORY_ERROR.INVALID_INPUT, "invalid_type");
  }

  const rawSource = String(input.source ?? "")
    .trim()
    .toLowerCase();
  if (!rawSource) {
    throw new MemoryError(MEMORY_ERROR.FORBIDDEN_SOURCE, "source_required");
  }
  if (FORBIDDEN_SOURCES.has(rawSource)) {
    throw new MemoryError(MEMORY_ERROR.FORBIDDEN_SOURCE, `llm_write_denied:${rawSource}`);
  }
  if (!ALLOWED_SOURCES.has(rawSource as MemorySource)) {
    throw new MemoryError(MEMORY_ERROR.FORBIDDEN_SOURCE, `source_not_allowed:${rawSource}`);
  }
  const source = rawSource as MemorySource;

  if (input.key !== undefined) {
    const key = input.key.trim();
    if (!key || key.length > 128) {
      throw new MemoryError(MEMORY_ERROR.INVALID_INPUT, "invalid_key");
    }
    if (SENSITIVE_KEY_RE.test(key)) {
      throw new MemoryError(MEMORY_ERROR.SENSITIVE_KEY, `sensitive_key:${key}`);
    }
  }

  if (typeof input.confidence !== "number" || Number.isNaN(input.confidence)) {
    throw new MemoryError(MEMORY_ERROR.INVALID_INPUT, "invalid_confidence");
  }
  const confidence = Math.max(0, Math.min(1, input.confidence));

  if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) {
    throw new MemoryError(MEMORY_ERROR.INVALID_INPUT, "invalid_data");
  }
  const data = sanitizeData(input.data);

  const warnings: string[] = [];
  const low_confidence = confidence < LOW_CONFIDENCE_THRESHOLD;
  if (low_confidence) warnings.push("low_confidence");

  let expiresAt: string | undefined;
  if (input.expiresAt) {
    const t = Date.parse(input.expiresAt);
    if (Number.isNaN(t)) {
      throw new MemoryError(MEMORY_ERROR.INVALID_INPUT, "invalid_expires_at");
    }
    expiresAt = new Date(t).toISOString();
  }

  const out: ValidatedMemoryWrite = {
    family,
    type,
    data,
    source,
    confidence,
    low_confidence,
    warnings,
  };
  if (input.key?.trim()) out.key = input.key.trim();
  if (expiresAt) out.expiresAt = expiresAt;
  return out;
}
