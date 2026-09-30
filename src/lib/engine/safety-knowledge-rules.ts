/**
 * Pinned safety rules from safety-knowledge-001 (runtime, not only RAG).
 * Does not diagnose. Fixed EMERGENCY copy must not be altered by an LLM.
 */

export type SafetyLevel = "GREEN" | "YELLOW" | "RED" | "EMERGENCY";

export type SafetyPatternRule = {
  ruleId: string;
  level: SafetyLevel;
  pattern: RegExp;
  fixedMessageId?: string;
};

/** Fixed messages SAF-500…508 (pending medical/legal approval for production copy). */
export const SAFETY_FIXED_MESSAGES: Record<string, string> = {
  "SAF-500":
    "Pare o exercício agora e não continue o treino. Dor ou aperto no peito, falta de ar forte ou desmaio podem ser sinais de algo sério. Ligue para o SAMU (192) ou vá imediatamente ao pronto-socorro mais próximo. Se estiver sozinho, avise alguém perto de você. Não dirija até ser avaliado.",
  "SAF-501":
    "Esses sinais precisam de atendimento de emergência agora. Ligue para o SAMU (192) imediatamente. Anote o horário em que os sintomas começaram, isso ajuda a equipe médica. Não tome nenhum remédio por conta própria e não dirija.",
  "SAF-502":
    "Dor muscular muito forte com urina escura depois do treino precisa de avaliação médica de emergência hoje. Vá ao pronto-socorro ou ligue para o SAMU (192). Não treine até ser avaliado.",
  "SAF-503":
    "Isso pode ser uma emergência causada pelo calor. Ligue para o SAMU (192) agora. Enquanto a ajuda chega, leve a pessoa para um lugar fresco e com sombra, afrouxe as roupas e molhe o corpo com água fria.",
  "SAF-504":
    "Inchaço no rosto ou na boca ou dificuldade para respirar depois de comer ou tomar algo pode ser uma reação alérgica grave. Ligue para o SAMU (192) agora ou vá ao pronto-socorro mais próximo.",
  "SAF-505":
    "Ligue para o SAMU (192) agora e siga as orientações da central. Fique com a pessoa, não dê comida ou bebida se ela estiver desacordada e, se ela não estiver respirando, informe isso à central imediatamente.",
  "SAF-506":
    "Sinto muito que você esteja passando por isso, e fico feliz que tenha falado. Você não precisa lidar com isso sozinho. O CVV atende pelo telefone 188, 24 horas por dia, ligação gratuita, e também pelo site cvv.org.br. Se você estiver em perigo agora, ligue para o SAMU (192) ou vá ao pronto-socorro mais próximo. Se puder, conte para alguém de confiança como você está.",
  "SAF-507":
    "Vamos parar este exercício por hoje. O que você descreveu merece ser avaliado por um profissional de saúde antes de voltarmos a ele. Se quiser, seguimos com exercícios que não provoquem esse desconforto. Se a dor piorar, aparecer inchaço ou você não conseguir apoiar ou mover, procure atendimento hoje.",
  "SAF-508":
    "Vamos ajustar para não piorar esse desconforto: menos carga e uma amplitude que não doa. Me conte depois como ficou. Se a dor aumentar durante o exercício ou no dia seguinte, a gente para e revê.",
};

/**
 * Detection patterns (normalized lowercase match via .test on original notes).
 * Order: more specific / higher severity first.
 */
export const SAFETY_PATTERN_RULES: readonly SafetyPatternRule[] = [
  {
    ruleId: "SAF-400",
    level: "EMERGENCY",
    pattern:
      /\b(quero\s+morrer|n[aã]o\s+quero\s+mais\s+viver|vou\s+me\s+machucar|queria\s+sumir\s+pra\s+sempre|me\s+matar|autoles[aã]o)\b/i,
    fixedMessageId: "SAF-506",
  },
  {
    ruleId: "SAF-100",
    level: "EMERGENCY",
    pattern:
      /\b(dor\s+no\s+peito|peito\s+apertando|aperto\s+no\s+peito|dor\s+no\s+cora[cç][aã]o|chest\s+pain)\b/i,
    fixedMessageId: "SAF-500",
  },
  {
    ruleId: "SAF-101",
    level: "EMERGENCY",
    pattern:
      /\b(falta\s+de\s+ar|n[aã]o\s+consigo\s+respirar|sem\s+ar\s+mesmo\s+parado|shortness\s+of\s+breath)\b/i,
    fixedMessageId: "SAF-500",
  },
  {
    ruleId: "SAF-102",
    level: "EMERGENCY",
    pattern: /\b(desmaio|desmaiei|apaguei|quase\s+desmaiei|tudo\s+ficou\s+preto|fainted)\b/i,
    fixedMessageId: "SAF-500",
  },
  {
    ruleId: "SAF-110",
    level: "EMERGENCY",
    pattern:
      /\b(boca\s+torta|fala\s+enrolada|n[aã]o\s+sinto\s+um\s+lado|bra[cç]o\s+fraco\s+do\s+nada)\b/i,
    fixedMessageId: "SAF-501",
  },
  {
    ruleId: "SAF-111",
    level: "EMERGENCY",
    pattern: /\b(pior\s+dor\s+de\s+cabe[cç]a|dor\s+de\s+cabe[cç]a\s+explod)/i,
    fixedMessageId: "SAF-501",
  },
  {
    ruleId: "SAF-112",
    level: "EMERGENCY",
    pattern: /\b(convuls[aã]o|seizure)\b/i,
    fixedMessageId: "SAF-501",
  },
  {
    ruleId: "SAF-120",
    level: "EMERGENCY",
    pattern: /\b(urina\s+escura|xixi\s+cor\s+de\s+coca|xixi\s+cor\s+de\s+caf[eé])\b/i,
    fixedMessageId: "SAF-502",
  },
  {
    ruleId: "SAF-140",
    level: "EMERGENCY",
    pattern:
      /\b(boca\s+inchou|l[aá]bio\s+inchado|garganta\s+fechando|incha[cç]o\s+(no\s+)?rosto)\b/i,
    fixedMessageId: "SAF-504",
  },
  {
    ruleId: "SAF-103",
    level: "RED",
    pattern: /\b(palpita[cç][aã]o|batimento\s+irregular|cora[cç][aã]o\s+disparado)\b/i,
    fixedMessageId: "SAF-507",
  },
  {
    ruleId: "SAF-104",
    level: "RED",
    pattern: /\b(tontura\s+forte)\b/i,
    fixedMessageId: "SAF-507",
  },
  {
    ruleId: "SAF-125",
    level: "RED",
    pattern: /\b(panturrilha\s+inchada|batata\s+da\s+perna\s+vermelha)\b/i,
    fixedMessageId: "SAF-507",
  },
];

export type NoteSafetyMatch = {
  level: SafetyLevel;
  ruleIds: string[];
  fixedMessage?: string;
};

const LEVEL_RANK: Record<SafetyLevel, number> = {
  GREEN: 0,
  YELLOW: 1,
  RED: 2,
  EMERGENCY: 3,
};

export function matchSafetyNotes(notes: string | null | undefined): NoteSafetyMatch {
  if (!notes?.trim()) {
    return { level: "GREEN", ruleIds: [] };
  }
  let level: SafetyLevel = "GREEN";
  const ruleIds: string[] = [];
  let fixedMessageId: string | undefined;
  for (const rule of SAFETY_PATTERN_RULES) {
    if (!rule.pattern.test(notes)) continue;
    ruleIds.push(rule.ruleId);
    if (LEVEL_RANK[rule.level] > LEVEL_RANK[level]) {
      level = rule.level;
      fixedMessageId = rule.fixedMessageId;
    } else if (LEVEL_RANK[rule.level] === LEVEL_RANK[level] && !fixedMessageId) {
      fixedMessageId = rule.fixedMessageId;
    }
  }
  const fixedMessage =
    fixedMessageId && SAFETY_FIXED_MESSAGES[fixedMessageId]
      ? SAFETY_FIXED_MESSAGES[fixedMessageId]
      : undefined;
  return {
    level,
    ruleIds,
    ...(fixedMessage ? { fixedMessage } : {}),
  };
}

export function notesSuggestEscalation(notes: string | null | undefined): boolean {
  const m = matchSafetyNotes(notes);
  return m.level === "RED" || m.level === "EMERGENCY";
}
