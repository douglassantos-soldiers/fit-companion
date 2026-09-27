/**
 * Observable conflict detection between specialist proposals.
 */

import type { DecisionProposal } from "@/lib/engine/decision-proposal";
import type { SafetyVerdict } from "@/lib/engine/safety";
import type { CollectedProposal } from "@/ai/decision-pipeline/collect";

export type ProposalConflictType =
  | "training_vs_recovery"
  | "nutrition_vs_performance"
  | "behavior_vs_safety"
  | "proposal_vs_safety"
  | "same_domain_incompatible"
  | "intensity_vs_rest";

export type ProposalConflict = {
  conflict_type: ProposalConflictType;
  a: DecisionProposal;
  b: DecisionProposal | null;
  detail: string;
};

const TRAINING_INTENSITY = new Set([
  "FULL_WORKOUT",
  "PROGRESSION",
  "EXPRESS_WORKOUT",
]);
const RECOVERY_PROTECT = new Set([
  "REST",
  "DELOAD",
  "INCREASE_RECOVERY",
  "SLEEP_FOCUS",
  "REDUCE_VOLUME",
  "EXPRESS_WORKOUT",
]);
const NUTRITION_TYPES = new Set(["NUTRITION_FOCUS", "HYDRATION_FOCUS"]);

export function domainOf(proposal: DecisionProposal): string {
  const t = proposal.proposed_type;
  if (TRAINING_INTENSITY.has(t) || t === "REDUCE_VOLUME" || t === "DELOAD") {
    if (t === "REST" || t === "INCREASE_RECOVERY" || t === "SLEEP_FOCUS") return "recovery";
    if (t === "DELOAD" || t === "REDUCE_VOLUME" || t === "EXPRESS_WORKOUT") {
      // dual — treat agent_id if present
      if (proposal.agent_id?.includes("recovery")) return "recovery";
      if (proposal.agent_id?.includes("training")) return "training";
    }
    return proposal.agent_id?.includes("recovery") ? "recovery" : "training";
  }
  if (RECOVERY_PROTECT.has(t) && (t === "REST" || t === "INCREASE_RECOVERY" || t === "SLEEP_FOCUS")) {
    return "recovery";
  }
  if (NUTRITION_TYPES.has(t)) return "nutrition";
  if (t === "CHECKIN") return "behavior";
  if (proposal.agent_id?.includes("performance")) return "performance";
  if (proposal.agent_id?.includes("recovery")) return "recovery";
  if (proposal.agent_id?.includes("nutrition")) return "nutrition";
  if (proposal.agent_id?.includes("behavior")) return "behavior";
  if (proposal.agent_id?.includes("training")) return "training";
  return "unknown";
}

function isIntensity(p: DecisionProposal): boolean {
  return (
    p.proposed_type === "FULL_WORKOUT" ||
    p.proposed_type === "PROGRESSION" ||
    (p.proposed_type === "EXPRESS_WORKOUT" && domainOf(p) === "training")
  );
}

function isRecoveryProtect(p: DecisionProposal): boolean {
  return (
    p.proposed_type === "REST" ||
    p.proposed_type === "SLEEP_FOCUS" ||
    p.proposed_type === "INCREASE_RECOVERY" ||
    (p.proposed_type === "DELOAD" && domainOf(p) === "recovery") ||
    (p.proposed_type === "EXPRESS_WORKOUT" && domainOf(p) === "recovery")
  );
}

export function detectProposalConflicts(
  candidates: CollectedProposal[],
  safety?: SafetyVerdict | null,
): ProposalConflict[] {
  const conflicts: ProposalConflict[] = [];
  const props = candidates.map((c) => c.proposal);

  for (let i = 0; i < props.length; i++) {
    for (let j = i + 1; j < props.length; j++) {
      const a = props[i]!;
      const b = props[j]!;
      if (isIntensity(a) && isRecoveryProtect(b)) {
        conflicts.push({
          conflict_type: "training_vs_recovery",
          a,
          b,
          detail: `${a.proposed_type}@${a.agent_id} vs ${b.proposed_type}@${b.agent_id}`,
        });
      } else if (isIntensity(b) && isRecoveryProtect(a)) {
        conflicts.push({
          conflict_type: "training_vs_recovery",
          a: b,
          b: a,
          detail: `${b.proposed_type}@${b.agent_id} vs ${a.proposed_type}@${a.agent_id}`,
        });
      }

      if (
        (NUTRITION_TYPES.has(a.proposed_type) && domainOf(b) === "performance") ||
        (NUTRITION_TYPES.has(b.proposed_type) && domainOf(a) === "performance")
      ) {
        conflicts.push({
          conflict_type: "nutrition_vs_performance",
          a,
          b,
          detail: "nutrition_adjustment_vs_performance_hold",
        });
      }

      if (
        domainOf(a) === domainOf(b) &&
        a.proposed_type !== b.proposed_type &&
        a.proposed_value !== b.proposed_value
      ) {
        conflicts.push({
          conflict_type: "same_domain_incompatible",
          a,
          b,
          detail: `same_domain=${domainOf(a)}:${a.proposed_type}!=${b.proposed_type}`,
        });
      }
    }
  }

  if (safety?.escalateCare) {
    for (const p of props) {
      const restAligned =
        p.proposed_type === "REST" ||
        p.proposed_type === "INCREASE_RECOVERY" ||
        p.proposed_type === "SLEEP_FOCUS" ||
        p.proposed_value === "rest" ||
        p.proposed_value === "sleep";
      if (!restAligned) {
        conflicts.push({
          conflict_type:
            domainOf(p) === "behavior" ? "behavior_vs_safety" : "proposal_vs_safety",
          a: p,
          b: null,
          detail: "escalateCare_requires_rest_aligned",
        });
      }
    }
  }

  return conflicts;
}
