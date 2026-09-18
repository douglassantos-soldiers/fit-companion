import { sessionsInLastDays } from "@/lib/engine/dimensions";
import type { AppState } from "@/lib/types";
import { todayKey } from "@/lib/types";

export interface ProofOfPerformance {
  periodDays: number;
  scoreNow: number;
  scoreThen: number;
  scoreDelta: number;
  volumeNow: number;
  volumeThen: number;
  volumeDeltaPct: number;
  consistencyDelta: number;
  weakestImproved: { key: string; label: string; delta: number } | null;
  narrative: string;
}

function volumeInWindow(sessions: AppState["sessions"], days: number, end = new Date()) {
  const limit = new Date(end);
  limit.setDate(limit.getDate() - days);
  return Math.round(
    sessions
      .filter((s) => {
        const d = new Date(s.date);
        return d >= limit && d <= end;
      })
      .reduce((acc, s) => acc + s.volumeKg, 0),
  );
}

function scoreFromSnap(scores: Record<string, number> | undefined) {
  if (!scores) return 0;
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** Build Proof of Performance from dimension snapshots + sessions. */
export function buildProofOfPerformance(state: AppState, periodDays = 21): ProofOfPerformance {
  const snaps = [...(state.dimensionSnapshots ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const nowKey = todayKey();
  const thenDate = new Date();
  thenDate.setDate(thenDate.getDate() - periodDays);
  const thenKey = todayKey(thenDate);

  const latest = snaps.filter((s) => s.date <= nowKey).at(-1);
  const earliest = snaps.filter((s) => s.date <= thenKey).at(-1) ?? snaps[0];

  const liveScore = latest
    ? scoreFromSnap(latest.scores)
    : (() => {
        const recent = sessionsInLastDays(state.sessions, periodDays);
        return Math.min(100, 40 + recent.length * 8);
      })();

  const scoreThen = earliest ? scoreFromSnap(earliest.scores) : liveScore;
  const scoreDelta = liveScore - scoreThen;

  const volumeNow = volumeInWindow(state.sessions, periodDays);
  const mid = new Date();
  mid.setDate(mid.getDate() - periodDays);
  const volumeThen = volumeInWindow(state.sessions, periodDays, mid);
  const volumeDeltaPct = ((volumeNow - volumeThen) / Math.max(volumeThen, 1)) * 100;

  const consistencyNow = latest?.scores?.["consistencia"] ?? 0;
  const consistencyThen = earliest?.scores?.["consistencia"] ?? consistencyNow;
  const consistencyDelta = consistencyNow - consistencyThen;

  let weakestImproved: ProofOfPerformance["weakestImproved"] = null;
  if (latest && earliest) {
    let best: { key: string; delta: number } | null = null;
    for (const [key, score] of Object.entries(latest.scores)) {
      const prev = earliest.scores[key] ?? score;
      const delta = score - prev;
      if (!best || delta > best.delta) best = { key, delta };
    }
    if (best && best.delta > 0) {
      const labels: Record<string, string> = {
        forca: "Força",
        resistencia: "Resistência",
        consistencia: "Consistência",
        recuperacao: "Recuperação",
        nutricao: "Nutrição",
        sono: "Sono",
        habitos: "Hábitos",
        suplementacao: "Suplementação",
      };
      weakestImproved = {
        key: best.key,
        label: labels[best.key] ?? best.key,
        delta: Math.round(best.delta),
      };
    }
  }

  const narrativeParts: string[] = [];
  if (scoreDelta !== 0) {
    narrativeParts.push(
      `Score ${scoreDelta > 0 ? "+" : ""}${Math.round(scoreDelta)} em ${periodDays} dias`,
    );
  }
  if (Math.abs(volumeDeltaPct) >= 5) {
    narrativeParts.push(`volume ${volumeDeltaPct >= 0 ? "+" : ""}${Math.round(volumeDeltaPct)}%`);
  }
  if (weakestImproved) {
    narrativeParts.push(`${weakestImproved.label} +${weakestImproved.delta}`);
  }
  const narrative =
    narrativeParts.length > 0
      ? `Proof of Performance: ${narrativeParts.join(" · ")}.`
      : `Proof of Performance: ${periodDays} dias de jornada Soldiers.`;

  return {
    periodDays,
    scoreNow: liveScore,
    scoreThen,
    scoreDelta: Math.round(scoreDelta),
    volumeNow,
    volumeThen,
    volumeDeltaPct: Math.round(volumeDeltaPct * 10) / 10,
    consistencyDelta: Math.round(consistencyDelta),
    weakestImproved,
    narrative,
  };
}

/** Pure helper for ranking demos / tests: who wins relative ranking. */
export function relativeRankOrder(
  rows: Array<{ id: string; current: number; baseline: number }>,
): string[] {
  return [...rows]
    .map((r) => ({
      id: r.id,
      pct: ((r.current - r.baseline) / Math.max(r.baseline, 1)) * 100,
    }))
    .sort((a, b) => b.pct - a.pct)
    .map((r) => r.id);
}
