import type { MealQuality, MealSlot } from "@/lib/types";

export interface MealPreset {
  id: string;
  label: string;
  slot: MealSlot | "qualquer";
  proteinG: number;
  kcal: number;
  quality: MealQuality;
  /** Optional legacy URL — unused once Soldiers poster is published. */
  imageUrl?: string;
}

export const MEAL_PRESETS: MealPreset[] = [
  { id: "cafe-ovos", label: "Ovos + pão", slot: "cafe", proteinG: 28, kcal: 420, quality: "verde" },
  { id: "cafe-whey", label: "Whey + banana", slot: "cafe", proteinG: 30, kcal: 280, quality: "verde" },
  { id: "cafe-padaria", label: "Café da padaria", slot: "cafe", proteinG: 12, kcal: 450, quality: "laranja" },
  { id: "almoco-carne", label: "Almoço com carne e arroz", slot: "almoco", proteinG: 45, kcal: 650, quality: "verde" },
  { id: "almoco-frango", label: "Frango + legumes", slot: "almoco", proteinG: 48, kcal: 520, quality: "verde" },
  { id: "almoco-delivery", label: "Delivery / fast food", slot: "almoco", proteinG: 25, kcal: 900, quality: "laranja" },
  { id: "almoco-marmita", label: "Marmita equilibrada", slot: "almoco", proteinG: 40, kcal: 580, quality: "amarelo" },
  { id: "lanche-iogurte", label: "Iogurte + fruta", slot: "lanche", proteinG: 18, kcal: 220, quality: "verde" },
  { id: "lanche-whey", label: "Shake de whey", slot: "lanche", proteinG: 25, kcal: 150, quality: "verde" },
  { id: "lanche-processado", label: "Lanche processado", slot: "lanche", proteinG: 8, kcal: 350, quality: "laranja" },
  { id: "lanche-castanhas", label: "Castanhas + fruta", slot: "lanche", proteinG: 10, kcal: 280, quality: "amarelo" },
  { id: "jantar-peixe", label: "Peixe + salada", slot: "jantar", proteinG: 40, kcal: 480, quality: "verde" },
  { id: "jantar-leve", label: "Jantar leve com proteína", slot: "jantar", proteinG: 35, kcal: 450, quality: "verde" },
  { id: "jantar-pizza", label: "Pizza / jantar livre", slot: "jantar", proteinG: 22, kcal: 850, quality: "laranja" },
  { id: "qualquer-proteina", label: "Porção de proteína", slot: "qualquer", proteinG: 30, kcal: 200, quality: "amarelo" },
  { id: "qualquer-refeicao", label: "Refeição completa", slot: "qualquer", proteinG: 35, kcal: 600, quality: "amarelo" },
];

export function presetsForSlot(slot: MealSlot) {
  return MEAL_PRESETS.filter((p) => p.slot === slot || p.slot === "qualquer");
}

export const presetById = (id: string) => MEAL_PRESETS.find((p) => p.id === id);
