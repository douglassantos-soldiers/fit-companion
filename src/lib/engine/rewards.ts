export interface CosmeticReward {
  id: string;
  title: string;
  rarity: "comum" | "raro";
}

const REWARDS: CosmeticReward[] = [
  { id: "chest-flame", title: "Chama da semana", rarity: "comum" },
  { id: "chest-iron", title: "Disciplina de ferro", rarity: "comum" },
  { id: "chest-ghost", title: "Soldado fantasma", rarity: "raro" },
  { id: "chest-legend", title: "Lenda do clube", rarity: "raro" },
];

/** ~25% chance of a cosmetic badge when daily XP goal is met; rare ~8%. */
export function rollCosmeticReward(): CosmeticReward | null {
  if (Math.random() > 0.25) return null;
  const rare = Math.random() < 0.32;
  const pool = REWARDS.filter((r) => (rare ? r.rarity === "raro" : r.rarity === "comum"));
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function cosmeticById(id: string): CosmeticReward | undefined {
  return REWARDS.find((r) => r.id === id);
}
