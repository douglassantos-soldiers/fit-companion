import { todayKey } from "@/lib/types";
import { pickEditorialLesson } from "@/lib/content-match";
import type { BehaviorSelectContext, BehaviorTriggerKey } from "@/lib/engine/behavior/types";

export type HabitLessonTag =
  | "protein"
  | "sleep"
  | "streak"
  | "weekend"
  | "water"
  | "environment"
  | "stress"
  | "consistency"
  | "training"
  | "general";

export interface HabitLesson {
  id: string;
  title: string;
  body: string;
  tip: string;
  tags?: HabitLessonTag[];
}

export const HABIT_LESSONS: HabitLesson[] = [
  {
    id: "proteina",
    title: "Proteína em cada refeição",
    body: "Distribuir proteína ao longo do dia estabiliza a fome e ajuda a recuperar o treino. Uma porção do tamanho da palma da mão já conta.",
    tip: "Comece pelo café: ovos ou whey mudam o resto do dia.",
    tags: ["protein"],
  },
  {
    id: "fome-vontade",
    title: "Fome vs vontade",
    body: "Fome física cresce devagar e aceita opções simples. Vontade aparece de repente e pede um alimento específico. Nomear a diferença já reduz impulsos.",
    tip: "Espere 10 minutos e beba água antes de decidir.",
    tags: ["stress", "general"],
  },
  {
    id: "agua",
    title: "Água como hábito âncora",
    body: "Hidratação baixa parece cansaço ou fome. Ligar água ao café da manhã e ao pós-treino cria duas doses automáticas.",
    tip: "Meta mínima: 35 ml por kg de peso corporal.",
    tags: ["water"],
  },
  {
    id: "sono",
    title: "Sono é recuperação",
    body: "Sem sono, a fome sobe e a força cai. Tratar o horário de dormir como treino fixo rende mais do que um suplemento extra.",
    tip: "Mesmo horário ±30 min por 5 noites seguidas.",
    tags: ["sleep"],
  },
  {
    id: "consistencia",
    title: "Consistência > perfeição",
    body: "Um dia médio repetido vence um dia perfeito seguido de abandono. O app mede sequência porque ela muda identidade: você é alguém que treina.",
    tip: "Se o dia apertar, faça a versão de 20 minutos.",
    tags: ["consistency", "streak", "training"],
  },
  {
    id: "pos-treino",
    title: "Janela pós-treino",
    body: "Não precisa de refeição mágica. Proteína + carboidrato nas horas seguintes ao treino acelera a recuperação sem complicar.",
    tip: "Whey + fruta resolve quando você está longe de casa.",
    tags: ["protein", "training"],
  },
  {
    id: "verde-amarelo",
    title: "Cores sem culpa",
    body: "Verde, amarelo e laranja são guias de densidade nutricional — não moral. Comer laranja às vezes é normal; o padrão da semana importa.",
    tip: "Busque maioria verde/amarelo, não zero laranja.",
    tags: ["general"],
  },
  {
    id: "streak",
    title: "Streak com flexibilidade",
    body: "Quebrar a sequência dói, mas recomeçar no mesmo dia vale mais do que esperar segunda-feira. Identidade se reconstrói na próxima ação.",
    tip: "Se falhou de manhã, registre a próxima refeição mesmo assim.",
    tags: ["streak", "consistency"],
  },
  {
    id: "ambiente",
    title: "Ambiente decide por você",
    body: "Deixar proteína pronta e esconder o snack impulsivo muda o padrão sem depender de força de vontade o dia inteiro.",
    tip: "Prepare o almoço na noite anterior uma vez por semana.",
    tags: ["environment", "weekend"],
  },
  {
    id: "suplemento",
    title: "Suplemento não substitui base",
    body: "Creatina e whey ajudam quando a rotina já existe. Sem treino e sem proteína na comida, o pote vira só ritual.",
    tip: "Marque a dose no horário fixo — aderência conta.",
    tags: ["protein", "consistency"],
  },
  {
    id: "estresse",
    title: "Estresse e fome emocional",
    body: "Sob estresse o cérebro pede alívio rápido. Um ritual de 5 minutos (caminhada, banho, respiração) compete com a geladeira.",
    tip: "Liste 2 alívios que não sejam comida.",
    tags: ["stress"],
  },
  {
    id: "progressao",
    title: "Progressão também na mesa",
    body: "Assim como a carga sobe no treino, a proteína pode subir 10–20 g por dia até bater a meta. Pequenos upgrades acumulam.",
    tip: "Adicione uma porção extra de proteína no almoço esta semana.",
    tags: ["protein"],
  },
  {
    id: "social",
    title: "Comer fora sem derrubar o plano",
    body: "Escolha proteína primeiro no cardápio, depois o acompanhamento. Isso mantém o alvo sem transformar o jantar em restrição.",
    tip: "Peça água e salada junto — volume ajuda a saciedade.",
    tags: ["weekend", "protein"],
  },
  {
    id: "manha",
    title: "Vitória da manhã",
    body: "Os primeiros 60 minutos definem o tom: água, proteína e o treino ou a mobilidade. Quem ganha a manhã erra menos à noite.",
    tip: "Deixe a garrafa e o whey prontos na noite anterior.",
    tags: ["consistency", "water"],
  },
];

const TRIGGER_TAG: Partial<Record<BehaviorTriggerKey, HabitLessonTag>> = {
  LOW_SLEEP_STREAK: "sleep",
  MEAL_LOGGING_DROP: "protein",
  WEEKEND_MEAL_GAP: "weekend",
  TRAINING_SKIPPING_PATTERN: "streak",
  LOW_FRIDAY_ADHERENCE: "training",
  TIME_CONSTRAINT_PATTERN: "consistency",
};

const TRIGGER_PRIORITY: BehaviorTriggerKey[] = [
  "LOW_SLEEP_STREAK",
  "WEEKEND_MEAL_GAP",
  "MEAL_LOGGING_DROP",
  "TIME_CONSTRAINT_PATTERN",
  "TRAINING_SKIPPING_PATTERN",
  "LOW_FRIDAY_ADHERENCE",
];

function fallbackLesson(date: Date): HabitLesson {
  const key = todayKey(date);
  const dayIndex = Math.floor(new Date(key + "T12:00:00").getTime() / 86400000);
  const idx = ((dayIndex % HABIT_LESSONS.length) + HABIT_LESSONS.length) % HABIT_LESSONS.length;
  return HABIT_LESSONS[idx]!;
}

/** Adaptive lesson: prefers tag matching active trigger/pattern; else date rotation. */
export function lessonForToday(
  date: Date = new Date(),
  behaviorCtx?: BehaviorSelectContext | null,
  targeting?: { goal?: string | null; level?: string | null } | null,
): HabitLesson {
  const editorial = pickEditorialLesson(targeting, date);
  if (editorial) return editorial;
  if (behaviorCtx) {
    const active = behaviorCtx.triggers.filter((t) => t.active);
    const ordered = [...active].sort(
      (a, b) => TRIGGER_PRIORITY.indexOf(a.key) - TRIGGER_PRIORITY.indexOf(b.key),
    );
    for (const t of ordered) {
      const tag = TRIGGER_TAG[t.key];
      if (!tag) continue;
      const hit = HABIT_LESSONS.find((l) => l.tags?.includes(tag));
      if (hit) return hit;
    }
    if (behaviorCtx.patterns.some((p) => p.key === "weekend_meal_gap")) {
      const hit = HABIT_LESSONS.find((l) => l.tags?.includes("weekend"));
      if (hit) return hit;
    }
  }
  return fallbackLesson(date);
}
