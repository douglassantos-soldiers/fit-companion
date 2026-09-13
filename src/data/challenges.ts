export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: "sessoes" | "volume" | "dias";
  target: number;
  unit: string;
  durationDays: number;
  participants: number;
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
  },
];

export const RANKING_NAMES = [
  "R. Almeida",
  "M. Torres",
  "J. Nakamura",
  "C. Duarte",
  "L. Batista",
  "P. Vasques",
  "A. Ferraz",
];

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);
