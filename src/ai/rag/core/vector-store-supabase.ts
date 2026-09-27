/**
 * Supabase pgvector VectorStore — service_role only (ai_knowledge_*).
 * Corpus is global product knowledge (no per-user PII).
 */

import type { KnowledgeChunk } from "@/ai/contracts/knowledge-chunk";
import type { KnowledgeDocument, KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { expandDomainFilter } from "@/ai/contracts/knowledge-document";
import type { StoredVectorHit, VectorQueryOpts, VectorStore } from "@/ai/rag/core/vector-store";
import { cosineSimilarity } from "@/ai/rag/embeddings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseDb = { from: (table: string) => any };

function toVectorLiteral(emb: number[]): string {
  return `[${emb.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

function rowToHit(row: Record<string, unknown>): StoredVectorHit {
  const meta = (row["metadata"] ?? {}) as Record<string, string | number | boolean | null>;
  const embRaw = row["embedding"];
  let embedding: number[] | undefined;
  if (Array.isArray(embRaw)) embedding = embRaw.map(Number);
  else if (typeof embRaw === "string") {
    try {
      const parsed = JSON.parse(embRaw.replace(/^\[/, "[").replace(/\]$/, "]"));
      if (Array.isArray(parsed)) embedding = parsed.map(Number);
    } catch {
      /* ignore */
    }
  }

  const document: KnowledgeDocument = {
    document_id: String(row["document_id"]),
    title: String(row["title"] ?? ""),
    domain: row["domain"] as KnowledgeDomain,
    source: "internal_docs",
    source_type: "structured",
    version: String(row["document_version"] ?? "1"),
    language: String(row["language"] ?? "pt-BR"),
    content: String(row["document_content"] ?? row["content"] ?? ""),
    metadata: meta,
    created_at: String(row["created_at"] ?? new Date().toISOString()),
    updated_at: String(row["updated_at"] ?? new Date().toISOString()),
    source_id: typeof row["source_id"] === "string" ? row["source_id"] : undefined,
    status: (row["doc_status"] as KnowledgeDocument["status"]) ?? "active",
    effective_date: typeof row["effective_date"] === "string" ? row["effective_date"] : undefined,
    expiration_date:
      row["expiration_date"] == null ? null : String(row["expiration_date"]),
  };

  const chunk: KnowledgeChunk = {
    chunk_id: String(row["chunk_id"]),
    document_id: document.document_id,
    ordinal: Number(row["ordinal"] ?? 0),
    content: String(row["content"] ?? ""),
    ...(embedding ? { embedding } : {}),
    ...(typeof row["embedding_ref"] === "string" ? { embedding_ref: row["embedding_ref"] } : {}),
    metadata: meta,
  };

  return { document, chunk };
}

export class SupabasePgvectorStore implements VectorStore {
  readonly id = "supabase_pgvector_v1";

  constructor(private readonly getDb: () => Promise<LooseDb | null>) {}

  private async db(): Promise<LooseDb> {
    const db = await this.getDb();
    if (!db) throw new Error("admin_db_unavailable");
    return db;
  }

  async upsertEntry(document: KnowledgeDocument, chunks: KnowledgeChunk[]): Promise<void> {
    const db = await this.db();
    const { error: docErr } = await db.from("ai_knowledge_documents").upsert({
      document_id: document.document_id,
      source_id: document.source_id ?? document.metadata["source_id"] ?? null,
      title: document.title,
      domain: document.domain,
      version: document.version,
      language: document.language,
      content: document.content,
      status: document.status ?? "active",
      effective_date: document.effective_date ?? null,
      expiration_date: document.expiration_date ?? null,
      metadata: document.metadata,
      updated_at: new Date().toISOString(),
      created_at: document.created_at,
    });
    if (docErr) throw new Error(String(docErr.message));

    for (const chunk of chunks) {
      const emb = chunk.embedding ?? [];
      const { error } = await db.from("ai_knowledge_chunks").upsert({
        chunk_id: chunk.chunk_id,
        document_id: document.document_id,
        source_id: document.source_id ?? document.metadata["source_id"] ?? null,
        ordinal: chunk.ordinal,
        content: chunk.content,
        embedding: emb.length ? toVectorLiteral(emb) : null,
        embedding_provider: "local_lexical_v1",
        embedding_ref: chunk.embedding_ref ?? null,
        document_version: document.version,
        metadata: { ...document.metadata, ...(chunk.metadata ?? {}) },
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(String(error.message));
    }
  }

  async listByFilter(opts: VectorQueryOpts): Promise<StoredVectorHit[]> {
    const db = await this.db();
    let q = db
      .from("ai_knowledge_chunks")
      .select(
        "chunk_id, document_id, source_id, ordinal, content, embedding, embedding_ref, document_version, metadata, created_at, updated_at",
      )
      .limit(500);

    const { data, error } = await q;
    if (error) throw new Error(String(error.message));

    const domains = expandDomainFilter(opts.domains);
    const asOf = opts.asOf ?? new Date().toISOString();
    const rows = (data ?? []) as Record<string, unknown>[];

    // Join document metadata via second query (simple; production can use view)
    const docIds = [...new Set(rows.map((r) => String(r["document_id"])))];
    const { data: docs } = await db
      .from("ai_knowledge_documents")
      .select("*")
      .in("document_id", docIds.length ? docIds : ["__none__"]);
    const docMap = new Map<string, Record<string, unknown>>();
    for (const d of (docs ?? []) as Record<string, unknown>[]) {
      docMap.set(String(d["document_id"]), d);
    }

    const out: StoredVectorHit[] = [];
    for (const row of rows) {
      const docRow = docMap.get(String(row["document_id"]));
      if (!docRow) continue;
      const merged = {
        ...row,
        title: docRow["title"],
        domain: docRow["domain"],
        language: docRow["language"],
        document_content: docRow["content"],
        doc_status: docRow["status"],
        effective_date: docRow["effective_date"],
        expiration_date: docRow["expiration_date"],
        document_version: docRow["version"] ?? row["document_version"],
      };
      const hit = rowToHit(merged);
      if (domains && domains.length > 0 && !domains.includes(hit.document.domain)) continue;
      if (opts.kbRefs && opts.kbRefs.length > 0) {
        const ref = hit.chunk.metadata?.["kb_ref"] ?? hit.document.metadata["kb_ref"];
        if (typeof ref !== "string" || !opts.kbRefs.includes(ref)) continue;
      }
      if (opts.metadata) {
        let ok = true;
        for (const [k, v] of Object.entries(opts.metadata)) {
          if (hit.document.metadata[k] !== v) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
      // freshness
      if (hit.document.effective_date && Date.parse(hit.document.effective_date) > Date.parse(asOf)) {
        continue;
      }
      if (
        hit.document.expiration_date &&
        Date.parse(hit.document.expiration_date) < Date.parse(asOf)
      ) {
        continue;
      }
      if (hit.document.status === "superseded" || hit.document.status === "draft") continue;
      out.push(hit);
    }
    return out;
  }

  async querySimilar(opts: VectorQueryOpts): Promise<StoredVectorHit[]> {
    const candidates = await this.listByFilter(opts);
    const emb = opts.embedding;
    if (!emb?.length) return candidates;
    // Client-side cosine (works even if RPC match unavailable); ANN RPC can replace later
    const scored = candidates
      .map((h) => ({
        hit: h,
        sim: cosineSimilarity(emb, h.chunk.embedding ?? []),
      }))
      .sort((a, b) => b.sim - a.sim);
    return scored.slice(0, opts.topK ?? 50).map((s) => s.hit);
  }

  async getChunk(chunkId: string): Promise<StoredVectorHit | null> {
    const all = await this.listByFilter({});
    return all.find((h) => h.chunk.chunk_id === chunkId) ?? null;
  }

  async deleteByDocument(documentId: string): Promise<void> {
    const db = await this.db();
    await db.from("ai_knowledge_chunks").delete().eq("document_id", documentId);
    await db.from("ai_knowledge_documents").delete().eq("document_id", documentId);
  }
}

export async function createSupabasePgvectorStore(): Promise<VectorStore | null> {
  try {
    const { adminDbLoose } = await import("@/lib/db-admin");
    return new SupabasePgvectorStore(async () => {
      try {
        return await adminDbLoose();
      } catch {
        return null;
      }
    });
  } catch {
    return null;
  }
}
