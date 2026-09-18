/**
 * Offline outbox: device = cache + queue; server = source of truth.
 * Persists in localStorage (no IndexedDB in FASE 3).
 */
import { trackAppUserEvent } from "@/lib/events.functions";

const OUTBOX_KEY = "soldiers-outbox-v1";
const MAX_OPS = 200;
const MAX_ATTEMPTS = 8;

export type OutboxEventOp = {
  opId: string;
  kind: "event";
  createdAt: string;
  deviceId: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  source: string;
  idempotencyKey: string;
  attempts?: number;
  nextAttemptAt?: string;
};

export type OutboxEntityOp = {
  opId: string;
  kind: "entity";
  createdAt: string;
  deviceId: string;
  entity: "day_checkin";
  payload: Record<string, unknown>;
  version?: number;
  attempts?: number;
  nextAttemptAt?: string;
};

export type OutboxOp = OutboxEventOp | OutboxEntityOp;

let flushing = false;
let listenersBound = false;

function readQueue(): OutboxOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: OutboxOp[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops.slice(-MAX_OPS)));
  } catch {
    /* quota / private mode */
  }
}

export function enqueueEvent(op: OutboxEventOp): void {
  const q = readQueue();
  if (q.some((x) => x.opId === op.opId)) return;
  q.push(op);
  writeQueue(q);
  ensureOutboxListeners();
}

export function enqueueEntity(op: OutboxEntityOp): void {
  const q = readQueue();
  // Replace pending op for same day_checkin date if present
  if (op.entity === "day_checkin" && typeof op.payload["date"] === "string") {
    const date = String(op.payload["date"]);
    const filtered = q.filter(
      (x) =>
        !(
          x.kind === "entity" &&
          x.entity === "day_checkin" &&
          String((x as OutboxEntityOp).payload["date"]) === date
        ),
    );
    filtered.push(op);
    writeQueue(filtered);
  } else {
    if (q.some((x) => x.opId === op.opId)) return;
    q.push(op);
    writeQueue(q);
  }
  ensureOutboxListeners();
}

export function peekOutbox(): OutboxOp[] {
  return readQueue();
}

export function clearOutbox(): void {
  writeQueue([]);
}

function backoffMs(attempts: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.min(attempts, 5));
}

async function flushOne(op: OutboxOp): Promise<boolean> {
  if (op.kind === "event") {
    const res = await trackAppUserEvent({
      data: {
        deviceId: op.deviceId,
        eventType: op.eventType,
        source: op.source,
        metadata: op.metadata,
        entityType: op.entityType ?? undefined,
        entityId: op.entityId ?? undefined,
        occurredAt: op.occurredAt,
        idempotencyKey: op.idempotencyKey,
      },
    });
    return res?.ok !== false;
  }

  if (op.kind === "entity" && op.entity === "day_checkin") {
    const { upsertDayCheckInFn } = await import("@/lib/sync.functions");
    const res = await upsertDayCheckInFn({
      data: {
        deviceId: op.deviceId,
        checkIn: op.payload,
        version: op.version ?? 1,
      },
    });
    return res?.ok === true || res?.conflict === true;
  }

  return false;
}

/** Drain outbox when online. Safe to call repeatedly. */
export async function flushOutbox(): Promise<{ flushed: number; remaining: number }> {
  if (typeof window === "undefined") return { flushed: 0, remaining: 0 };
  if (flushing) return { flushed: 0, remaining: readQueue().length };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { flushed: 0, remaining: readQueue().length };
  }

  flushing = true;
  let flushed = 0;
  try {
    let q = readQueue();
    const now = Date.now();
    const keep: OutboxOp[] = [];

    for (const op of q) {
      const attempts = op.attempts ?? 0;
      const nextAt = op.nextAttemptAt ? Date.parse(op.nextAttemptAt) : 0;
      if (nextAt && nextAt > now) {
        keep.push(op);
        continue;
      }

      try {
        const ok = await flushOne(op);
        if (ok) {
          flushed += 1;
          continue;
        }
      } catch {
        /* retry */
      }

      const nextAttempts = attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        // Drop after max attempts to avoid infinite poison
        continue;
      }
      keep.push({
        ...op,
        attempts: nextAttempts,
        nextAttemptAt: new Date(now + backoffMs(nextAttempts)).toISOString(),
      });
    }

    writeQueue(keep);
    return { flushed, remaining: keep.length };
  } finally {
    flushing = false;
  }
}

export function ensureOutboxListeners(): void {
  if (typeof window === "undefined" || listenersBound) return;
  listenersBound = true;
  window.addEventListener("online", () => {
    void flushOutbox();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushOutbox();
  });
}
