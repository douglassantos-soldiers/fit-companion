/** Seeded Performance Hubs (Creator OS MVP — consumer). Mirrors SQL seed. */

export interface HubSeed {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  creatorName: string;
  avatarUrl?: string;
  coverUrl?: string;
  challengeIds: string[];
}

export const HUBS: HubSeed[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    slug: "soldiers-performance",
    name: "Soldiers Performance Hub",
    tagline: "Consistência e evolução com a marca Soldiers — ranking por %.",
    creatorName: "Soldiers",
    challengeIds: ["evolucao-consistencia-14", "consistencia-21"],
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    slug: "projeto-massa-60",
    name: "Projeto Massa 60d",
    tagline: "60 dias de hipertrofia com ranking relativo — hub seed Soldiers.",
    creatorName: "Soldiers Coach",
    challengeIds: ["hub-massa-60", "evolucao-volume-21"],
  },
];

export const hubBySlug = (slug: string) => HUBS.find((h) => h.slug === slug);
export const hubById = (id: string) => HUBS.find((h) => h.id === id);

export function hubsForChallenge(challengeId: string) {
  return HUBS.filter((h) => h.challengeIds.includes(challengeId));
}

export function activeHubForState(joinedHubIds: string[] | undefined) {
  if (!joinedHubIds?.length) return null;
  for (const id of joinedHubIds) {
    const h = hubById(id);
    if (h) return h;
  }
  return null;
}
