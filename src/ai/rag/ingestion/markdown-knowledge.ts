/**
 * Parse Soldiers knowledge Markdown (frontmatter + ## sections) into RAG documents.
 * Pure string parser — no filesystem.
 */

import type {
  KnowledgeDocument,
  KnowledgeDomain,
} from "@/ai/contracts/knowledge-document";

export type SoldiersKnowledgeMeta = {
  doc_id: string;
  titulo?: string;
  versao?: string;
  indexar_no_rag?: boolean;
  status?: string;
};

export type SoldiersKnowledgeSpec = {
  filename: string;
  doc_id: string;
  domain: KnowledgeDomain;
  kb_ref: string;
  source_id: string;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    const hash = val.indexOf(" #");
    if (hash > 0) val = val.slice(0, hash).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  }
  return { meta, body: raw.slice(m[0].length) };
}

/** Split body on ## headings into section chunks (keeps heading in content). */
export function splitMarkdownSections(body: string): Array<{ section: string; content: string }> {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ section: string; content: string }> = [];
  let currentHeading = "preamble";
  let buf: string[] = [];

  const flush = () => {
    const content = buf.join("\n").trim();
    if (content.length > 40) {
      sections.push({ section: currentHeading, content });
    }
    buf = [];
  };

  for (const line of lines) {
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      flush();
      currentHeading = h2[1]!.trim().replace(/[^\w\u00C0-\u024F\s.-]+/g, "").slice(0, 80);
      buf.push(line);
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections;
}

export function markdownToKnowledgeDocuments(
  raw: string,
  spec: SoldiersKnowledgeSpec,
): KnowledgeDocument[] {
  const { meta, body } = parseFrontmatter(raw);
  const docId = meta["doc_id"]?.trim() || spec.doc_id;
  if (docId !== spec.doc_id) {
    throw new Error(`doc_id mismatch: expected ${spec.doc_id}, got ${docId}`);
  }
  const version = meta["versao"]?.trim() || "1.0.0";
  const title = meta["titulo"]?.trim() || spec.doc_id;
  const now = new Date().toISOString();
  const sections = splitMarkdownSections(body);
  if (sections.length === 0) {
    return [
      {
        document_id: `${docId}__full`,
        title,
        domain: spec.domain,
        source: "internal_docs",
        source_type: "markdown",
        version,
        language: "pt-BR",
        content: body.trim(),
        source_id: spec.source_id,
        status: "draft",
        effective_date: "2026-09-29",
        expiration_date: null,
        created_at: now,
        updated_at: now,
        metadata: {
          source_id: spec.source_id,
          kb_ref: spec.kb_ref,
          section: "full",
          document_version: version,
          trust_level: "draft_internal",
          parent_doc_id: docId,
          effective_date: "2026-09-29",
        },
        tags: [spec.kb_ref, spec.domain, docId, "soldiers_kb"],
      },
    ];
  }

  return sections.map((sec, i) => {
    const slug = sec.section
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || `sec_${i}`;
    return {
      document_id: `${docId}__${slug}`,
      title: `${title} — ${sec.section}`,
      domain: spec.domain,
      source: "internal_docs" as const,
      source_type: "markdown" as const,
      version,
      language: "pt-BR",
      content: sec.content,
      source_id: spec.source_id,
      status: "draft" as const,
      effective_date: "2026-09-29",
      expiration_date: null,
      created_at: now,
      updated_at: now,
      metadata: {
        source_id: spec.source_id,
        kb_ref: spec.kb_ref,
        section: sec.section,
        document_version: version,
        trust_level: "draft_internal",
        parent_doc_id: docId,
        effective_date: "2026-09-29",
      },
      tags: [spec.kb_ref, spec.domain, docId, "soldiers_kb", slug],
    };
  });
}
