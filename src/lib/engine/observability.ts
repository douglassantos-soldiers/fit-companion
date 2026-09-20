/**
 * Structured engine observability — no secrets / minimal PII.
 */

export function logEngineDecision(entry: {
  userId: string;
  date: string;
  decisionId?: string | null;
  engine: string;
  decisionType: string;
  confidence?: number | null;
  reasonCodes?: string[];
  success: boolean;
  durationMs?: number;
  reason?: string;
}) {
  console.info(
    JSON.stringify({
      type: "engine_decision",
      user_id: entry.userId,
      date: entry.date,
      decision_id: entry.decisionId ?? null,
      engine: entry.engine,
      decision_type: entry.decisionType,
      confidence: entry.confidence ?? null,
      reason_codes: entry.reasonCodes ?? [],
      success: entry.success,
      duration_ms: entry.durationMs ?? null,
      reason: entry.reason?.slice(0, 160) ?? null,
      ts: new Date().toISOString(),
    }),
  );
}

export function logEngineError(entry: {
  userId?: string | null;
  engine: string;
  operation: string;
  errorCode?: string;
  message?: string;
}) {
  console.error(
    JSON.stringify({
      type: "engine_error",
      user_id: entry.userId ?? null,
      engine: entry.engine,
      operation: entry.operation,
      error_code: entry.errorCode ?? null,
      message: entry.message?.slice(0, 200) ?? null,
      ts: new Date().toISOString(),
    }),
  );
}

export function logSyncOp(entry: {
  userId: string;
  operation: string;
  table?: string;
  status: "ok" | "error" | "conflict" | "skipped";
  errorCode?: string;
}) {
  console.info(
    JSON.stringify({
      type: "sync_op",
      user_id: entry.userId,
      operation: entry.operation,
      table: entry.table ?? null,
      status: entry.status,
      error_code: entry.errorCode ?? null,
      ts: new Date().toISOString(),
    }),
  );
}
