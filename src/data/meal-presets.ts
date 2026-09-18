import type { MealQuality, MealSlot } from "@/lib/types";

export interface MealPreset {
  id: string;
  label: string;
  slot: MealSlot | "qualquer";
  proteinG: number;
  kcal: number;
  quality: MealQuality;
  /** URL pública curada (Unsplash) — sem binários no repo */
  imageUrl?: string;
}

export const MEAL_PRESETS: MealPreset[] = [
  {
    id: "cafe-ovos",
    label: "Ovos + pão",
    slot: "cafe",
    proteinG: 28,
    kcal: 420,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "cafe-whey",
    label: "Whey + banana",
    slot: "cafe",
    proteinG: 30,
    kcal: 280,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "cafe-padaria",
    label: "Café da padaria",
    slot: "cafe",
    proteinG: 12,
    kcal: 450,
    quality: "laranja",
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "almoco-carne",
    label: "Almoço com carne e arroz",
    slot: "almoco",
    proteinG: 45,
    kcal: 650,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "almoco-frango",
    label: "Frango + legumes",
    slot: "almoco",
    proteinG: 48,
    kcal: 520,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "almoco-delivery",
    label: "Delivery / fast food",
    slot: "almoco",
    proteinG: 25,
    kcal: 900,
    quality: "laranja",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "almoco-marmita",
    label: "Marmita equilibrada",
    slot: "almoco",
    proteinG: 40,
    kcal: 580,
    quality: "amarelo",
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "lanche-iogurte",
    label: "Iogurte + fruta",
    slot: "lanche",
    proteinG: 18,
    kcal: 220,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "lanche-whey",
    label: "Shake de whey",
    slot: "lanche",
    proteinG: 25,
    kcal: 150,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1579722820308-d74e571900a3?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "lanche-processado",
    label: "Lanche processado",
    slot: "lanche",
    proteinG: 8,
    kcal: 350,
    quality: "laranja",
    imageUrl: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "lanche-castanhas",
    label: "Castanhas + fruta",
    slot: "lanche",
    proteinG: 10,
    kcal: 280,
    quality: "amarelo",
    imageUrl: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "jantar-peixe",
    label: "Peixe + salada",
    slot: "jantar",
    proteinG: 40,
    kcal: 480,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "jantar-leve",
    label: "Jantar leve com proteína",
    slot: "jantar",
    proteinG: 35,
    kcal: 450,
    quality: "verde",
    imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a724499ef?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "jantar-pizza",
    label: "Pizza / jantar livre",
    slot: "jantar",
    proteinG: 22,
    kcal: 850,
    quality: "laranja",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "qualquer-proteina",
    label: "Porção de proteína",
    slot: "qualquer",
    proteinG: 30,
    kcal: 200,
    quality: "amarelo",
    imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&q=80&auto=format&fit=crop",
  },
  {
    id: "qualquer-refeicao",
    label: "Refeição completa",
    slot: "qualquer",
    proteinG: 35,
    kcal: 600,
    quality: "amarelo",
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80&auto=format&fit=crop",
  },
];

export function presetsForSlot(slot: MealSlot) {
  return MEAL_PRESETS.filter((p) => p.slot === slot || p.slot === "qualquer");
}

export const presetById = (id: string) => MEAL_PRESETS.find((p) => p.id === id);
