/**
 * Structured decision evidence — metrics that produced a decision (Phase 5).
 * Prefer numbers over prose; notes are optional human fragments.
 * `items` add provenance for AI/Coach explainability without inventing thresholds.
 */

export type DecisionEvidenceItem = {
  signal: string;
  value: string | number | boolean | null;
  source: string;
  observedAt: string;
  relevance: "high" | "medium" | "low";
  confidence: number;
};

export type DecisionEvidence = {
  metrics: Record<string, number | string | boolean | null>;
  /** Provenance-rich signals for Coach / Proposal validation (optional). */
  items?: DecisionEvidenceItem[];
  notes?: string[];
};

export function emptyEvidence(): DecisionEvidence {
  return { metrics: {} };
}

export function evidenceFromMetrics(
  metrics: Record<string, number | string | boolean | null>,
  notes?: string[],
): DecisionEvidence {
  const out: DecisionEvidence = { metrics: { ...metrics } };
  if (notes?.length) out.notes = notes.slice(0, 8);
  return out;
}

/** Build evidence bag from context snapshot fields commonly used in decisions. */
export function evidenceFromSnapshotLike(snap: {
  sleepHours?: number | null;
  energy?: string | null;
  availableMin?: number | null;
  recoveryScore?: number | null;
  hardRpeStreak?: number | null;
  proteinAdherence?: number | null;
  confidenceBase?: number | null;
}): DecisionEvidence {
  const metrics: DecisionEvidence["metrics"] = {};
  if (snap.sleepHours != null) metrics["sleepHours"] = snap.sleepHours;
  if (snap.energy != null) metrics["energy"] = snap.energy;
  if (snap.availableMin != null) metrics["availableMin"] = snap.availableMin;
  if (snap.recoveryScore != null) metrics["recovery"] = snap.recoveryScore;
  if (snap.hardRpeStreak != null) metrics["hardRpeStreak"] = snap.hardRpeStreak;
  if (snap.proteinAdherence != null) metrics["proteinAdherence"] = snap.proteinAdherence;
  if (snap.confidenceBase != null) metrics["confidenceBase"] = snap.confidenceBase;
  return { metrics };
}

/**
 * Build provenance items from a DecisionContextSnapshot-like context slice.
 * Keeps metrics for ledger; items for AI explain / Proposal audit.
 */
export function evidenceItemsFromContext(opts: {
  date: string;
  sleepHours: number | null;
  sleepSource: string;
  energy: string | null;
  availableMin: number | null;
  recoveryScore: number | null;
  recoverySource?: string;
  hardRpeStreak: number | null;
  proteinAdherence: number | null;
  confidenceBase: number;
}): DecisionEvidenceItem[] {
  const conf = Math.max(0.35, Math.min(0.95, opts.confidenceBase));
  const items: DecisionEvidenceItem[] = [];
  if (opts.sleepHours != null) {
    items.push({
      signal: "sleepHours",
      value: opts.sleepHours,
      source: opts.sleepSource || "unknown",
      observedAt: opts.date,
      relevance: "high",
      confidence: conf,
    });
  }
  if (opts.energy != null) {
    items.push({
      signal: "energy",
      value: opts.energy,
      source: "checkin",
      observedAt: opts.date,
      relevance: "high",
      confidence: conf,
    });
  }
  if (opts.availableMin != null) {
    items.push({
      signal: "availableTimeMin",
      value: opts.availableMin,
      source: "checkin",
      observedAt: opts.date,
      relevance: "medium",
      confidence: conf,
    });
  }
  if (opts.recoveryScore != null) {
    items.push({
      signal: "recoveryScore",
      value: opts.recoveryScore,
      source: opts.recoverySource ?? "derived",
      observedAt: opts.date,
      relevance: "high",
      confidence: conf,
    });
  }
  if (opts.hardRpeStreak != null) {
    items.push({
      signal: "hardRpeStreak",
      value: opts.hardRpeStreak,
      source: "sessions",
      observedAt: opts.date,
      relevance: opts.hardRpeStreak >= 2 ? "high" : "low",
      confidence: conf,
    });
  }
  if (opts.proteinAdherence != null) {
    items.push({
      signal: "proteinAdherence",
      value: opts.proteinAdherence,
      source: "nutrition",
      observedAt: opts.date,
      relevance: "medium",
      confidence: conf,
    });
  }
  return items;
}

export function mergeEvidence(
  base: DecisionEvidence,
  extra: Partial<DecisionEvidence>,
): DecisionEvidence {
  const items = [...(base.items ?? []), ...(extra.items ?? [])];
  const out: DecisionEvidence = {
    metrics: { ...base.metrics, ...(extra.metrics ?? {}) },
    notes: [...(base.notes ?? []), ...(extra.notes ?? [])].slice(0, 8),
  };
  if (items.length) out.items = items.slice(0, 24);
  return out;
}
