export type ChallengeCategory =
  | "consistency"
  | "transformation"
  | "strength"
  | "running"
  | "steps"
  | "football"
  | "muscle_gain"
  | "conditioning";

export type ChallengeMetric =
  | "sessoes"
  | "volume"
  | "dias"
  | "cardio_sessions"
  | "steps"
  | "football_sessions"
  | "activity_minutes"
  | "volume_pull"
  | "invites";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  metric: ChallengeMetric;
  /** Absolute target (sessions/kg). Used when rankingMode is absolute. */
  target: number;
  unit: string;
  durationDays: number;
  participants: number;
  /** Requires access tier performance */
  requiresPerformance?: boolean;
  /** absolute = raw value; relative = % evolution vs baseline; personalized = absolute target per user */
  rankingMode?: "absolute" | "relative" | "personalized";
  /** For relative challenges: complete when pct evolution >= this */
  targetPct?: number;
  /** Personalized: min/max clamps for computed personal target */
  personalTargetMin?: number;
  personalTargetMax?: number;
  /** Personalized: multiply baseline then add offset */
  personalTargetFactor?: number;
  personalTargetOffset?: number;
  /** Admin overlay: badge / XP / copy */
  reward?: string;
  /** When false, hidden from athlete catalog */
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export const CHALLENGES_SEED: Challenge[] = [
  {
    id: "consistencia-21",
    title: "21 dias de consistência",
    description: "Treine 12 vezes em 21 dias e cimente o hábito.",
    category: "consistency",
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
    category: "strength",
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
    category: "consistency",
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
    category: "consistency",
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
    category: "strength",
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
    category: "consistency",
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
    category: "muscle_gain",
    metric: "volume",
    target: 25,
    unit: "%",
    durationDays: 60,
    participants: 210,
    rankingMode: "relative",
    targetPct: 25,
  },
  {
    id: "consistencia-30-personal",
    title: "30 Days Consistency",
    description:
      "Mesmo desafio, meta sua: baseado no seu ritmo atual. Compete pelo % da sua meta — não pelo total bruto.",
    category: "consistency",
    metric: "sessoes",
    target: 12,
    unit: "treinos",
    durationDays: 30,
    participants: 540,
    rankingMode: "personalized",
    personalTargetFactor: 1.4,
    personalTargetOffset: 2,
    personalTargetMin: 8,
    personalTargetMax: 24,
  },
  {
    id: "transformacao-28",
    title: "Transformação 28 dias",
    description: "Evolua seu volume de treino em 15% em 4 semanas. Ranking por % de evolução.",
    category: "transformation",
    metric: "volume",
    target: 15,
    unit: "%",
    durationDays: 28,
    participants: 380,
    rankingMode: "relative",
    targetPct: 15,
  },
  {
    id: "forca-volume-21",
    title: "Força — volume personalizado",
    description: "Meta de volume proporcional ao seu baseline. Cada soldado tem a própria meta.",
    category: "strength",
    metric: "volume",
    target: 20000,
    unit: "kg",
    durationDays: 21,
    participants: 290,
    rankingMode: "personalized",
    personalTargetFactor: 1.25,
    personalTargetOffset: 0,
    personalTargetMin: 8000,
    personalTargetMax: 80000,
    requiresPerformance: true,
  },
  {
    id: "corrida-12-sessoes",
    title: "Corrida — 12 sessões cardio",
    description: "Complete sessões com corrida/HIIT/corda em 21 dias (proxy de corrida via treinos).",
    category: "running",
    metric: "cardio_sessions",
    target: 12,
    unit: "sessões",
    durationDays: 21,
    participants: 210,
    rankingMode: "absolute",
  },
  {
    id: "passos-30d",
    title: "Passos — 30 dias",
    description:
      "Some passos no período. Auto-relato entra no ranking com selo; Strava/Garmin verificam quando conectados.",
    category: "steps",
    metric: "steps",
    target: 150000,
    unit: "passos",
    durationDays: 30,
    participants: 160,
    rankingMode: "personalized",
    personalTargetFactor: 1.2,
    personalTargetOffset: 20000,
    personalTargetMin: 60000,
    personalTargetMax: 400000,
  },
  {
    id: "futebol-8-jogos",
    title: "Futebol — 8 jogos",
    description: "Registre 8 jogos/partidas em 30 dias. Auto-relato leva selo; prova verificada quando houver wearable.",
    category: "football",
    metric: "football_sessions",
    target: 8,
    unit: "jogos",
    durationDays: 30,
    participants: 95,
    rankingMode: "absolute",
  },
  {
    id: "condicionamento-14",
    title: "Condicionamento 14 dias",
    description: "Meta de sessões cardio personalizada ao seu baseline.",
    category: "conditioning",
    metric: "cardio_sessions",
    target: 6,
    unit: "sessões",
    durationDays: 14,
    participants: 240,
    rankingMode: "personalized",
    personalTargetFactor: 1.5,
    personalTargetOffset: 1,
    personalTargetMin: 4,
    personalTargetMax: 12,
  },
  {
    id: "gen-iniciante-8",
    title: "8 treinos no mês",
    description: "Feche 8 sessões em 30 dias e crie o ritmo de iniciante.",
    category: "consistency",
    metric: "sessoes",
    target: 8,
    unit: "treinos",
    durationDays: 30,
    participants: 0,
    rankingMode: "absolute",
  },
  {
    id: "gen-puxada-5",
    title: "+5% de puxada",
    description: "Suba 5% o volume de puxada (costas / pull) vs. seu baseline.",
    category: "strength",
    metric: "volume_pull",
    target: 5,
    unit: "%",
    durationDays: 30,
    participants: 0,
    rankingMode: "relative",
    targetPct: 5,
  },
  {
    id: "gen-convide-3",
    title: "Convide 3",
    description: "Chame 3 pessoas do clube ou que você segue para um desafio.",
    category: "consistency",
    metric: "invites",
    target: 3,
    unit: "convites",
    durationDays: 30,
    participants: 0,
    rankingMode: "absolute",
  },
];

export const CHALLENGES: Challenge[] = CHALLENGES_SEED.map((c) => ({ ...c }));

export function replaceChallenges(next: Challenge[]): void {
  CHALLENGES.length = 0;
  CHALLENGES.push(...next);
}

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);

export function isRelativeChallenge(c: Challenge) {
  return (c.rankingMode ?? "absolute") === "relative";
}

export function isPersonalizedChallenge(c: Challenge) {
  return c.rankingMode === "personalized";
}

/** Compute individual absolute target from baseline at join. */
export function computePersonalTarget(challenge: Challenge, baseline: number): number {
  if (!isPersonalizedChallenge(challenge)) return challenge.target;
  const factor = challenge.personalTargetFactor ?? 1.4;
  const offset = challenge.personalTargetOffset ?? 0;
  const min = challenge.personalTargetMin ?? 1;
  const max = challenge.personalTargetMax ?? challenge.target * 3;
  const raw = Math.round(Math.max(0, baseline) * factor + offset);
  return Math.max(min, Math.min(max, raw || min));
}
