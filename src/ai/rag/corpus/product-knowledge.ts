/**
 * Curated product knowledge corpus (FASE 16) — one doc per kb_ref used by skills + schema docs.
 *
 * Soldiers knowledge Markdown (TKD, nutrition, supplements, safety) is loaded
 * separately via `soldiers-knowledge.ts` allowlist. evidence-policy and
 * spec-training-system never enter this corpus. See docs/knowledge/README.md.
 */
import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";

export type CorpusRow = {
  document_id: string;
  title: string;
  domain: KnowledgeDomain;
  kb_ref: string;
  section: string;
  content: string;
  source_key: string;
};

export const PRODUCT_KNOWLEDGE_CORPUS: CorpusRow[] = [
  // exercise / training
  {
    document_id: "doc_exercise_catalog_v1",
    title: "Exercise catalog schema",
    domain: "exercise",
    kb_ref: "kb:exercise.catalog",
    section: "schema",
    source_key: "src_exercise_catalog_schema",
    content:
      "Exercise catalog fields: exerciseId, name, muscleGroup, equipment, movementPattern, mediaRef, sets, reps, restSec, loadHint.",
  },
  {
    document_id: "doc_training_basics_v1",
    title: "Training basics",
    domain: "training",
    kb_ref: "kb:training.basics",
    section: "basics",
    source_key: "src_exercise_catalog_schema",
    content:
      "Training basics: weekly plan days, session structure, Decision Engine chooses trainingMode full express deload rest.",
  },
  {
    document_id: "doc_training_exercises_v1",
    title: "Training exercises",
    domain: "training",
    kb_ref: "kb:training.exercises",
    section: "exercises",
    source_key: "src_exercise_catalog_schema",
    content: "Exercises are selected from the catalog by muscle group and equipment profile.",
  },
  {
    document_id: "doc_training_subs_v1",
    title: "Exercise substitutions",
    domain: "training",
    kb_ref: "kb:training.substitutions",
    section: "substitutions",
    source_key: "src_exercise_catalog_schema",
    content: "Substitutions keep movementPattern when equipment is limited or user dislikes an exercise.",
  },
  {
    document_id: "doc_training_load_v1",
    title: "Training load",
    domain: "training",
    kb_ref: "kb:training.load",
    section: "load",
    source_key: "src_exercise_catalog_schema",
    content: "Training load is trainingVolume from Decision Engine; express reduces minutes, deload reduces intensity.",
  },
  {
    document_id: "doc_training_prog_v1",
    title: "Training progression",
    domain: "training",
    kb_ref: "kb:training.progression",
    section: "progression",
    source_key: "src_exercise_catalog_schema",
    content: "Progression increases volume when recovery readiness is high and adherence is stable.",
  },
  {
    document_id: "doc_training_regr_v1",
    title: "Training regression",
    domain: "training",
    kb_ref: "kb:training.regression",
    section: "regression",
    source_key: "src_exercise_catalog_schema",
    content: "Regression reduces volume on high RPE streaks, low sleep, or Safety preferLightTraining.",
  },
  // nutrition
  {
    document_id: "doc_nutrition_labels_v1",
    title: "Nutrition labels",
    domain: "nutrition",
    kb_ref: "kb:nutrition.labels",
    section: "labels",
    source_key: "src_nutrition_labels",
    content: "Meal nutrient snapshot: energyKcal proteinG carbG fatG fiberG with lineage taco user imported ai_estimate.",
  },
  {
    document_id: "doc_nutrition_basics_v1",
    title: "Nutrition basics",
    domain: "nutrition",
    kb_ref: "kb:nutrition.basics",
    section: "basics",
    source_key: "src_nutrition_labels",
    content: "Nutrition basics: meal slots cafe almoco lanche jantar and daily protein adherence.",
  },
  {
    document_id: "doc_nutrition_macros_v1",
    title: "Nutrition macros",
    domain: "nutrition",
    kb_ref: "kb:nutrition.macros",
    section: "macros",
    source_key: "src_nutrition_labels",
    content: "Macro goals derive from profile goal and Living Plan proteinG kcal targets.",
  },
  {
    document_id: "doc_nutrition_meals_v1",
    title: "Nutrition meals",
    domain: "nutrition",
    kb_ref: "kb:nutrition.meals",
    section: "meals",
    source_key: "src_nutrition_labels",
    content: "Meal substitution keeps protein target and meal quality traffic lights.",
  },
  // recovery / sleep
  {
    document_id: "doc_recovery_basics_v1",
    title: "Recovery basics",
    domain: "recovery",
    kb_ref: "kb:recovery.basics",
    section: "basics",
    source_key: "src_recovery_checkin",
    content: "Recovery score from energy soreness stress and wearable readiness when available.",
  },
  {
    document_id: "doc_recovery_fatigue_v1",
    title: "Recovery fatigue",
    domain: "recovery",
    kb_ref: "kb:recovery.fatigue",
    section: "fatigue",
    source_key: "src_recovery_checkin",
    content: "Fatigue signal and hard RPE streak drive deload or rest proposals.",
  },
  {
    document_id: "doc_recovery_sleep_v1",
    title: "Recovery sleep",
    domain: "sleep",
    kb_ref: "kb:recovery.sleep",
    section: "sleep",
    source_key: "src_sleep_checkin",
    content: "Sleep hours from check-in; sleep_low is a Decision reason code.",
  },
  {
    document_id: "doc_sleep_checkin_v1",
    title: "Sleep check-in fields",
    domain: "sleep",
    kb_ref: "kb:sleep.checkin",
    section: "checkin",
    source_key: "src_sleep_checkin",
    content: "Sleep fields: sleepHours typicalSleepHours source checkin profile wearable.",
  },
  // behavior
  {
    document_id: "doc_behavior_adherence_v1",
    title: "Behavior adherence",
    domain: "behavior",
    kb_ref: "kb:behavior.adherence",
    section: "adherence",
    source_key: "src_behavior_habits",
    content: "Adherence drop and weekend_adherence_pattern are tracked by the behavior loop.",
  },
  {
    document_id: "doc_behavior_friction_v1",
    title: "Behavior friction",
    domain: "behavior",
    kb_ref: "kb:behavior.friction",
    section: "friction",
    source_key: "src_behavior_habits",
    content: "Friction includes time_limited equipment_limited and incomplete_logging.",
  },
  {
    document_id: "doc_behavior_habits_v1",
    title: "Behavior habits",
    domain: "behavior",
    kb_ref: "kb:behavior.habits",
    section: "habits",
    source_key: "src_behavior_habits",
    content: "Habit lessons tip contentId appear on Living Plan habits block.",
  },
  // performance
  {
    document_id: "doc_performance_overview_v1",
    title: "Performance OS overview",
    domain: "performance",
    kb_ref: "kb:performance.overview",
    section: "overview",
    source_key: "src_performance_os",
    content: "Performance OS pipeline: Context Safety Decision Living Plan. RAG never decides.",
  },
  {
    document_id: "doc_performance_explain_v1",
    title: "Explain decision",
    domain: "performance",
    kb_ref: "kb:performance.explain",
    section: "explain",
    source_key: "src_performance_os",
    content: "Explain decision uses WHY reason_codes WHAT decision_value EXPECTED outcome from Decision contract.",
  },
  {
    document_id: "doc_performance_outcomes_v1",
    title: "Analyze outcome",
    domain: "performance",
    kb_ref: "kb:performance.outcomes",
    section: "outcomes",
    source_key: "src_performance_os",
    content: "Outcome quality success fail mixed feeds Learning Engine signals only.",
  },
  {
    document_id: "doc_performance_daily_v1",
    title: "Daily context",
    domain: "performance",
    kb_ref: "kb:performance.daily",
    section: "daily",
    source_key: "src_performance_os",
    content: "Daily context aggregates check-in recovery nutrition and planned training minutes.",
  },
  // other domains
  {
    document_id: "doc_supplementation_timing_v1",
    title: "Supplement timing",
    domain: "supplementation",
    kb_ref: "kb:supplementation.timing",
    section: "timing",
    source_key: "src_supplementation_timing",
    content: "Living Plan supplements list id name timing from product catalog; not medical advice.",
  },
  {
    document_id: "doc_products_catalog_v1",
    title: "Products catalog",
    domain: "products",
    kb_ref: "kb:products.catalog",
    section: "schema",
    source_key: "src_products_catalog",
    content: "Product id name category purchaseProductIds for recommendation ranking only.",
  },
  {
    document_id: "doc_coaching_faq_v1",
    title: "Coach FAQ",
    domain: "coaching",
    kb_ref: "kb:coaching.faq",
    section: "faq",
    source_key: "src_coaching_faq",
    content: "Coach is deterministic FactPack. DecisionProposal only. escalateCare forces rest-aligned proposals.",
  },
];
