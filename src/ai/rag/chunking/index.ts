/**
 * Deterministic paragraph / size chunking.
 */

import type { KnowledgeChunk } from "@/ai/contracts/knowledge-chunk";
import type { KnowledgeDocument } from "@/ai/contracts/knowledge-document";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3));
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const DEFAULT_CHUNK_SIZE = 480;
export const DEFAULT_CHUNK_OVERLAP = 40;

/** Paragraph pack + hard split. Shared by product chunks and long Markdown sections. */
export function splitTextPieces(
  content: string,
  opts?: { chunkSize?: number; chunkOverlap?: number },
): string[] {
  const chunkSize = opts?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = opts?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  const paragraphs = splitParagraphs(content);
  const pieces: string[] = [];

  if (paragraphs.length === 0) {
    const trimmed = content.trim();
    if (trimmed) pieces.push(trimmed);
  } else {
    let buf = "";
    for (const p of paragraphs) {
      if (!buf) {
        buf = p;
        continue;
      }
      if (`${buf}\n\n${p}`.length <= chunkSize) {
        buf = `${buf}\n\n${p}`;
      } else {
        pieces.push(buf);
        const overlapText = overlap > 0 && buf.length > overlap ? buf.slice(-overlap) : "";
        buf = overlapText ? `${overlapText}\n\n${p}` : p;
      }
    }
    if (buf) pieces.push(buf);
  }

  const finalPieces: string[] = [];
  for (const piece of pieces) {
    if (piece.length <= chunkSize * 2) {
      finalPieces.push(piece);
      continue;
    }
    for (let i = 0; i < piece.length; i += chunkSize - overlap) {
      finalPieces.push(piece.slice(i, i + chunkSize));
    }
  }
  return finalPieces.filter((p) => p.trim().length > 0);
}

export function chunkDocument(
  doc: KnowledgeDocument,
  opts?: { chunkSize?: number; chunkOverlap?: number },
): KnowledgeChunk[] {
  const finalPieces = splitTextPieces(doc.content, opts);

  return finalPieces.map((content, ordinal) => {
    const chunk: KnowledgeChunk = {
      chunk_id: `${doc.document_id}#${ordinal}`,
      document_id: doc.document_id,
      ordinal,
      content,
      token_estimate: estimateTokens(content),
      metadata: {
        domain: doc.domain,
        ...(typeof doc.metadata["kb_ref"] === "string" ? { kb_ref: doc.metadata["kb_ref"] } : {}),
      },
    };
    return chunk;
  });
}
