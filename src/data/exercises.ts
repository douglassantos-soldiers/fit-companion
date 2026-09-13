export type MuscleGroup =
  | "peito"
  | "costas"
  | "pernas"
  | "ombros"
  | "biceps"
  | "triceps"
  | "core"
  | "cardio";

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: "casa" | "academia" | "ambos";
  baseLoad: number; // kg de referência para intermediário
  unit: "kg" | "corpo" | "min";
}

export const EXERCISES: Exercise[] = [
  { id: "supino-reto", name: "Supino reto", group: "peito", equipment: "academia", baseLoad: 50, unit: "kg" },
  { id: "supino-inclinado-halter", name: "Supino inclinado com halteres", group: "peito", equipment: "academia", baseLoad: 20, unit: "kg" },
  { id: "flexao", name: "Flexão de braço", group: "peito", equipment: "ambos", baseLoad: 0, unit: "corpo" },
  { id: "crucifixo", name: "Crucifixo", group: "peito", equipment: "academia", baseLoad: 14, unit: "kg" },
  { id: "barra-fixa", name: "Barra fixa", group: "costas", equipment: "ambos", baseLoad: 0, unit: "corpo" },
  { id: "remada-curvada", name: "Remada curvada", group: "costas", equipment: "academia", baseLoad: 40, unit: "kg" },
  { id: "remada-unilateral", name: "Remada unilateral", group: "costas", equipment: "ambos", baseLoad: 20, unit: "kg" },
  { id: "pulldown", name: "Puxada alta", group: "costas", equipment: "academia", baseLoad: 45, unit: "kg" },
  { id: "agachamento", name: "Agachamento livre", group: "pernas", equipment: "academia", baseLoad: 60, unit: "kg" },
  { id: "agachamento-corpo", name: "Agachamento com peso do corpo", group: "pernas", equipment: "ambos", baseLoad: 0, unit: "corpo" },
  { id: "leg-press", name: "Leg press", group: "pernas", equipment: "academia", baseLoad: 100, unit: "kg" },
  { id: "afundo", name: "Afundo", group: "pernas", equipment: "ambos", baseLoad: 12, unit: "kg" },
  { id: "terra-romeno", name: "Levantamento terra romeno", group: "pernas", equipment: "academia", baseLoad: 50, unit: "kg" },
  { id: "panturrilha", name: "Panturrilha em pé", group: "pernas", equipment: "ambos", baseLoad: 20, unit: "kg" },
  { id: "desenvolvimento", name: "Desenvolvimento militar", group: "ombros", equipment: "academia", baseLoad: 30, unit: "kg" },
  { id: "elevacao-lateral", name: "Elevação lateral", group: "ombros", equipment: "ambos", baseLoad: 8, unit: "kg" },
  { id: "pike-push", name: "Flexão pike", group: "ombros", equipment: "casa", baseLoad: 0, unit: "corpo" },
  { id: "rosca-direta", name: "Rosca direta", group: "biceps", equipment: "ambos", baseLoad: 20, unit: "kg" },
  { id: "rosca-martelo", name: "Rosca martelo", group: "biceps", equipment: "ambos", baseLoad: 12, unit: "kg" },
  { id: "triceps-corda", name: "Tríceps na corda", group: "triceps", equipment: "academia", baseLoad: 20, unit: "kg" },
  { id: "triceps-banco", name: "Tríceps no banco", group: "triceps", equipment: "ambos", baseLoad: 0, unit: "corpo" },
  { id: "prancha", name: "Prancha", group: "core", equipment: "ambos", baseLoad: 0, unit: "min" },
  { id: "abdominal-remador", name: "Abdominal remador", group: "core", equipment: "ambos", baseLoad: 0, unit: "corpo" },
  { id: "hollow", name: "Hollow hold", group: "core", equipment: "ambos", baseLoad: 0, unit: "min" },
  { id: "corrida", name: "Corrida contínua", group: "cardio", equipment: "ambos", baseLoad: 0, unit: "min" },
  { id: "hiit-bike", name: "HIIT na bike", group: "cardio", equipment: "academia", baseLoad: 0, unit: "min" },
  { id: "burpee", name: "Burpee", group: "cardio", equipment: "ambos", baseLoad: 0, unit: "corpo" },
  { id: "pular-corda", name: "Pular corda", group: "cardio", equipment: "ambos", baseLoad: 0, unit: "min" },
];

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);
