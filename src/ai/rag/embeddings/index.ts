/**
 * Embedding providers — local lexical (deterministic); swappable later.
 */

export type EmbeddingProvider = {
  readonly id: string;
  embed(text: string): number[] | Promise<number[]>;
  embeddingRef(text: string): string;
};

const VOCAB_SIZE = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % VOCAB_SIZE;
}

/** Bag-of-tokens hashed into fixed dim — no external API. */
export class LocalLexicalEmbeddingProvider implements EmbeddingProvider {
  readonly id = "local_lexical_v1";

  embed(text: string): number[] {
    const vec = new Array<number>(VOCAB_SIZE).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vec;
    for (const t of tokens) {
      const idx = hashToken(t);
      vec[idx] = (vec[idx] ?? 0) + 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  embeddingRef(text: string): string {
    const tokens = tokenize(text);
    let h = 5381;
    for (const t of tokens.slice(0, 64)) {
      for (let i = 0; i < t.length; i += 1) {
        h = (h << 5) + h + t.charCodeAt(i);
        h |= 0;
      }
      h = (h << 5) + h + 124;
      h |= 0;
    }
    return `${this.id}_${(h >>> 0).toString(16)}`;
  }
}

let activeProvider: EmbeddingProvider = new LocalLexicalEmbeddingProvider();

export function getEmbeddingProvider(): EmbeddingProvider {
  return activeProvider;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  activeProvider = provider;
}

export function resetEmbeddingProvider(): void {
  activeProvider = new LocalLexicalEmbeddingProvider();
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export { tokenize };
