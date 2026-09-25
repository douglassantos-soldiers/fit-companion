/**
 * Memory API — create / retrieve / update / invalidate (validated writes only).
 */

import type { MemoryRecord } from "@/ai/contracts/memory-record";
import { requireTrustedMemoryUser } from "@/ai/memory/core/auth";
import { MEMORY_ERROR, MemoryError } from "@/ai/memory/core/errors";
import { newMemoryId } from "@/ai/memory/core/ids";
import type {
  CreateMemoryInput,
  InvalidateMemoryInput,
  MemoryRetrieveResult,
  MemoryWriteResult,
  RetrieveMemoryInput,
  UpdateMemoryInput,
} from "@/ai/memory/core/types";
import { validateMemoryWrite } from "@/ai/memory/core/validate-write";
import { getMemoryStore } from "@/ai/memory/store/types";

function dataEqual(a: MemoryRecord["data"], b: MemoryRecord["data"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isExpired(record: MemoryRecord, now = Date.now()): boolean {
  if (!record.expires_at) return false;
  return Date.parse(record.expires_at) <= now;
}

function withExpiryStatus(record: MemoryRecord, now = Date.now()): MemoryRecord {
  if (record.status === "active" && isExpired(record, now)) {
    return { ...record, status: "expired" };
  }
  return record;
}

export async function createMemory(input: CreateMemoryInput): Promise<MemoryWriteResult> {
  const userId = requireTrustedMemoryUser(input.trustedUserId);
  const validated = validateMemoryWrite(input);
  const store = getMemoryStore();

  if (validated.key) {
    const existing = await store.findActiveByKey({
      userId,
      family: validated.family,
      type: validated.type,
      key: validated.key,
    });
    if (existing && !isExpired(existing)) {
      if (dataEqual(existing.data, validated.data)) {
        return { ok: true, record: existing, warnings: validated.warnings };
      }
      if (!input.supersede) {
        throw new MemoryError(
          MEMORY_ERROR.CONFLICTING_MEMORY,
          `conflict:${validated.family}:${validated.type}:${validated.key}`,
        );
      }
      const now = new Date().toISOString();
      await store.update({
        ...existing,
        status: "invalidated",
        updated_at: now,
      });
    }
  }

  const now = new Date().toISOString();
  const record: MemoryRecord = {
    memory_id: newMemoryId({
      userId,
      family: validated.family,
      type: validated.type,
    }),
    user_id: userId,
    family: validated.family,
    type: validated.type,
    data: validated.data,
    source: validated.source,
    confidence: validated.confidence,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  if (validated.key) record.key = validated.key;
  if (validated.expiresAt) record.expires_at = validated.expiresAt;
  if (validated.low_confidence) record.low_confidence = true;

  const saved = await store.insert(record);
  return { ok: true, record: saved, warnings: validated.warnings };
}

export async function retrieveMemory(input: RetrieveMemoryInput): Promise<MemoryRetrieveResult> {
  const userId = requireTrustedMemoryUser(input.trustedUserId);
  const store = getMemoryStore();
  const now = Date.now();

  const listed = await store.list({
    userId,
    ...(input.family ? { family: input.family } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.key !== undefined ? { key: input.key } : {}),
    includeInvalidated: Boolean(input.includeInvalidated),
    limit: input.limit ?? 100,
  });

  const minConf = input.minConfidence ?? 0;
  const records: MemoryRecord[] = [];

  for (const raw of listed) {
    // IDOR: store already filtered by userId; double-check
    if (raw.user_id !== userId) {
      throw new MemoryError(MEMORY_ERROR.USER_MISMATCH, "idor_blocked");
    }
    let r = withExpiryStatus(raw, now);
    if (r.status === "expired" && r.status !== raw.status) {
      // Persist expired mark lazily
      r = await store.update({ ...r, updated_at: new Date().toISOString() });
    }
    if (!input.includeExpired && r.status === "expired") continue;
    if (!input.includeInvalidated && r.status === "invalidated") continue;
    if (r.confidence < minConf) continue;
    records.push(r);
  }

  return { ok: true, records };
}

export async function updateMemory(input: UpdateMemoryInput): Promise<MemoryWriteResult> {
  const userId = requireTrustedMemoryUser(input.trustedUserId);
  const store = getMemoryStore();
  const existing = await store.getById(input.memoryId);
  if (!existing) {
    throw new MemoryError(MEMORY_ERROR.NOT_FOUND, "memory_not_found");
  }
  if (existing.user_id !== userId) {
    throw new MemoryError(MEMORY_ERROR.USER_MISMATCH, "idor_blocked");
  }

  const nextData = input.patch.data ?? existing.data;
  const nextSource = input.patch.source ?? existing.source;
  const nextConfidence =
    input.patch.confidence !== undefined ? input.patch.confidence : existing.confidence;
  const nextType = input.patch.type ?? existing.type;
  const nextKey = input.patch.key !== undefined ? input.patch.key : existing.key;

  let expiresAt: string | undefined = existing.expires_at;
  if (input.patch.expiresAt === null) expiresAt = undefined;
  else if (typeof input.patch.expiresAt === "string") expiresAt = input.patch.expiresAt;

  const validated = validateMemoryWrite({
    family: existing.family,
    type: nextType,
    data: nextData,
    source: nextSource,
    confidence: nextConfidence,
    ...(nextKey ? { key: nextKey } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  });

  const now = new Date().toISOString();
  const updated: MemoryRecord = {
    ...existing,
    type: validated.type,
    data: validated.data,
    source: validated.source,
    confidence: validated.confidence,
    updated_at: now,
    status: existing.status === "invalidated" ? "invalidated" : "active",
  };
  if (validated.key) updated.key = validated.key;
  else delete updated.key;
  if (validated.expiresAt) updated.expires_at = validated.expiresAt;
  else delete updated.expires_at;
  if (validated.low_confidence) updated.low_confidence = true;
  else delete updated.low_confidence;

  const saved = await store.update(updated);
  return { ok: true, record: saved, warnings: validated.warnings };
}

export async function invalidateMemory(input: InvalidateMemoryInput): Promise<MemoryWriteResult> {
  const userId = requireTrustedMemoryUser(input.trustedUserId);
  const store = getMemoryStore();
  const existing = await store.getById(input.memoryId);
  if (!existing) {
    throw new MemoryError(MEMORY_ERROR.NOT_FOUND, "memory_not_found");
  }
  if (existing.user_id !== userId) {
    throw new MemoryError(MEMORY_ERROR.USER_MISMATCH, "idor_blocked");
  }

  const now = new Date().toISOString();
  const updated: MemoryRecord = {
    ...existing,
    status: "invalidated",
    updated_at: now,
    data: {
      ...existing.data,
      ...(input.reason ? { invalidate_reason: input.reason.slice(0, 200) } : {}),
    },
  };
  const saved = await store.update(updated);
  return { ok: true, record: saved, warnings: [] };
}
