export type Goal = "massa" | "gordura" | "performance" | "saude";
export type Level = "iniciante" | "intermediario" | "avancado";
export type Equipment = "casa" | "academia";

export interface Profile {
  name: string;
  goal: Goal;
  level: Level;
  daysPerWeek: number;
  age: number;
  heightCm: number;
  weightKg: number;
  equipment: Equipment;
  restrictions: string[];
  createdAt: string;
}

export interface SetLog {
  reps: number;
  weightKg: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export interface SessionLog {
  id: string;
  dayId: string;
  title: string;
  date: string;
  durationMin: number;
  exercises: ExerciseLog[];
  volumeKg: number;
}

export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface DayMetrics {
  date: string;
  waterMl: number;
  meals: number;
}

export interface ChatMessage {
  id: string;
  role: "coach" | "user";
  text: string;
}

export interface AppState {
  profile: Profile | null;
  sessions: SessionLog[];
  weights: WeightEntry[];
  days: Record<string, DayMetrics>;
  supplementLogs: Record<string, string[]>;
  supplementRoutine: string[];
  challenges: string[];
  chat: ChatMessage[];
}

export const emptyState: AppState = {
  profile: null,
  sessions: [],
  weights: [],
  days: {},
  supplementLogs: {},
  supplementRoutine: [],
  challenges: [],
  chat: [],
};

export const GOAL_LABEL: Record<Goal, string> = {
  massa: "Ganhar massa",
  gordura: "Perder gordura",
  performance: "Performance",
  saude: "Saúde e bem-estar",
};

export const LEVEL_LABEL: Record<Level, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const todayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);
