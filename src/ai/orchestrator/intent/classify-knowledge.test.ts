/**
 * Intent classification — supplementation + training domains.
 */
import { describe, expect, it } from "vitest";
import { classifyIntent } from "@/ai/orchestrator/intent/classify";

describe("classifyIntent Soldiers KB", () => {
  it("maps creatina / whey to supplementation domain and knowledge tools", () => {
    const c = classifyIntent("posso tomar creatina com whey?");
    expect(c.knowledgeDomains).toContain("supplementation");
    expect(c.skillHints).toContain("explain_supplement");
    expect(c.toolHints).toContain("search_knowledge");
    expect(c.labels).toContain("supplementation");
  });

  it("includes training domain for treino intents", () => {
    const c = classifyIntent("como progressão de carga no treino?");
    expect(c.knowledgeDomains).toContain("training");
    expect(c.toolHints).toContain("search_knowledge");
  });
});
