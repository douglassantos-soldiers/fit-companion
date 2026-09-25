/**
 * Stable loop fingerprint for plan selection.
 */

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

export function planFingerprint(parts: {
  intent: string;
  agents: string[];
  skills: string[];
  tools: string[];
}): string {
  const norm = [
    parts.intent.trim().toLowerCase(),
    [...parts.agents].sort().join(","),
    [...parts.skills].sort().join(","),
    [...parts.tools].sort().join(","),
  ].join("|");
  return `fp_${djb2(norm)}`;
}

export function newPlanId(): string {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
