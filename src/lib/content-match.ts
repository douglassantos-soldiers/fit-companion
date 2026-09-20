/**
 * Editorial content targeting by goal/level. No behavior recommender.
 */
import type { HabitLesson } from "@/data/habit-lessons";

export type ContentKind =
  | "article"
  | "tip"
  | "technique"
  | "nutrition"
  | "recovery"
  | "motivation";

export type PublicContentItem = {
  id: string;
  kind: ContentKind;
  title: string;
  body: string;
  mediaUrl?: string;
  goals: string[];
  levels: string[];
  published: boolean;
  sortOrder: number;
};

const KIND_RANK: Record<ContentKind, number> = {
  tip: 0,
  technique: 1,
  motivation: 2,
  nutrition: 3,
  recovery: 4,
  article: 5,
};

export function matchesTarget(
  item: PublicContentItem,
  goal?: string | null,
  level?: string | null,
): boolean {
  if (!item.published) return false;
  const goals = item.goals.filter(Boolean);
  const levels = item.levels.filter(Boolean);
  if (goals.length && goal && !goals.includes(goal)) return false;
  if (levels.length && level && !levels.includes(level)) return false;
  return true;
}

export function pickEditorialItem(
  items: PublicContentItem[],
  opts: { goal?: string | null; level?: string | null; date?: Date; preferKind?: ContentKind },
): PublicContentItem | null {
  const matched = items.filter((i) => matchesTarget(i, opts.goal, opts.level));
  if (!matched.length) return null;

  const specificity = (item: PublicContentItem) => {
    let score = 0;
    if (opts.goal && item.goals.includes(opts.goal)) score += 2;
    if (opts.level && item.levels.includes(opts.level)) score += 1;
    return score;
  };

  const ranked = [...matched].sort((a, b) => {
    const spec = specificity(b) - specificity(a);
    if (spec !== 0) return spec;
    if (opts.preferKind) {
      const pa = a.kind === opts.preferKind ? 0 : 1;
      const pb = b.kind === opts.preferKind ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    const kr = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (kr !== 0) return kr;
    return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "pt-BR");
  });

  const top = specificity(ranked[0]!);
  const pool = ranked.filter((i) => specificity(i) === top);
  const date = opts.date ?? new Date();
  const idx = Math.abs(Math.floor(date.getTime() / 86400000)) % pool.length;
  return pool[idx] ?? pool[0]!;
}

/** Up to `limit` distinct editorial items for For You (goal/level targeting). */
export function pickEditorialItems(
  items: PublicContentItem[],
  opts: { goal?: string | null; level?: string | null; date?: Date; preferKind?: ContentKind },
  limit = 2,
): PublicContentItem[] {
  const out: PublicContentItem[] = [];
  let pool = items.filter((i) => i.published);
  const base = opts.date ?? new Date();
  for (let i = 0; i < limit; i += 1) {
    const picked = pickEditorialItem(pool, { ...opts, date: new Date(base.getTime() + i * 86_400_000) });
    if (!picked) break;
    out.push(picked);
    pool = pool.filter((x) => x.id !== picked.id);
  }
  return out;
}

export function contentExcerpt(body: string): string {
  return firstSentence(body);
}

function firstSentence(body: string): string {
  const t = body.trim();
  const m = t.match(/^.{8,140}?[.!?]/);
  if (m) return m[0]!;
  return t.slice(0, 140);
}

export function contentToLesson(item: PublicContentItem): HabitLesson {
  return {
    id: `cms:${item.id}`,
    title: item.title,
    body: item.body,
    tip: firstSentence(item.body) || item.title,
  };
}

let published: PublicContentItem[] = [];

export function setPublishedContent(items: PublicContentItem[]): void {
  published = items.filter((i) => i.published);
}

export function listPublishedContent(): PublicContentItem[] {
  return published;
}

export function getPublishedContentById(id: string): PublicContentItem | undefined {
  return published.find((i) => i.id === id);
}

export function pickEditorialLesson(
  targeting: { goal?: string | null; level?: string | null } | null | undefined,
  date: Date = new Date(),
): HabitLesson | null {
  const opts: {
    date: Date;
    goal?: string | null;
    level?: string | null;
  } = { date };
  if (targeting?.goal !== undefined) opts.goal = targeting.goal;
  if (targeting?.level !== undefined) opts.level = targeting.level;
  const item = pickEditorialItem(published, opts);
  return item ? contentToLesson(item) : null;
}
