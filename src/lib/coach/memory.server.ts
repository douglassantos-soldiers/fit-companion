/**
 * Coach memory — facts/preferences/patterns/notes only (not full chat dump).
 */
import { adminDbLoose } from "@/lib/db-admin";
import type { CoachMemoryEntry, CoachMemoryKind } from "@/lib/coach/types";

const CAP_PER_KIND = 20;

export async function loadCoachMemory(userId: string): Promise<CoachMemoryEntry[]> {
  try {
    const db = await adminDbLoose();
    if (!db || !userId) return [];
    const { data, error } = await db
      .from("coach_memories")
      .select("kind, key, value, confidence, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(80);
    if (error) return [];
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      kind: r["kind"] as CoachMemoryKind,
      key: String(r["key"] ?? ""),
      value: (r["value"] ?? {}) as CoachMemoryEntry["value"],
      confidence: Number(r["confidence"] ?? 0.7),
      updatedAt: String(r["updated_at"] ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

export async function upsertCoachMemory(opts: {
  userId: string;
  kind: CoachMemoryKind;
  key: string;
  value: CoachMemoryEntry["value"];
  confidence?: number;
}): Promise<{ ok: boolean }> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return { ok: false };
    const { error } = await db.from("coach_memories").upsert(
      {
        user_id: opts.userId,
        kind: opts.kind,
        key: opts.key.slice(0, 120),
        value: opts.value,
        confidence: opts.confidence ?? 0.7,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,kind,key" },
    );
    if (error) {
      console.warn("coach_memories upsert", error);
      return { ok: false };
    }
    await trimCoachMemory(opts.userId, opts.kind);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function trimCoachMemory(userId: string, kind: CoachMemoryKind) {
  try {
    const db = await adminDbLoose();
    if (!db) return;
    const { data } = await db
      .from("coach_memories")
      .select("id, updated_at")
      .eq("user_id", userId)
      .eq("kind", kind)
      .order("updated_at", { ascending: false });
    const rows = (data ?? []) as Array<{ id: string }>;
    if (rows.length <= CAP_PER_KIND) return;
    const drop = rows.slice(CAP_PER_KIND).map((r) => r.id);
    if (drop.length) await db.from("coach_memories").delete().in("id", drop);
  } catch {
    /* best-effort */
  }
}

/** Persist a short session summary (not full transcript). */
export async function touchCoachSession(opts: {
  userId: string;
  clientId: string;
  summary?: string;
  messageCount?: number;
}): Promise<void> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return;
    await db.from("coach_sessions").upsert(
      {
        user_id: opts.userId,
        client_id: opts.clientId,
        summary: (opts.summary ?? "").slice(0, 500),
        message_count: opts.messageCount ?? 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,client_id" },
    );
  } catch {
    /* optional */
  }
}

export async function persistCoachProposal(opts: {
  userId: string;
  date: string;
  type: string;
  action: string;
  value: unknown;
  reasonCodes: string[];
  evidence: Record<string, unknown>;
  confidence: number;
  status?: string;
}): Promise<{ ok: boolean }> {
  try {
    const db = await adminDbLoose();
    if (!db || !opts.userId) return { ok: false };
    const { error } = await db.from("coach_proposals").insert({
      user_id: opts.userId,
      date: opts.date,
      type: opts.type,
      action: opts.action,
      value: { value: opts.value },
      reason_codes: opts.reasonCodes,
      evidence: opts.evidence,
      confidence: opts.confidence,
      status: opts.status ?? "proposed",
    });
    if (error) {
      console.warn("coach_proposals insert", error);
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
