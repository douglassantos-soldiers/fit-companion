import type { SupplementProduct } from "@/data/products";
import { PRODUCTS, productById } from "@/data/products";
import { todayKey } from "@/lib/types";

export type TimingSlot = "manha" | "pre" | "pos" | "noite" | "qualquer";

const SLOT_WINDOWS: Record<Exclude<TimingSlot, "qualquer">, [number, number]> = {
  manha: [6, 11],
  pre: [11, 16],
  pos: [16, 20],
  noite: [20, 24],
};

export function timingSlot(timing: string): TimingSlot {
  const t = timing.toLowerCase();
  if (t.includes("qualquer")) return "qualquer";
  if (
    t.includes("café") ||
    t.includes("cafe") ||
    t.includes("manhã") ||
    t.includes("manha") ||
    t.includes("almoço") ||
    t.includes("almoco") ||
    t.includes("entre refeições") ||
    t.includes("entre refeicoes")
  )
    return "manha";
  if (t.includes("antes") || t.includes("pré") || t.includes("pre")) return "pre";
  if (t.includes("pós") || t.includes("pos")) return "pos";
  if (t.includes("dormir") || t.includes("noite")) return "noite";
  return "qualquer";
}

export function currentSlot(now = new Date()): Exclude<TimingSlot, "qualquer"> {
  const h = now.getHours();
  if (h >= 6 && h < 11) return "manha";
  if (h >= 11 && h < 16) return "pre";
  if (h >= 16 && h < 20) return "pos";
  return "noite";
}

export function suggestSupplementNow(
  routineIds: string[],
  goalProducts: SupplementProduct[],
  takenIds: string[],
  now = new Date(),
): SupplementProduct | null {
  const slot = currentSlot(now);
  const list =
    routineIds.length > 0
      ? routineIds.map((id) => productById(id)).filter((p): p is SupplementProduct => Boolean(p))
      : goalProducts;

  const pending = list.filter((p) => !takenIds.includes(p.id));
  const inWindow = pending.find((p) => {
    const s = timingSlot(p.timing);
    return s === slot || s === "qualquer";
  });
  return inWindow ?? pending[0] ?? null;
}

/** Doses esperadas por dia = tamanho da rotina (1 dose/produto/dia). */
export function expectedDosesToday(routineIds: string[]) {
  return Math.max(0, routineIds.length);
}

export function dosesTakenToday(supplementLogs: Record<string, string[]>, routineIds: string[], date = todayKey()) {
  const taken = supplementLogs[date] ?? [];
  return routineIds.filter((id) => taken.includes(id)).length;
}

/** Aderência do mês: doses tomadas / (rotina × dias decorridos no mês). */
export function monthlyDoseAdherence(
  supplementLogs: Record<string, string[]>,
  routineIds: string[],
  now = new Date(),
) {
  if (!routineIds.length) return { pct: 0, expected: 0, taken: 0, days: 0 };

  const year = now.getFullYear();
  const month = now.getMonth();
  const daysElapsed = now.getDate();
  const expected = routineIds.length * daysElapsed;
  let taken = 0;

  for (let d = 1; d <= daysElapsed; d += 1) {
    const date = todayKey(new Date(year, month, d));
    const logs = supplementLogs[date] ?? [];
    taken += routineIds.filter((id) => logs.includes(id)).length;
  }

  const pct = expected > 0 ? Math.min(100, Math.round((taken / expected) * 100)) : 0;
  return { pct, expected, taken, days: daysElapsed };
}

export function weeklySupplementAdherence(
  supplementLogs: Record<string, string[]>,
  routineIds: string[],
  days = 7,
) {
  const out: { label: string; pct: number; taken: number; expected: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayKey(d);
    const expected = routineIds.length;
    const taken = dosesTakenToday(supplementLogs, routineIds, date);
    out.push({
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      expected,
      taken,
      pct: expected ? Math.round((taken / expected) * 100) : 0,
    });
  }
  return out;
}

export { PRODUCTS, SLOT_WINDOWS };
