/** Local calendar date from YYYY-MM-DD (noon avoids TZ day-shift). */
export function parseDateKeyLocal(dateKey: string): Date {
  return new Date(`${dateKey.slice(0, 10)}T12:00:00`);
}

export function formatDatePt(
  input: string | Date,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", opts);
}

export function formatDateKeyPtBr(
  dateKey: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" },
): string {
  return parseDateKeyLocal(dateKey).toLocaleDateString("pt-BR", opts);
}

export function formatDayMonth(dateKeyOrIso: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateKeyOrIso)) {
    return formatDateKeyPtBr(dateKeyOrIso);
  }
  return formatDatePt(dateKeyOrIso, { day: "2-digit", month: "2-digit" });
}

export function formatChartLabel(dateKey: string): string {
  return formatDateKeyPtBr(dateKey, { day: "2-digit", month: "2-digit" });
}
