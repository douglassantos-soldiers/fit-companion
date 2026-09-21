import {
  CONTENT_OS_COLLECTIONS,
  CONTENT_OS_EXPERTS,
  CONTENT_OS_ITEMS,
  CONTENT_OS_PROGRAMS,
  CONTENT_OS_PROGRAM_SESSIONS,
} from "@/data/content-os-seed";
import type {
  ContentCollection,
  ContentProgram,
  Expert,
  ProgramSession,
} from "@/lib/content/types";
import type { PublicContentItem } from "@/lib/content-match";

let experts: Expert[] = [...CONTENT_OS_EXPERTS];
let programs: ContentProgram[] = [...CONTENT_OS_PROGRAMS];
let collections: ContentCollection[] = [...CONTENT_OS_COLLECTIONS];
let sessions: ProgramSession[] = [...CONTENT_OS_PROGRAM_SESSIONS];

export function setContentOsCatalog(next: {
  experts?: Expert[];
  programs?: ContentProgram[];
  collections?: ContentCollection[];
  sessions?: ProgramSession[];
}): void {
  if (next.experts) experts = next.experts;
  if (next.programs) programs = next.programs;
  if (next.collections) collections = next.collections;
  if (next.sessions) sessions = next.sessions;
}

export function listContentOsExperts(): Expert[] {
  return experts.filter((e) => e.active);
}

export function listContentOsPrograms(): ContentProgram[] {
  return programs.filter((p) => p.published);
}

export function listContentOsCollections(): ContentCollection[] {
  return collections.filter((c) => c.published).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function listContentOsSessions(programId?: string): ProgramSession[] {
  return programId ? sessions.filter((s) => s.programId === programId) : sessions;
}

export function mergeContentItems(
  seed: PublicContentItem[],
  overlay: PublicContentItem[],
): PublicContentItem[] {
  const map = new Map<string, PublicContentItem>();
  for (const row of seed) map.set(row.id, row);
  for (const row of overlay) map.set(row.id, { ...map.get(row.id), ...row });
  return [...map.values()];
}

export function defaultContentOsOverlay(): {
  experts: Expert[];
  programs: ContentProgram[];
  collections: ContentCollection[];
  sessions: ProgramSession[];
  content: PublicContentItem[];
} {
  return {
    experts: [...CONTENT_OS_EXPERTS],
    programs: [...CONTENT_OS_PROGRAMS],
    collections: [...CONTENT_OS_COLLECTIONS],
    sessions: [...CONTENT_OS_PROGRAM_SESSIONS],
    content: [...CONTENT_OS_ITEMS],
  };
}
