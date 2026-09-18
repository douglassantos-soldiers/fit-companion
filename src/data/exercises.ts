import { exerciseMediaUrl } from "@/lib/cms";

export type MuscleGroup =
  | "peito"
  | "costas"
  | "pernas"
  | "ombros"
  | "biceps"
  | "triceps"
  | "core"
  | "cardio";

export type Joint = "joelho" | "ombro" | "lombar" | "punho";

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  equipment: "casa" | "academia" | "ambos";
  baseLoad: number;
  unit: "kg" | "corpo" | "min";
  joints: Joint[];
  swapGroup: string;
  priority?: number;
  /** Optional future demo image/GIF URL */
  mediaUrl?: string;
}

export const EXERCISES: Exercise[] = [
  {
    id: "supino-reto",
    name: "Supino reto",
    group: "peito",
    equipment: "academia",
    baseLoad: 50,
    unit: "kg",
    joints: ["ombro", "punho"],
    swapGroup: "peito-press",
    priority: 1,
    mediaUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80&auto=format&fit=crop",
  },
  { id: "supino-inclinado-halter", name: "Supino inclinado com halteres", group: "peito", equipment: "academia", baseLoad: 20, unit: "kg", joints: ["ombro", "punho"], swapGroup: "peito-press", priority: 2 },
  { id: "flexao", name: "Flexão de braço", group: "peito", equipment: "ambos", baseLoad: 0, unit: "corpo", joints: ["ombro", "punho"], swapGroup: "peito-press", priority: 3 },
  { id: "crucifixo", name: "Crucifixo", group: "peito", equipment: "academia", baseLoad: 14, unit: "kg", joints: ["ombro"], swapGroup: "peito-fly", priority: 1 },
  {
    id: "barra-fixa",
    name: "Barra fixa",
    group: "costas",
    equipment: "ambos",
    baseLoad: 0,
    unit: "corpo",
    joints: ["ombro", "punho"],
    swapGroup: "costas-pull",
    priority: 2,
    mediaUrl: "https://images.unsplash.com/photo-1598971639058-fab3c3109cd0?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "remada-curvada",
    name: "Remada curvada",
    group: "costas",
    equipment: "academia",
    baseLoad: 40,
    unit: "kg",
    joints: ["lombar", "punho"],
    swapGroup: "costas-row",
    priority: 1,
    mediaUrl: "https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=800&q=80&auto=format&fit=crop",
  },
  { id: "remada-unilateral", name: "Remada unilateral", group: "costas", equipment: "ambos", baseLoad: 20, unit: "kg", joints: ["lombar", "punho"], swapGroup: "costas-row", priority: 2 },
  { id: "pulldown", name: "Puxada alta", group: "costas", equipment: "academia", baseLoad: 45, unit: "kg", joints: ["ombro", "punho"], swapGroup: "costas-pull", priority: 1 },
  {
    id: "agachamento",
    name: "Agachamento livre",
    group: "pernas",
    equipment: "academia",
    baseLoad: 60,
    unit: "kg",
    joints: ["joelho", "lombar"],
    swapGroup: "perna-squat",
    priority: 1,
    mediaUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&auto=format&fit=crop",
  },
  { id: "agachamento-corpo", name: "Agachamento com peso do corpo", group: "pernas", equipment: "ambos", baseLoad: 0, unit: "corpo", joints: ["joelho"], swapGroup: "perna-squat", priority: 3 },
  { id: "leg-press", name: "Leg press", group: "pernas", equipment: "academia", baseLoad: 100, unit: "kg", joints: ["joelho"], swapGroup: "perna-squat", priority: 2 },
  { id: "afundo", name: "Afundo", group: "pernas", equipment: "ambos", baseLoad: 12, unit: "kg", joints: ["joelho"], swapGroup: "perna-lunge", priority: 1 },
  {
    id: "terra-romeno",
    name: "Levantamento terra romeno",
    group: "pernas",
    equipment: "academia",
    baseLoad: 50,
    unit: "kg",
    joints: ["lombar"],
    swapGroup: "perna-hinge",
    priority: 1,
    mediaUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&auto=format&fit=crop",
  },
  { id: "panturrilha", name: "Panturrilha em pé", group: "pernas", equipment: "ambos", baseLoad: 20, unit: "kg", joints: [], swapGroup: "perna-calf", priority: 1 },
  {
    id: "desenvolvimento",
    name: "Desenvolvimento militar",
    group: "ombros",
    equipment: "academia",
    baseLoad: 30,
    unit: "kg",
    joints: ["ombro", "punho"],
    swapGroup: "ombro-press",
    priority: 1,
    mediaUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80&auto=format&fit=crop",
  },
  { id: "elevacao-lateral", name: "Elevação lateral", group: "ombros", equipment: "ambos", baseLoad: 8, unit: "kg", joints: ["ombro"], swapGroup: "ombro-raise", priority: 1 },
  { id: "pike-push", name: "Flexão pike", group: "ombros", equipment: "casa", baseLoad: 0, unit: "corpo", joints: ["ombro", "punho"], swapGroup: "ombro-press", priority: 2 },
  { id: "rosca-direta", name: "Rosca direta", group: "biceps", equipment: "ambos", baseLoad: 20, unit: "kg", joints: ["punho"], swapGroup: "biceps-curl", priority: 1 },
  { id: "rosca-martelo", name: "Rosca martelo", group: "biceps", equipment: "ambos", baseLoad: 12, unit: "kg", joints: ["punho"], swapGroup: "biceps-curl", priority: 2 },
  { id: "triceps-corda", name: "Tríceps na corda", group: "triceps", equipment: "academia", baseLoad: 20, unit: "kg", joints: ["punho"], swapGroup: "triceps-ext", priority: 1 },
  { id: "triceps-banco", name: "Tríceps no banco", group: "triceps", equipment: "ambos", baseLoad: 0, unit: "corpo", joints: ["punho"], swapGroup: "triceps-ext", priority: 2 },
  { id: "prancha", name: "Prancha", group: "core", equipment: "ambos", baseLoad: 0, unit: "min", joints: [], swapGroup: "core-iso", priority: 1 },
  { id: "abdominal-remador", name: "Abdominal remador", group: "core", equipment: "ambos", baseLoad: 0, unit: "corpo", joints: [], swapGroup: "core-dyn", priority: 1 },
  { id: "hollow", name: "Hollow hold", group: "core", equipment: "ambos", baseLoad: 0, unit: "min", joints: ["lombar"], swapGroup: "core-iso", priority: 2 },
  { id: "corrida", name: "Corrida contínua", group: "cardio", equipment: "ambos", baseLoad: 0, unit: "min", joints: ["joelho"], swapGroup: "cardio-steady", priority: 1 },
  { id: "hiit-bike", name: "HIIT na bike", group: "cardio", equipment: "academia", baseLoad: 0, unit: "min", joints: [], swapGroup: "cardio-hiit", priority: 1 },
  { id: "burpee", name: "Burpee", group: "cardio", equipment: "ambos", baseLoad: 0, unit: "corpo", joints: ["joelho", "punho"], swapGroup: "cardio-hiit", priority: 2 },
  { id: "pular-corda", name: "Pular corda", group: "cardio", equipment: "ambos", baseLoad: 0, unit: "min", joints: ["joelho"], swapGroup: "cardio-steady", priority: 2 },
];

export const exerciseById = (id: string) => {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) return undefined;
  const media = exerciseMediaUrl(id, ex.mediaUrl);
  if (media && media !== ex.mediaUrl) return { ...ex, mediaUrl: media };
  if (media && !ex.mediaUrl) return { ...ex, mediaUrl: media };
  return ex;
};

export function normalizeRestrictions(restrictions: string[]): Joint[] {
  const map: Record<string, Joint> = {
    joelho: "joelho",
    ombro: "ombro",
    lombar: "lombar",
    punho: "punho",
  };
  return restrictions
    .map((r) => map[r.trim().toLowerCase()])
    .filter((j): j is Joint => Boolean(j));
}

export function matchesEquipment(ex: Exercise, equipment: "casa" | "academia") {
  return ex.equipment === "ambos" || ex.equipment === equipment;
}

export function respectsJoints(ex: Exercise, avoided: Joint[]) {
  if (!avoided.length) return true;
  return !ex.joints.some((j) => avoided.includes(j));
}

/** Alternativas para trocar na sessão: mesmo swapGroup, depois mesmo grupo muscular. */
export function alternativesFor(
  exerciseId: string,
  equipment: "casa" | "academia",
  restrictions: string[] = [],
): Exercise[] {
  const current = exerciseById(exerciseId);
  if (!current) return [];
  const avoided = normalizeRestrictions(restrictions);

  const pool = EXERCISES.filter(
    (e) =>
      e.id !== exerciseId &&
      matchesEquipment(e, equipment) &&
      respectsJoints(e, avoided) &&
      (e.swapGroup === current.swapGroup || e.group === current.group),
  );

  return pool.sort((a, b) => {
    const sameSwapA = a.swapGroup === current.swapGroup ? 0 : 1;
    const sameSwapB = b.swapGroup === current.swapGroup ? 0 : 1;
    if (sameSwapA !== sameSwapB) return sameSwapA - sameSwapB;
    return (a.priority ?? 99) - (b.priority ?? 99);
  });
}
