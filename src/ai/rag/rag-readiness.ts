/**
 * RAG readiness — corpus allowlist + optional remote population probe.
 * Does not invent PASS for empty remote stores.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const RAG_ALLOWLIST_DOCS = [
  "tkd-resistido-adultos-001",
  "nutrition-knowledge-001",
  "supplements-knowledge-001",
  "safety-knowledge-001",
] as const;

export function assertLocalKnowledgeFilesPresent(
  knowledgeDir = join(process.cwd(), "docs", "knowledge"),
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const id of RAG_ALLOWLIST_DOCS) {
    const md = join(knowledgeDir, `${id}.md`);
    if (!existsSync(md)) missing.push(md);
  }
  return { ok: missing.length === 0, missing };
}

export function assertProductionSourcesWireAllowlist(
  soldiersKnowledgePath = join(
    process.cwd(),
    "src",
    "ai",
    "rag",
    "corpus",
    "soldiers-knowledge.ts",
  ),
): boolean {
  const src = readFileSync(soldiersKnowledgePath, "utf8");
  return RAG_ALLOWLIST_DOCS.every((id) => src.includes(id));
}

export type RemoteRagProbe = {
  status: "pass" | "fail" | "pending_operator";
  evidence: string[];
  documentCount?: number;
  chunkCount?: number;
};

export async function probeRemoteRagPopulation(): Promise<RemoteRagProbe> {
  const url = process.env["SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key) {
    return {
      status: "pending_operator",
      evidence: [
        "SUPABASE credentials absent — cannot prove ai_knowledge_* population",
        "Run npm run rag:seed against production after credentials are available",
      ],
    };
  }

  try {
    const base = url.replace(/\/$/, "");
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    };
    const docs = await fetch(`${base}/rest/v1/ai_knowledge_documents?select=document_id`, {
      headers: { ...headers, Range: "0-0" },
    });
    const chunks = await fetch(`${base}/rest/v1/ai_knowledge_chunks?select=id`, {
      headers: { ...headers, Range: "0-0" },
    });
    const docCount = Number(docs.headers.get("content-range")?.split("/")[1] ?? "0");
    const chunkCount = Number(chunks.headers.get("content-range")?.split("/")[1] ?? "0");
    if (!docs.ok || !chunks.ok) {
      return {
        status: "pending_operator",
        evidence: [`REST status docs=${docs.status} chunks=${chunks.status}`],
        documentCount: docCount,
        chunkCount,
      };
    }
    if (docCount < 1 || chunkCount < 1) {
      return {
        status: "fail",
        evidence: ["Remote RAG store empty — product depends on seeded knowledge"],
        documentCount: docCount,
        chunkCount,
      };
    }
    return {
      status: "pass",
      evidence: [`docs=${docCount} chunks=${chunkCount}`],
      documentCount: docCount,
      chunkCount,
    };
  } catch (e) {
    return {
      status: "pending_operator",
      evidence: [e instanceof Error ? e.message : "probe_error"],
    };
  }
}
