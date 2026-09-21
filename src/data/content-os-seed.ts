/**
 * Soldiers-authored Content OS seed. No third-party media or NTC dumps.
 */
import type { PublicContentItem } from "@/lib/content-match";
import type {
  ContentCollection,
  ContentProgram,
  Expert,
  ProgramSession,
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
    description: "Trilha editorial curta: técnica, recuperação e hábito. Não substitui o planner.",
    goal: "performance",
    level: "iniciante",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    expertIds: ["expert-soldiers-coach", "expert-soldiers-recovery"],
    published: true,
    coverMediaId: "program-base-4w",
  },
];

export const CONTENT_OS_PROGRAM_SESSIONS: ProgramSession[] = [
  {
    id: "program-base-4w-w1d1",
    programId: "program-base-4w",
    week: 1,
    day: 1,
    contentItemId: "soldiers-technique-bracing",
    training: { theme: "técnica" },
  },
  {
    id: "program-base-4w-w1d2",
    programId: "program-base-4w",
    week: 1,
    day: 2,
    contentItemId: "soldiers-recovery-rest",
    recovery: { theme: "descanso" },
  },
  {
    id: "program-base-4w-w1d3",
    programId: "program-base-4w",
    week: 1,
    day: 3,
    contentItemId: "soldiers-education-habit",
    nutrition: { theme: "proteína" },
  },
];

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
