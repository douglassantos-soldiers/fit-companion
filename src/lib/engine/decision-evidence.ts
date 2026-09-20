/**
 * Structured decision evidence — metrics that produced a decision (Phase 5).
 * Prefer numbers over prose; notes are optional human fragments.
 */

export type DecisionEvidence = {
  metrics: Record<string, number | string | boolean | null>;
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

export function mergeEvidence(
  base: DecisionEvidence,
  extra: Partial<DecisionEvidence>,
): DecisionEvidence {
  return {
    metrics: { ...base.metrics, ...(extra.metrics ?? {}) },
    notes: [...(base.notes ?? []), ...(extra.notes ?? [])].slice(0, 8),
  };
}
