import { matchesEquipment, type Exercise } from "@/data/exercises";
import type { Equipment, GymGear } from "@/lib/types";

export const GYM_GEAR_OPTIONS: GymGear[] = ["barra", "halteres", "maquinas", "elasticos", "peso_corporal"];

export function defaultInventory(equipment: Equipment): GymGear[] {
  return equipment === "academia"
    ? ["barra", "halteres", "maquinas"]
    : ["peso_corporal", "halteres", "elasticos"];
}

export function equipmentFromInventory(inventory: GymGear[] | undefined, fallback: Equipment): Equipment {
  if (!inventory?.length) return fallback;
  if (inventory.includes("barra") || inventory.includes("maquinas")) return "academia";
  return "casa";
}

export function matchesInventory(
  ex: Exercise,
  equipment: Equipment,
  inventory?: GymGear[],
): boolean {
  if (!inventory?.length) return matchesEquipment(ex, equipment);
  const hasGym = inventory.includes("barra") || inventory.includes("maquinas");
  const hasHome =
    inventory.includes("peso_corporal") || inventory.includes("elasticos") || inventory.includes("halteres");
  if (ex.equipment === "ambos") return hasGym || hasHome;
  if (ex.equipment === "academia") return hasGym || inventory.includes("halteres");
  return hasHome;
}
