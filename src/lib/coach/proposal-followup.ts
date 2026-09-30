import type { CoachProposal } from "@/lib/coach/types";
import { proposalAcceptLabel } from "@/lib/coach/apply-proposal";
import { todayKey } from "@/lib/types";

export type CoachProposalFollowUp = {
  proposalType: string;
  label: string;
  acceptedAt: string;
  acceptedDate: string;
  answeredAt?: string | null;
};

export function buildProposalFollowUp(
  proposal: CoachProposal,
  now = new Date(),
): CoachProposalFollowUp {
  return {
    proposalType: proposal.type,
    label: proposalAcceptLabel(proposal),
    acceptedAt: now.toISOString(),
    acceptedDate: todayKey(now),
    answeredAt: null,
  };
}

/** Show follow-up the calendar day after acceptance (until answered). */
export function shouldShowProposalFollowUp(
  followUp: CoachProposalFollowUp | null | undefined,
  now = new Date(),
): boolean {
  if (!followUp || followUp.answeredAt) return false;
  return todayKey(now) > followUp.acceptedDate;
}

export function proposalFollowUpQuestion(followUp: CoachProposalFollowUp): string {
  return `Ontem aceitei “${followUp.label}”. Como foi? O que ajusto hoje?`;
}

export function morningNarrationFromLiving(opts: {
  mode?: string | null;
  title?: string | null;
  estimatedMin?: number | null;
  energy?: string | null;
  sleepHours?: number | null;
}): string {
  const bits: string[] = [];
  if (opts.sleepHours != null && opts.sleepHours < 6) {
    bits.push(`Sono ${opts.sleepHours}h — ritmo mais cauteloso.`);
  }
  if (opts.energy === "baixa") bits.push("Energia baixa no check-in.");
  if (opts.mode === "express") {
    bits.push(
      `Plano express${opts.estimatedMin ? ` (~${opts.estimatedMin} min)` : ""}${opts.title ? `: ${opts.title}` : ""}.`,
    );
  } else if (opts.mode === "rest") {
    bits.push("Dia de descanso no plano — priorize sono e comida.");
  } else if (opts.mode === "deload") {
    bits.push(
      `Deload hoje${opts.title ? ` (${opts.title})` : ""} — volume reduzido de propósito.`,
    );
  } else if (opts.title) {
    bits.push(`Plano do dia: ${opts.title}${opts.estimatedMin ? ` · ~${opts.estimatedMin} min` : ""}.`);
  } else {
    bits.push("Check-in registrado — seguir o plano do dia.");
  }
  return bits.join(" ");
}
