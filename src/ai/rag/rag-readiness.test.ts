import { describe, expect, it } from "vitest";
import {
  assertLocalKnowledgeFilesPresent,
  assertProductionSourcesWireAllowlist,
  probeRemoteRagPopulation,
  RAG_ALLOWLIST_DOCS,
} from "./rag-readiness";

describe("RAG readiness", () => {
  it("local allowlist markdown files exist", () => {
    const result = assertLocalKnowledgeFilesPresent();
    expect(result.missing).toEqual([]);
    expect(result.ok).toBe(true);
    expect(RAG_ALLOWLIST_DOCS.length).toBe(4);
  });

  it("production sources wire allowlist ids", () => {
    expect(assertProductionSourcesWireAllowlist()).toBe(true);
  });

  it("remote probe does not invent PASS without credentials", async () => {
    const prevUrl = process.env["SUPABASE_URL"];
    const prevKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const probe = await probeRemoteRagPopulation();
    expect(probe.status).toBe("pending_operator");
    if (prevUrl !== undefined) process.env["SUPABASE_URL"] = prevUrl;
    if (prevKey !== undefined) process.env["SUPABASE_SERVICE_ROLE_KEY"] = prevKey;
  });
});
