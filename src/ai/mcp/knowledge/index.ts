/**
 * MCP knowledge tools — RAG retrieval for specialists/skills (READ).
 * Never returns evidence-policy or spec-training-system documents.
 */
import type { KnowledgeDomain } from "@/ai/contracts/knowledge-document";
import { KNOWLEDGE_DOMAINS } from "@/ai/contracts/knowledge-document";
import { defineReadTool } from "@/ai/mcp/core/define-tool";
import {
  isBlockedFromRagDocId,
  SOLDIERS_RAG_DOC_IDS,
} from "@/ai/rag/corpus/soldiers-knowledge";
import { listKnowledgeDocuments, retrieveKnowledge } from "@/ai/rag";

const ALLOWED_PARENTS = new Set<string>(SOLDIERS_RAG_DOC_IDS);

function parseDomains(raw: unknown): KnowledgeDomain[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out = raw
    .map(String)
    .filter((d): d is KnowledgeDomain =>
      (KNOWLEDGE_DOMAINS as readonly string[]).includes(d),
    );
  return out.length ? out : undefined;
}

export function registerKnowledgeTools(): void {
  defineReadTool({
    id: "search_knowledge",
    name: "search_knowledge",
    description:
      "Busca híbrida nos kb allowlist: kb:tkd.resistido, kb:nutrition.knowledge, kb:supplements.knowledge, kb:safety.knowledge. Não devolve evidence-policy nem spec.",
    permission: "knowledge.read",
    mcp_namespace: "knowledge",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        domains: { type: "array" },
        topK: { type: "number" },
      },
      required: ["query"],
    },
    output_schema: { type: "object", required: ["hits"] },
    handler: async (_ctx, input) => {
      const query = typeof input["query"] === "string" ? input["query"].trim() : "";
      if (!query) return { hits: [], error: "query_required" };
      const domains = parseDomains(input["domains"]);
      const topK =
        typeof input["topK"] === "number" && input["topK"] > 0
          ? Math.min(8, Math.floor(input["topK"]))
          : 5;
      try {
        const { retrieval, citations } = await retrieveKnowledge({
          query,
          ...(domains ? { domains } : {}),
          topK,
        });
        const hits = retrieval.hits
          .filter((h) => {
            const parent =
              typeof h.metadata?.["parent_doc_id"] === "string"
                ? h.metadata["parent_doc_id"]
                : h.document_id.split("__")[0] ?? h.document_id;
            if (isBlockedFromRagDocId(parent) || isBlockedFromRagDocId(h.document_id)) {
              return false;
            }
            return true;
          })
          .map((h) => ({
            document_id: h.document_id,
            title: h.title,
            excerpt: h.excerpt ?? h.content?.slice(0, 280) ?? "",
            score: h.score,
            domain: h.domain,
            kb_ref: h.metadata?.["kb_ref"] ?? null,
          }));
        return {
          hits,
          citations: citations.map((c) => ({
            citation_id: c.citation_id,
            document_id: c.document_id,
            title: c.title,
            score: c.score,
            excerpt: c.excerpt,
          })),
        };
      } catch (e) {
        return {
          hits: [],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
  });

  defineReadTool({
    id: "get_knowledge_document",
    name: "get_knowledge_document",
    description:
      "Lê chunks de um doc allowlist: tkd-resistido-adultos-001, nutrition-knowledge-001, supplements-knowledge-001, safety-knowledge-001.",
    permission: "knowledge.read",
    mcp_namespace: "knowledge",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        document_id: { type: "string" },
      },
      required: ["document_id"],
    },
    output_schema: { type: "object", required: ["ok"] },
    handler: async (_ctx, input) => {
      const document_id =
        typeof input["document_id"] === "string" ? input["document_id"].trim() : "";
      if (!document_id) return { ok: false, error: "document_id_required" };
      if (isBlockedFromRagDocId(document_id)) {
        return { ok: false, error: "document_blocked_from_rag" };
      }
      const parent = document_id.split("__")[0] ?? document_id;
      if (
        !ALLOWED_PARENTS.has(parent) &&
        !document_id.startsWith("doc_") &&
        !ALLOWED_PARENTS.has(document_id)
      ) {
        // Allow FASE 16 doc_* ids and Soldiers parent ids only
        if (!document_id.startsWith("doc_")) {
          return { ok: false, error: "document_not_allowlisted" };
        }
      }
      const docs = listKnowledgeDocuments().filter(
        (d) =>
          d.document_id === document_id ||
          d.document_id.startsWith(`${parent}__`) ||
          (typeof d.metadata["parent_doc_id"] === "string" &&
            d.metadata["parent_doc_id"] === parent),
      );
      return {
        ok: true,
        document_id: parent,
        chunks: docs.map((d) => ({
          document_id: d.document_id,
          title: d.title,
          content: d.content.slice(0, 2000),
          domain: d.domain,
          kb_ref: d.metadata["kb_ref"] ?? null,
        })),
      };
    },
  });
}
