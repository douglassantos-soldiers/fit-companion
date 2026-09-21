/**
 * Content recommendation — ranks editorial for “what is relevant now?”
 * Does not call computeDecisions and does not write recommendation_decisions.
 */
import {
  matchesTarget,
  pickEditorialItems as pickEditorialItemsByGoal,
  type ContentKind,
  type PublicContentItem,
} from "@/lib/content-match";
import type { ContentHit, ContentOsKind, ContentProgressFlag } from "@/lib/content/types";
import type { DecisionContextSnapshot } from "@/lib/engine/decision-context-snapshot";
import { CONTENT_OS_PROGRAM_SESSIONS } from "@/data/content-os-seed";

export type ContentRankInput = {
  context: {
    goal?: string | null;
    recovery?: { level?: string | null };
  };
  decisions: {
    trainingMode?: string;
    primaryAction?: string;
  };
  behavior?: {
    triggers?: Array<{ key: string; active?: boolean }>;
  };
};

export function rankInputFromSnapshot(snapshot: DecisionContextSnapshot): ContentRankInput {
  const input: ContentRankInput = {
    context: {
      goal: snapshot.context.goal,
      recovery: { level: snapshot.context.recovery.level },
    },
    decisions: {
      trainingMode: snapshot.decisions.trainingMode,
      primaryAction: snapshot.decisions.primaryAction,
    },
  };
  if (snapshot.behavior) {
    input.behavior = {
      triggers: snapshot.behavior.triggers.map((t) => ({ key: t.key, active: t.active })),
    };
  }
  return input;
}

function isLive(item: PublicContentItem, now: Date): boolean {
  if (!item.published) return false;
  if (item.visible === false) return false;
  if (item.publishAt && new Date(item.publishAt).getTime() > now.getTime()) return false;
  if (item.unpublishAt && new Date(item.unpublishAt).getTime() <= now.getTime()) return false;
  return true;
}

function preferredKind(input: ContentRankInput): ContentKind | null {
  const mode = input.decisions.trainingMode ?? "";
  const action = input.decisions.primaryAction ?? "";
  const recovery = input.context.recovery?.level ?? "";
  const triggers = (input.behavior?.triggers ?? []).filter((t) => t.active);

  if (mode === "rest" || recovery === "low" || action === "sleep" || action === "rest")
    return "recovery";
  if (mode === "full" || mode === "technique") return "technique";
  if (action === "meal") return "nutrition";
  if (triggers.length) return "education";
  return null;
}

function reasonFor(kind: ContentKind, preferred: ContentKind | null, matchedGoal: boolean): string {
  if (preferred && kind === preferred) return preferred;
  if (kind === "education" || kind === "motivation")
    return preferred === "education" ? "education" : "motivation";
  if (matchedGoal) return "goal_level";
  return "catalog";
}

export function resolveProgramSessionContentId(
  programId: string,
  week: number,
  day: number,
): string | null {
  const hit = CONTENT_OS_PROGRAM_SESSIONS.find(
    (s) => s.programId === programId && s.week === week && s.day === day && s.contentItemId,
  );
  return hit?.contentItemId ?? null;
}

export function recommendContent(
  input: ContentRankInput | DecisionContextSnapshot,
  catalog: PublicContentItem[],
  progress: ContentProgressFlag[] = [],
  now: Date = new Date(),
): ContentHit[] {
  const rankInput: ContentRankInput =
    "engineVersion" in input && "livingPlan" in input ? rankInputFromSnapshot(input) : input;
  const dismissed = new Set(progress.filter((p) => p.dismissed).map((p) => p.contentId));
  const saved = new Set(progress.filter((p) => p.saved).map((p) => p.contentId));
  const preferred = preferredKind(rankInput);
  const goal = rankInput.context.goal ?? null;
  const hits: ContentHit[] = [];

  for (const item of catalog) {
    if (!isLive(item, now)) continue;
    if (dismissed.has(item.id)) continue;
    if (!matchesTarget(item, goal, null)) continue;

    let score = 10;
    const matchedGoal = Boolean(goal && item.goals.includes(goal));
    if (matchedGoal) score += 8;
    if (preferred && item.kind === preferred) score += 20;
    if (preferred === "education" && (item.kind === "education" || item.kind === "motivation"))
      score += 15;
    if (saved.has(item.id)) score += 5;
    score += Math.max(0, 20 - item.sortOrder) * 0.1;

    const reason = reasonFor(item.kind, preferred, matchedGoal);
    hits.push({
      contentId: item.id,
      kind: item.kind as ContentOsKind,
      score: Math.round(score * 100) / 100,
      reason,
    });
  }
  hits.sort((a, b) => b.score - a.score || a.contentId.localeCompare(b.contentId));
  for (const hit of hits.slice(0, 3)) {
    console.info("content_rec", { contentId: hit.contentId, reason: hit.reason, kind: hit.kind });
  }
  return hits;
}

/** Wrapper: uses ranker when a snapshot/rank input exists; else goal/level. */
export function pickEditorialItems(
  items: PublicContentItem[],
  opts: {
    goal?: string | null;
    level?: string | null;
    date?: Date;
    preferKind?: ContentKind;
    snapshot?: DecisionContextSnapshot | ContentRankInput | null;
    progress?: ContentProgressFlag[];
  },
  limit = 2,
): PublicContentItem[] {
  if (!opts.snapshot) {
    return pickEditorialItemsByGoal(items, opts, limit);
  }
  const hits = recommendContent(opts.snapshot, items, opts.progress ?? [], opts.date ?? new Date());
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: PublicContentItem[] = [];
  for (const hit of hits) {
    const item = byId.get(hit.contentId);
    if (!item) continue;
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
