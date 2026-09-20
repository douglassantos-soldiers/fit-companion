/**
 * Derive challenge proof from activity logs (steps / football).
 */
import type { ActivityLogEntry, ProofSource, ProofStatus } from "@/lib/types";

export function isActivityProofMetric(metric: string): boolean {
  return metric === "steps" || metric === "football_sessions";
}

function kindForMetric(metric: string): ActivityLogEntry["kind"] | null {
  if (metric === "steps") return "steps";
  if (metric === "football_sessions") return "football";
  return null;
}

function inWindow(date: string, days: number, end = new Date()): boolean {
  const limit = new Date(end);
  limit.setDate(limit.getDate() - days);
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  return d >= limit && d <= end;
}

export function challengeProofFromLogs(
  metric: string,
  logs: ActivityLogEntry[],
  windowDays = 30,
  end = new Date(),
): { status: ProofStatus; source: ProofSource } {
  if (!isActivityProofMetric(metric)) {
    return { status: "self_reported", source: "app_session" };
  }
  const kind = kindForMetric(metric);
  const windowed = logs.filter((l) => l.kind === kind && inWindow(l.date, windowDays, end));
  const verified = windowed.find((l) => l.status === "verified");
  if (verified) return { status: "verified", source: verified.source };
  const pending = windowed.find((l) => l.status === "pending");
  if (pending) return { status: "pending", source: pending.source };
  return { status: "self_reported", source: "app_manual" };
}

/** Client-side ranking filter. Re-ranks after dropping self-report / pending. */
export function filterLeaderboardByProof<T extends { proofStatus?: ProofStatus; rank: number }>(
  rows: T[],
  verifiedOnly: boolean,
): T[] {
  const kept = verifiedOnly ? rows.filter((r) => r.proofStatus === "verified") : rows;
  return kept.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function proofStatusLabel(status: ProofStatus | undefined): string {
  if (status === "verified") return "Verificado";
  if (status === "pending") return "Pendente";
  return "Auto-relatado";
}
