import { matchesEquipment, type Exercise } from "@/data/exercises";
import type { Equipment, GymGear } from "@/lib/types";

export const GYM_GEAR_OPTIONS: GymGear[] = [
  "barra",
  "halteres",
  "maquinas",
  "elasticos",
  "peso_corporal",
  "cabos",
  "kettlebell",
  "cardio",
];

const GYM_MARKERS: GymGear[] = ["barra", "maquinas", "cabos", "cardio"];
const HOME_MARKERS: GymGear[] = ["peso_corporal", "elasticos", "halteres"];

export function defaultInventory(equipment: Equipment): GymGear[] {
  return equipment === "academia"
    ? ["barra", "halteres", "maquinas", "cabos", "cardio"]
    : ["peso_corporal", "halteres", "elasticos", "kettlebell"];
}

export function equipmentFromInventory(
  inventory: GymGear[] | undefined,
  fallback: Equipment,
): Equipment {
  if (!inventory?.length) return fallback;
  if (inventory.some((g) => GYM_MARKERS.includes(g))) return "academia";
  return "casa";
}

export function matchesInventory(
  ex: Exercise,
  equipment: Equipment,
  inventory?: GymGear[],
): boolean {
  if (!inventory?.length) return matchesEquipment(ex, equipment);
  const hasKettlebell = inventory.includes("kettlebell");
  const hasGym = inventory.some((g) => GYM_MARKERS.includes(g));
  const hasHome = inventory.some((g) => HOME_MARKERS.includes(g)) || hasKettlebell;
  if (ex.equipment === "ambos") return hasGym || hasHome;
  if (ex.equipment === "academia") return hasGym || inventory.includes("halteres");
  return hasHome;
}
