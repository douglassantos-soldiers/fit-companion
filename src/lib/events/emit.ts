/**
 * Client-side event emission via offline outbox → server ingest.
 */
import { getDeviceId } from "@/lib/sync";
import { enqueueEvent, flushOutbox, type OutboxEventOp } from "@/lib/sync/outbox";
import { buildIdempotencyKey, normalizeEventType } from "@/lib/events/normalize";
import type { EmitUserEventInput } from "@/lib/events/types";

function newOpId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Enqueue a user event (works offline). Flushes best-effort when online. */
export function emitUserEvent(input: EmitUserEventInput): void {
  if (typeof window === "undefined") return;
  const deviceId = getDeviceId();
  if (!deviceId) return;

  const eventType = normalizeEventType(String(input.type ?? ""));
  if (!eventType) return;

  const metadata = input.metadata ?? {};
  const date =
    typeof metadata["date"] === "string"
      ? metadata["date"]
      : typeof metadata["occurredAt"] === "string"
        ? metadata["occurredAt"]
        : undefined;

  const idempotencyKey =
    input.idempotencyKey ??
    buildIdempotencyKey(eventType, {
      entityId: input.entityId,
      date: date?.slice(0, 10),
    }) ??
    newOpId();

  const op: OutboxEventOp = {
    opId: idempotencyKey,
    kind: "event",
    createdAt: new Date().toISOString(),
    deviceId,
    eventType,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    source: input.source ?? "app",
    idempotencyKey,
  };

  enqueueEvent(op);
  void flushOutbox().catch(() => undefined);
}

/** Fire-and-forget helper matching legacy emitAppEvent(deviceId, kind, payload). */
export function emitAppEventCompat(
  deviceId: string,
  kind: string,
  payload: Record<string, unknown> = {},
  opts?: { entityType?: string; entityId?: string; occurredAt?: string; idempotencyKey?: string },
): void {
  if (!deviceId) return;
  emitUserEvent({
    type: kind,
    metadata: payload,
    entityType: opts?.entityType,
    entityId: opts?.entityId,
    occurredAt: opts?.occurredAt,
    idempotencyKey: opts?.idempotencyKey,
  });
}
