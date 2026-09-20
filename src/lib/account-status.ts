/**
 * Account status helpers (no health data).
 * suspended with expired statusUntil behaves as active.
 */
export type AccountStatus = "active" | "suspended" | "banned";

export type AccountStatusRow = {
  status: string | null;
  statusUntil: string | null;
};

export function normalizeAccountStatus(raw: string | null | undefined): AccountStatus {
  if (raw === "suspended" || raw === "banned") return raw;
  return "active";
}

export function isAccountBlocked(
  row: AccountStatusRow | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!row) return false;
  const status = normalizeAccountStatus(row.status);
  if (status === "banned") return true;
  if (status !== "suspended") return false;
  if (!row.statusUntil) return true;
  const until = Date.parse(row.statusUntil);
  if (Number.isNaN(until)) return true;
  return until > nowMs;
}
