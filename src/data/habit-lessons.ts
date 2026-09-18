import { todayKey } from "@/lib/types";

export interface HabitLesson {
  id: string;
  title: string;
  body: string;
  tip: string;
}

export const HABIT_LESSONS: HabitLesson[] = [
  {
    id: "proteina",
    title: "Proteína em cada refeição",
    body: "Distribuir proteína ao longo do dia estabiliza a fome e ajuda a recuperar o treino. Uma porção do tamanho da palma da mão já conta.",
    tip: "Comece pelo café: ovos ou whey mudam o resto do dia.",
  },
  {
    id: "fome-vontade",
    title: "Fome vs vontade",
    body: "Fome física cresce devagar e aceita opções simples. Vontade aparece de repente e pede um alimento específico. Nomear a diferença já reduz impulsos.",
    tip: "Espere 10 minutos e beba água antes de decidir.",
  },
  {
    id: "agua",
    title: "Água como hábito âncora",
    body: "Hidratação baixa parece cansaço ou fome. Ligar água ao café da manhã e ao pós-treino cria duas doses automáticas.",
    tip: "Meta mínima: 35 ml por kg de peso corporal.",
  },
  {
    id: "sono",
    title: "Sono é recuperação",
    body: "Sem sono, a fome sobe e a força cai. Tratar o horário de dormir como treino fixo rende mais do que um suplemento extra.",
    tip: "Mesmo horário ±30 min por 5 noites seguidas.",
  },
  {
    id: "consistencia",
    title: "Consistência > perfeição",
    body: "Um dia médio repetido vence um dia perfeito seguido de abandono. O app mede sequência porque ela muda identidade: você é alguém que treina.",
    tip: "Se o dia apertar, faça a versão de 20 minutos.",
  },
  {
    id: "pos-treino",
    title: "Janela pós-treino",
    body: "Não precisa de refeição mágica. Proteína + carboidrato nas horas seguintes ao treino acelera a recuperação sem complicar.",
    tip: "Whey + fruta resolve quando você está longe de casa.",
  },
  {
    id: "verde-amarelo",
    title: "Cores sem culpa",
    body: "Verde, amarelo e laranja são guias de densidade nutricional — não moral. Comer laranja às vezes é normal; o padrão da semana importa.",
    tip: "Busque maioria verde/amarelo, não zero laranja.",
  },
  {
    id: "streak",
    title: "Streak com flexibilidade",
    body: "Quebrar a sequência dói, mas recomeçar no mesmo dia vale mais do que esperar segunda-feira. Identidade se reconstrói na próxima ação.",
    tip: "Se falhou de manhã, registre a próxima refeição mesmo assim.",
  },
  {
    id: "ambiente",
    title: "Ambiente decide por você",
    body: "Deixar proteína pronta e esconder o snack impulsivo muda o padrão sem depender de força de vontade o dia inteiro.",
    tip: "Prepare o almoço na noite anterior uma vez por semana.",
  },
  {
    id: "suplemento",
    title: "Suplemento não substitui base",
    body: "Creatina e whey ajudam quando a rotina já existe. Sem treino e sem proteína na comida, o pote vira só ritual.",
    tip: "Marque a dose no horário fixo — aderência conta.",
  },
  {
    id: "estresse",
    title: "Estresse e fome emocional",
    body: "Sob estresse o cérebro pede alívio rápido. Um ritual de 5 minutos (caminhada, banho, respiração) compete com a geladeira.",
    tip: "Liste 2 alívios que não sejam comida.",
  },
  {
    id: "progressao",
    title: "Progressão também na mesa",
    body: "Assim como a carga sobe no treino, a proteína pode subir 10–20 g por dia até bater a meta. Pequenos upgrades acumulam.",
    tip: "Adicione uma porção extra de proteína no almoço esta semana.",
  },
  {
    id: "social",
    title: "Comer fora sem derrubar o plano",
    body: "Escolha proteína primeiro no cardápio, depois o acompanhamento. Isso mantém o alvo sem transformar o jantar em restrição.",
    tip: "Peça água e salada junto — volume ajuda a saciedade.",
  },
  {
    id: "manha",
    title: "Vitória da manhã",
    body: "Os primeiros 60 minutos definem o tom: água, proteína e o treino ou a mobilidade. Quem ganha a manhã erra menos à noite.",
    tip: "Deixe a garrafa e o whey prontos na noite anterior.",
  },
];

export function lessonForToday(date = new Date()): HabitLesson {
  const key = todayKey(date);
  const dayIndex = Math.floor(new Date(key + "T12:00:00").getTime() / 86400000);
  const idx = ((dayIndex % HABIT_LESSONS.length) + HABIT_LESSONS.length) % HABIT_LESSONS.length;
  return HABIT_LESSONS[idx]!;
}
