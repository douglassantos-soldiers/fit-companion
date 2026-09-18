export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: "sessoes" | "volume" | "dias";
  /** Absolute target (sessions/kg). Used when rankingMode is absolute. */
  target: number;
  unit: string;
  durationDays: number;
  participants: number;
  /** Requires accessTier performance */
  requiresPerformance?: boolean;
  /** absolute = raw value; relative = % evolution vs baseline at join */
  rankingMode?: "absolute" | "relative";
  /** For relative challenges: complete when pct evolution >= this */
  targetPct?: number;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "consistencia-21",
    title: "21 dias de consistência",
    description: "Treine 12 vezes em 21 dias e cimente o hábito.",
    metric: "sessoes",
    target: 12,
    unit: "treinos",
    durationDays: 21,
    participants: 1840,
    rankingMode: "absolute",
  },
  {
    id: "volume-50k",
    title: "50.000 kg de volume",
    description: "Some 50 toneladas de carga levantada no mês.",
    metric: "volume",
    target: 50000,
    unit: "kg",
    durationDays: 30,
    participants: 962,
    requiresPerformance: true,
    rankingMode: "absolute",
  },
  {
    id: "semana-perfeita",
    title: "Semana perfeita",
    description: "Cumpra todos os treinos planejados da semana.",
    metric: "sessoes",
    target: 5,
    unit: "treinos",
    durationDays: 7,
    participants: 3120,
    rankingMode: "absolute",
  },
  {
    id: "maratona-100",
    title: "100 treinos no ano",
    description: "O desafio de longo prazo dos veteranos Soldiers.",
    metric: "sessoes",
    target: 100,
    unit: "treinos",
    durationDays: 365,
    participants: 508,
    requiresPerformance: true,
    rankingMode: "absolute",
  },
  {
    id: "evolucao-volume-21",
    title: "Evolução de volume +20%",
    description: "Aumente seu volume de treino em 20% em 21 dias — ranking por % vs seu baseline.",
    metric: "volume",
    target: 20,
    unit: "%",
    durationDays: 21,
    participants: 420,
    rankingMode: "relative",
    targetPct: 20,
    requiresPerformance: true,
  },
  {
    id: "evolucao-consistencia-14",
    title: "Consistência +50%",
    description: "Suba em 50% a frequência de treinos em 14 dias. Compete por evolução, não por total bruto.",
    metric: "sessoes",
    target: 50,
    unit: "%",
    durationDays: 14,
    participants: 680,
    rankingMode: "relative",
    targetPct: 50,
  },
  {
    id: "hub-massa-60",
    title: "Projeto Massa — evolução 60d",
    description: "Em 60 dias, aumente seu volume de treino em 25% vs baseline. Ranking relativo do hub.",
    metric: "volume",
    target: 25,
    unit: "%",
    durationDays: 60,
    participants: 210,
    rankingMode: "relative",
    targetPct: 25,
  },
];

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);

export function isRelativeChallenge(c: Challenge) {
  return (c.rankingMode ?? "absolute") === "relative";
}
