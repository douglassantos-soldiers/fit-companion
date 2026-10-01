/**
 * Portuguese retrieval golden set — expected Soldiers kb_ref, not loose overlap.
 */

export type SoldiersRetrievalCase = {
  question_id: string;
  query: string;
  expected_kb_ref: string;
};

export const SOLDIERS_RETRIEVAL_GOLDEN: SoldiersRetrievalCase[] = [
  {
    question_id: "pt_creatine_paraphrase",
    query: "monoidrato ajuda na forca?",
    expected_kb_ref: "kb:supplements.knowledge",
  },
  {
    question_id: "pt_creatine_coffee",
    query: "posso tomar creatina junto com cafe?",
    expected_kb_ref: "kb:supplements.knowledge",
  },
  {
    question_id: "pt_load_progression",
    query: "como subir a carga na progressao do treino resistido?",
    expected_kb_ref: "kb:tkd.resistido",
  },
  {
    question_id: "pt_protein_meal",
    query: "quanta proteina por refeicao faz sentido?",
    expected_kb_ref: "kb:nutrition.knowledge",
  },
  {
    question_id: "pt_chest_pain",
    query: "dor no peito durante o esforco o que fazer?",
    expected_kb_ref: "kb:safety.knowledge",
  },
];
