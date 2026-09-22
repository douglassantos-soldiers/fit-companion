/**
 * Soldiers-authored Content OS seed. No third-party media or NTC dumps.
 *
 * program-base-4w training_json contract (authoritative):
 *   { title?, focus?, estimatedMin?, exercises: [{ exerciseId, sets, reps, restSec?, loadHint?, unit? }] }
 * Editorial bags like `{ theme: "técnica" }` are ignored by parseProgramTraining.
 * Enrollment builds ActiveTrainingBlock client-side (AppState retention) — no server enroll table in P2.
 */
import type { PublicContentItem } from "@/lib/content-match";
import type {
  ContentCollection,
  ContentProgram,
  Expert,
  ProgramSession,
  ProgramTrainingDay,
} from "@/lib/content/types";

export const CONTENT_OS_EXPERTS: Expert[] = [
  {
    id: "expert-soldiers-coach",
    name: "Coach Soldiers",
    bio: "Técnica e consistência no treino — conteúdo original Soldiers.",
    specialty: "força",
    verified: true,
    active: true,
    photoMediaId: "expert-soldiers-coach",
  },
  {
    id: "expert-soldiers-recovery",
    name: "Recuperação Soldiers",
    bio: "Sono, descanso e leitura de sinais — sem protocolos de terceiros.",
    specialty: "recuperação",
    verified: true,
    active: true,
    photoMediaId: "expert-soldiers-recovery",
  },
];

export const CONTENT_OS_COLLECTIONS: ContentCollection[] = [
  {
    id: "col-fundamentos",
    title: "Fundamentos Soldiers",
    kind: "education",
    expertId: "expert-soldiers-coach",
    coverMediaId: "col-fundamentos",
    published: true,
    sortOrder: 0,
  },
];

export const CONTENT_OS_PROGRAMS: ContentProgram[] = [
  {
    id: "program-base-4w",
    title: "Base 4 semanas",
    description:
      "Trilha híbrida: 4 semanas × 3 dias com treinos prescritos. O Living Plan ainda ajusta express/deload/rest.",
    goal: "performance",
    level: "iniciante",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    expertIds: ["expert-soldiers-coach", "expert-soldiers-recovery"],
    published: true,
    coverMediaId: "program-base-4w",
  },
];

function dayA(week: number): ProgramTrainingDay {
  const load = 40 + week * 2.5;
  return {
    title: "Empurrar",
    focus: "peito · ombros · tríceps",
    estimatedMin: 50,
    exercises: [
      { exerciseId: "supino-reto", sets: 3, reps: "8-10", restSec: 90, loadHint: load, unit: "kg" },
      { exerciseId: "desenvolvimento", sets: 3, reps: "8-10", restSec: 75, loadHint: load * 0.55, unit: "kg" },
      { exerciseId: "crucifixo", sets: 3, reps: "10-12", restSec: 60, loadHint: load * 0.35, unit: "kg" },
      { exerciseId: "triceps-corda", sets: 3, reps: "10-12", restSec: 60, loadHint: load * 0.4, unit: "kg" },
      { exerciseId: "prancha", sets: 3, reps: "30-45", restSec: 45, unit: "corpo" },
    ],
  };
}

function dayB(week: number): ProgramTrainingDay {
  const load = 50 + week * 2.5;
  return {
    title: "Puxar",
    focus: "costas · bíceps",
    estimatedMin: 50,
    exercises: [
      { exerciseId: "barra-fixa", sets: 3, reps: "6-10", restSec: 90, unit: "corpo" },
      { exerciseId: "remada-curvada", sets: 3, reps: "8-10", restSec: 90, loadHint: load, unit: "kg" },
      { exerciseId: "pulldown", sets: 3, reps: "10-12", restSec: 75, loadHint: load * 0.7, unit: "kg" },
      { exerciseId: "rosca-direta", sets: 3, reps: "10-12", restSec: 60, loadHint: load * 0.35, unit: "kg" },
      { exerciseId: "face-pull", sets: 3, reps: "12-15", restSec: 45, loadHint: load * 0.25, unit: "kg" },
    ],
  };
}

function dayC(week: number): ProgramTrainingDay {
  const load = 55 + week * 2.5;
  return {
    title: "Pernas",
    focus: "quadriceps · posterior · core",
    estimatedMin: 55,
    exercises: [
      { exerciseId: "agachamento", sets: 3, reps: "6-10", restSec: 120, loadHint: load, unit: "kg" },
      { exerciseId: "terra-romeno", sets: 3, reps: "8-10", restSec: 90, loadHint: load * 0.85, unit: "kg" },
      { exerciseId: "afundo", sets: 3, reps: "8-10", restSec: 75, loadHint: load * 0.4, unit: "kg" },
      { exerciseId: "cadeira-extensora", sets: 3, reps: "10-12", restSec: 60, loadHint: load * 0.5, unit: "kg" },
      { exerciseId: "panturrilha", sets: 3, reps: "12-15", restSec: 45, loadHint: load * 0.45, unit: "kg" },
    ],
  };
}

const CONTENT_BY_DAY: Record<number, string> = {
  1: "soldiers-technique-bracing",
  2: "soldiers-recovery-rest",
  3: "soldiers-education-habit",
};

function buildProgramSessions(): ProgramSession[] {
  const out: ProgramSession[] = [];
  for (let week = 1; week <= 4; week += 1) {
    const templates = [dayA(week), dayB(week), dayC(week)];
    templates.forEach((training, idx) => {
      const day = idx + 1;
      out.push({
        id: `program-base-4w-w${week}d${day}`,
        programId: "program-base-4w",
        week,
        day,
        contentItemId: CONTENT_BY_DAY[day],
        training: training as unknown as Record<string, unknown>,
      });
    });
  }
  return out;
}

export const CONTENT_OS_PROGRAM_SESSIONS: ProgramSession[] = buildProgramSessions();

export const CONTENT_OS_ITEMS: PublicContentItem[] = [
  {
    id: "soldiers-technique-bracing",
    kind: "technique",
    title: "Trave o core antes da barra",
    body: "Expire e trave o abdômen como se fosse receber um soco. A barra sobe mais estável e a lombar agradece.",
    goals: ["massa", "performance"],
    levels: ["iniciante", "intermediario"],
    published: true,
    sortOrder: 10,
    expertId: "expert-soldiers-coach",
    collectionId: "col-fundamentos",
    mediaId: "soldiers-technique-bracing",
    visible: true,
  },
  {
    id: "soldiers-recovery-rest",
    kind: "recovery",
    title: "Descanso também é treino",
    body: "Quando o Decision Engine pede REST, o conteúdo certo é recuperar — não empilhar volume. Durma e caminhe leve.",
    goals: ["saude", "performance"],
    levels: [],
    published: true,
    sortOrder: 11,
    expertId: "expert-soldiers-recovery",
    collectionId: "col-fundamentos",
    mediaId: "soldiers-recovery-rest",
    visible: true,
  },
  {
    id: "soldiers-nutrition-protein",
    kind: "nutrition",
    title: "Proteína no prato, não só no shake",
    body: "Uma palma de proteína em cada refeição segura a fome. O whey completa; não substitui o almoço.",
    goals: ["massa", "gordura"],
    levels: ["iniciante"],
    published: true,
    sortOrder: 12,
    expertId: "expert-soldiers-coach",
    visible: true,
  },
  {
    id: "soldiers-education-habit",
    kind: "education",
    title: "O hábito vence o dia perfeito",
    body: "Um treino médio repetido constrói identidade. Se o dia apertar, faça a versão curta — não cancele a semana.",
    goals: [],
    levels: [],
    published: true,
    sortOrder: 13,
    collectionId: "col-fundamentos",
    visible: true,
  },
  {
    id: "soldiers-motivation-streak",
    kind: "motivation",
    title: "Volte no mesmo dia",
    body: "Quebrar a sequência dói. Recomeçar hoje vale mais do que esperar segunda-feira.",
    goals: [],
    levels: [],
    published: true,
    sortOrder: 14,
    visible: true,
  },
];

export function programSessionContentIds(): string[] {
  return CONTENT_OS_PROGRAM_SESSIONS.map((s) => s.contentItemId).filter((id): id is string =>
    Boolean(id),
  );
}
