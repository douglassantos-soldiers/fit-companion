export type AchievementId =
  | "first-workout"
  | "first-pr"
  | "streak-7"
  | "streak-30"
  | "workouts-100"
  | "volume-100k"
  | "first-challenge";

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  emoji: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first-workout",
    title: "Primeiro treino",
    description: "Complete sua primeira sessão.",
    emoji: "🏆",
  },
  {
    id: "first-pr",
    title: "Primeiro PR",
    description: "Bata um recorde pessoal de carga.",
    emoji: "🏆",
  },
  {
    id: "streak-7",
    title: "7 dias",
    description: "Treine 7 dias seguidos.",
    emoji: "🔥",
  },
  {
    id: "streak-30",
    title: "30 dias",
    description: "Treine 30 dias seguidos.",
    emoji: "🔥",
  },
  {
    id: "workouts-100",
    title: "100 treinos",
    description: "Complete 100 sessões.",
    emoji: "💯",
  },
  {
    id: "volume-100k",
    title: "100.000 kg",
    description: "Acumule 100 toneladas de volume.",
    emoji: "🏋️",
  },
  {
    id: "first-challenge",
    title: "Primeiro desafio",
    description: "Entre no seu primeiro desafio.",
    emoji: "🎯",
  },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<
  AchievementId,
  AchievementDef
>;

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_BY_ID[id as AchievementId];
}
