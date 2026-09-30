/**
 * Guard: Soldiers KB Markdown allowlist is indexed; policy/spec stay out of RAG.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PRODUCT_KNOWLEDGE_CORPUS } from "@/ai/rag/corpus/product-knowledge";
import {
  isBlockedFromRagDocId,
  loadSoldiersKnowledgeDocuments,
  SOLDIERS_RAG_BLOCKED_DOC_IDS,
  SOLDIERS_RAG_DOC_IDS,
} from "@/ai/rag/corpus/soldiers-knowledge";
import {
  clearKnowledgeStore,
  listConnectedSourceIds,
  registerAllKnowledgeSources,
  resetEmbeddingProvider,
  resetVectorStore,
  seedProductionCorpus,
} from "@/ai/rag";
import { parseFrontmatter, splitMarkdownSections } from "@/ai/rag/ingestion/markdown-knowledge";

const KNOWLEDGE_DIR = join(process.cwd(), "docs", "knowledge");

beforeEach(() => {
  resetVectorStore();
  clearKnowledgeStore();
  resetEmbeddingProvider();
  registerAllKnowledgeSources({ force: true });
});

describe("docs/knowledge RAG integration", () => {
  it("keeps canonical knowledge Markdown in docs/knowledge/", () => {
    const files = readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");
    for (const id of SOLDIERS_RAG_DOC_IDS) {
      expect(files).toContain(`${id}.md`);
    }
    for (const id of SOLDIERS_RAG_BLOCKED_DOC_IDS) {
      expect(files).toContain(`${id}.md`);
    }
  });

  it("parses frontmatter and sections", () => {
    const raw = readFileSync(join(KNOWLEDGE_DIR, "safety-knowledge-001.md"), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    expect(meta["doc_id"]).toBe("safety-knowledge-001");
    expect(meta["indexar_no_rag"]).toMatch(/true/);
    const sections = splitMarkdownSections(body);
    expect(sections.length).toBeGreaterThan(3);
  });

  it("loads Soldiers allowlist docs and never blocked doc_ids as parents", () => {
    const docs = loadSoldiersKnowledgeDocuments();
    expect(docs.length).toBeGreaterThan(8);
    const parents = new Set(
      docs.map((d) =>
        typeof d.metadata["parent_doc_id"] === "string"
          ? d.metadata["parent_doc_id"]
          : d.document_id,
      ),
    );
    for (const id of SOLDIERS_RAG_DOC_IDS) {
      expect(parents.has(id)).toBe(true);
    }
    for (const id of SOLDIERS_RAG_BLOCKED_DOC_IDS) {
      expect(parents.has(id)).toBe(false);
      expect(isBlockedFromRagDocId(id)).toBe(true);
    }
  });

  it("does not place blocked policy/spec ids in PRODUCT_KNOWLEDGE_CORPUS", () => {
    const corpusIds = new Set(PRODUCT_KNOWLEDGE_CORPUS.map((r) => r.document_id));
    for (const id of SOLDIERS_RAG_BLOCKED_DOC_IDS) {
      expect(corpusIds.has(id)).toBe(false);
    }
  });

  it("production sources include soldiers adapters", () => {
    const ids = listConnectedSourceIds();
    expect(ids).toContain("src_soldiers_tkd");
    expect(ids).toContain("src_soldiers_nutrition");
    expect(ids).toContain("src_soldiers_supplements");
    expect(ids).toContain("src_soldiers_safety");
  });

  it("seedProductionCorpus indexes Soldiers KB chunks", async () => {
    const results = await seedProductionCorpus();
    expect(Array.isArray(results) ? results.length : 0).toBeGreaterThan(30);
    const docs = loadSoldiersKnowledgeDocuments();
    const seededIds = new Set(
      (Array.isArray(results) ? results : []).map((r) => r.document_id),
    );
    const sample = docs[0]!;
    expect(seededIds.has(sample.document_id)).toBe(true);
  }, 60_000);
});
