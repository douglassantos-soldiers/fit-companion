/**
 * Supplement knowledge skill — deterministic, no individual prescription.
 */
import { defineSkill } from "@/ai/skills/core/define-skill";
import { dateInput, skillOk } from "@/ai/skills/core/helpers";

export function registerSupplementSkills(): void {
  defineSkill({
    id: "explain_supplement",
    name: "explain_supplement",
    description:
      "Explain supplement ingredient evidence from RAG without prescribing individual doses",
    domain: "nutrition",
    kind: "explanation",
    required_tool_ids: ["search_knowledge"],
    required_knowledge: ["kb:supplements.knowledge", "kb:supplementation.timing"],
    safety_requirements: {
      requires_decision_authority: false,
      proposal_only_for_side_effects: true,
      requires_safety_gate: true,
    },
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const query =
        typeof input["query"] === "string" && input["query"].trim()
          ? String(input["query"]).trim()
          : typeof input["ingredient"] === "string"
            ? String(input["ingredient"])
            : "suplementos treino evidência";
      const warnings: string[] = [];
      const tool = await ctx.callTool("search_knowledge", {
        ...di,
        query,
        domains: ["supplementation"],
      });
      if (!tool.ok) {
        warnings.push(`tool_failed:search_knowledge:${tool.error_code ?? "unknown"}`);
        return skillOk(
          {
            summary:
              "Não consegui recuperar a base de suplementos agora. Não invento doses nem claims.",
            hits: [],
            commercial: false,
          },
          [{ signal: "supplements_rag", value: null, source: "search_knowledge" }],
          0.35,
          warnings,
        );
      }
      const data = (tool.data ?? {}) as {
        hits?: Array<{ title?: string; excerpt?: string; document_id?: string; score?: number }>;
      };
      const hits = Array.isArray(data.hits) ? data.hits.slice(0, 5) : [];
      const summary =
        hits.length === 0
          ? "Sem trechos recuperados sobre esse suplemento. Não invento evidência (EVP-111)."
          : `Recuperei ${hits.length} trecho(s) da base de suplementos. Respondo pelo ingrediente/evidência, sem prescrição individual e sem viés comercial (COM).`;
      return skillOk(
        {
          summary,
          hits: hits.map((h) => ({
            title: h.title ?? null,
            excerpt: h.excerpt ?? null,
            document_id: h.document_id ?? null,
            score: h.score ?? null,
          })),
          commercial: false,
          disclaimer:
            "Orientação geral — não substitui nutricionista (CRN). Fontes podem estar pendentes de verificação.",
        },
        [
          {
            signal: "supplements_hit_count",
            value: hits.length,
            source: "search_knowledge",
          },
        ],
        hits.length ? 0.72 : 0.4,
        warnings,
      );
    },
  });
}
