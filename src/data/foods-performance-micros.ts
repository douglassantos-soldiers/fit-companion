/**
 * Curated iron / vitamin D per 100 g for performance micros panel (P2).
 * Approximate internal values — not a full micronutrient table.
 */
import type { FoodDef } from "@/data/foods-helpers";

type Micros = Pick<FoodDef, "ironMg" | "vitaminDUcg">;

/** ~30 high-relevance foods for Soldiers performance tracking */
export const PERFORMANCE_MICROS_BY_ID: Record<string, Micros> = {
  "feijao-carioca-cozido": { ironMg: 1.5 },
  "feijao-preto-cozido": { ironMg: 1.4 },
  "lentilha-cozida": { ironMg: 3.3 },
  "grao-de-bico-cozido": { ironMg: 1.4 },
  "espinafre-cozido": { ironMg: 1.9 },
  "couve-refogada": { ironMg: 0.9 },
  "brocolis-cozido": { ironMg: 0.7 },
  "figado-bovino-grelhado": { ironMg: 10.0, vitaminDUcg: 1.2 },
  "carne-bovina-patinho": { ironMg: 2.4 },
  "carne-bovina-alcatra": { ironMg: 2.1 },
  "carne-moida-cozida": { ironMg: 2.6 },
  "contrafile-grelhado": { ironMg: 2.3 },
  "frango-peito-grelhado": { ironMg: 0.5 },
  "frango-desfiado": { ironMg: 0.6 },
  "ovo-cozido": { ironMg: 1.2, vitaminDUcg: 1.1 },
  "ovo-frito": { ironMg: 1.2, vitaminDUcg: 1.1 },
  "ovo-mexido": { ironMg: 1.2, vitaminDUcg: 1.1 },
  "clara-ovo": { ironMg: 0.1 },
  "salmao-grelhado": { ironMg: 0.5, vitaminDUcg: 11.0 },
  "tilapia-grelhada": { ironMg: 0.4, vitaminDUcg: 1.5 },
  "sardinha-lata": { ironMg: 2.9, vitaminDUcg: 7.5 },
  "atum-lata-agua": { ironMg: 1.0, vitaminDUcg: 1.7 },
  "camarao-grelhado": { ironMg: 0.5, vitaminDUcg: 0.1 },
  "leite-integral": { ironMg: 0.1, vitaminDUcg: 0.1 },
  "leite-desnatado": { ironMg: 0.1, vitaminDUcg: 0.1 },
  "iogurte-natural": { ironMg: 0.1 },
  "queijo-minas": { ironMg: 0.2 },
  "aveia-flocos": { ironMg: 4.3 },
  "arroz-integral-cozido": { ironMg: 0.3 },
  "pao-integral": { ironMg: 1.5 },
  "tofu": { ironMg: 2.7 },
  "castanha-caju": { ironMg: 5.0 },
  "amendoim": { ironMg: 2.0 },
  "banana-prata": { ironMg: 0.3 },
  "abobora-cozida": { ironMg: 0.4 },
  "batata-doce-cozida": { ironMg: 0.4 },
  "acai-polpa": { ironMg: 0.4 },
};

export function applyPerformanceMicros(defs: FoodDef[]): FoodDef[] {
  return defs.map((d) => {
    const m = PERFORMANCE_MICROS_BY_ID[d.id];
    if (!m) return d;
    const next = { ...d };
    if (m.ironMg != null && m.ironMg > 0) next.ironMg = m.ironMg;
    if (m.vitaminDUcg != null && m.vitaminDUcg > 0) next.vitaminDUcg = m.vitaminDUcg;
    return next;
  });
}
