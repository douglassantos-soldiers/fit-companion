/**
 * Multilingual neural embedding (dim 256) — offline, deterministic.
 * Concept table (PT/EN) + subword features through a fixed 2-layer MLP
 * with a skip connection so shared concepts stay aligned.
 * Same dimension as pgvector(256); no external model download.
 */

export const NEURAL_EMBEDDING_DIM = 256;
const HIDDEN = 64;
const CONCEPT_SLOTS = 80;

type Concept = { id: string; aliases: string[] };

const CONCEPTS: Concept[] = [
  { id: "creatine", aliases: ["creatina", "creatine", "monoidrato", "monohidrato", "monoidratada"] },
  { id: "whey", aliases: ["whey", "proteina em po", "protein powder"] },
  { id: "caffeine", aliases: ["cafeina", "cafe", "caffeine", "pre treino", "pre-treino"] },
  { id: "supplement", aliases: ["suplemento", "suplementos", "supplement"] },
  { id: "strength", aliases: ["forca", "strength", "hipertrofia"] },
  { id: "load", aliases: ["carga", "progressao", "progression", "volume", "deload"] },
  { id: "training", aliases: ["treino", "treinar", "musculacao", "workout", "resistido"] },
  { id: "protein", aliases: ["proteina", "protein", "macro", "macros"] },
  { id: "meal", aliases: ["refeicao", "refeicoes", "comida", "meal"] },
  { id: "nutrition", aliases: ["nutricao", "dieta", "caloria", "alimento"] },
  { id: "safety_chest", aliases: ["peito", "dor no peito", "aperto no peito", "chest pain"] },
  { id: "emergency", aliases: ["emergencia", "desmaio", "falta de ar", "samu"] },
  { id: "recovery", aliases: ["recuperacao", "fadiga", "cansaco", "recovery", "sono"] },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1);
}

const aliasToConcept = new Map<string, number>();
CONCEPTS.forEach((c, i) => {
  for (const alias of c.aliases) aliasToConcept.set(normalize(alias), i);
});

function conceptIdsFor(text: string): number[] {
  const norm = normalize(text);
  const ids = new Set<number>();
  for (const [alias, id] of aliasToConcept) {
    if (alias.includes(" ") ? norm.includes(alias) : false) ids.add(id);
  }
  for (const token of norm.split(" ")) {
    const direct = aliasToConcept.get(token);
    if (direct != null) {
      ids.add(direct);
      continue;
    }
    for (const [alias, id] of aliasToConcept) {
      if (alias.includes(" ")) continue;
      if (alias.length >= 6 && (token.startsWith(alias) || alias.startsWith(token))) ids.add(id);
    }
  }
  return [...ids];
}

function hash32(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x51e7);
function smallWeight(): number {
  return (rand() * 2 - 1) * 0.08;
}

const W1: number[][] = Array.from({ length: HIDDEN }, () =>
  Array.from({ length: NEURAL_EMBEDDING_DIM }, () => smallWeight()),
);
const B1: number[] = Array.from({ length: HIDDEN }, () => smallWeight());
const W2: number[][] = Array.from({ length: NEURAL_EMBEDDING_DIM }, () =>
  Array.from({ length: HIDDEN }, () => smallWeight()),
);
const B2: number[] = Array.from({ length: NEURAL_EMBEDDING_DIM }, () => smallWeight());

function l2(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function features(text: string): number[] {
  const x = new Array<number>(NEURAL_EMBEDDING_DIM).fill(0);
  for (const id of conceptIdsFor(text)) {
    if (id < CONCEPT_SLOTS) x[id] = (x[id] ?? 0) + 8;
  }
  const tokens = tokenize(text);
  for (const token of tokens) {
    const bucket = CONCEPT_SLOTS + (hash32(token) % (NEURAL_EMBEDDING_DIM - CONCEPT_SLOTS));
    x[bucket] = (x[bucket] ?? 0) + 0.2;
    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i += 1) {
        const tri = token.slice(i, i + 3);
        const tb = CONCEPT_SLOTS + (hash32(`#${tri}`) % (NEURAL_EMBEDDING_DIM - CONCEPT_SLOTS));
        x[tb] = (x[tb] ?? 0) + 0.04;
      }
    }
  }
  return x;
}

function forward(x: number[]): number[] {
  const h = new Array<number>(HIDDEN).fill(0);
  for (let i = 0; i < HIDDEN; i += 1) {
    let s = B1[i] ?? 0;
    const row = W1[i] ?? [];
    for (let j = 0; j < NEURAL_EMBEDDING_DIM; j += 1) {
      s += (row[j] ?? 0) * (x[j] ?? 0);
    }
    h[i] = Math.tanh(s);
  }
  const y = new Array<number>(NEURAL_EMBEDDING_DIM).fill(0);
  for (let i = 0; i < NEURAL_EMBEDDING_DIM; i += 1) {
    let s = B2[i] ?? 0;
    const row = W2[i] ?? [];
    for (let j = 0; j < HIDDEN; j += 1) {
      s += (row[j] ?? 0) * (h[j] ?? 0);
    }
    y[i] = s * 0.35 + (x[i] ?? 0) * 0.65;
  }
  return l2(y);
}

export class MultilingualNeuralEmbeddingProvider {
  readonly id = "multilingual_neural_v1";

  embed(text: string): number[] {
    return forward(features(text));
  }

  embeddingRef(text: string): string {
    const tokens = tokenize(text).slice(0, 48);
    let h = 5381;
    for (const t of tokens) {
      for (let i = 0; i < t.length; i += 1) {
        h = (h << 5) + h + t.charCodeAt(i);
        h |= 0;
      }
    }
    return `${this.id}_${(h >>> 0).toString(16)}`;
  }
}
