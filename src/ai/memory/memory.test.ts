/**
 * Memory Layer — unit tests (InMemory store, no live DB).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  MEMORY_ERROR,
  MemoryError,
  createMemory,
  invalidateMemory,
  resetMemoryInfrastructure,
  retrieveMemory,
  updateMemory,
} from "@/ai/memory";

const USER_A = "user-memory-aaaa";
const USER_B = "user-memory-bbbb";

beforeEach(() => {
  resetMemoryInfrastructure();
});

describe("Memory Layer", () => {
  it("denies anonymous access", async () => {
    await expect(
      createMemory({
        trustedUserId: null,
        family: "user",
        type: "facts",
        data: { note: "x" },
        source: "system",
        confidence: 0.8,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.ANONYMOUS_DENIED });

    await expect(retrieveMemory({ trustedUserId: "" })).rejects.toMatchObject({
      code: MEMORY_ERROR.ANONYMOUS_DENIED,
    });
  });

  it("rejects LLM / forbidden sources", async () => {
    await expect(
      createMemory({
        trustedUserId: USER_A,
        family: "user",
        type: "facts",
        data: { note: "from model" },
        source: "llm",
        confidence: 0.9,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.FORBIDDEN_SOURCE });
  });

  it("isolates users (A cannot read or update B)", async () => {
    const created = await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "preferences",
      key: "training_time",
      data: { value: "morning" },
      source: "user",
      confidence: 0.9,
    });

    const bView = await retrieveMemory({ trustedUserId: USER_B, family: "user" });
    expect(bView.records).toHaveLength(0);

    await expect(
      updateMemory({
        trustedUserId: USER_B,
        memoryId: created.record.memory_id,
        patch: { data: { value: "hacked" } },
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.USER_MISMATCH });

    await expect(
      invalidateMemory({
        trustedUserId: USER_B,
        memoryId: created.record.memory_id,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.USER_MISMATCH });
  });

  it("respects expiration", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    await createMemory({
      trustedUserId: USER_A,
      family: "decision",
      type: "mode_history",
      key: "last_mode",
      data: { mode: "deload" },
      source: "decision_engine",
      confidence: 0.85,
      expiresAt: past,
    });

    const active = await retrieveMemory({
      trustedUserId: USER_A,
      family: "decision",
    });
    expect(active.records).toHaveLength(0);

    const withExpired = await retrieveMemory({
      trustedUserId: USER_A,
      family: "decision",
      includeExpired: true,
    });
    expect(withExpired.records).toHaveLength(1);
    expect(withExpired.records[0]!.status).toBe("expired");
  });

  it("updates memory through validation", async () => {
    const created = await createMemory({
      trustedUserId: USER_A,
      family: "outcome",
      type: "outcome_observed",
      key: "d1",
      data: { quality: "pending" },
      source: "system",
      confidence: 0.6,
    });

    const updated = await updateMemory({
      trustedUserId: USER_A,
      memoryId: created.record.memory_id,
      patch: { data: { quality: "success" }, confidence: 0.8 },
    });
    expect(updated.record.data["quality"]).toBe("success");
    expect(updated.record.confidence).toBe(0.8);

    const listed = await retrieveMemory({
      trustedUserId: USER_A,
      family: "outcome",
      key: "d1",
    });
    expect(listed.records[0]!.data["quality"]).toBe("success");
  });

  it("invalidates memory", async () => {
    const created = await createMemory({
      trustedUserId: USER_A,
      family: "learning",
      type: "pattern_detected",
      key: "skip_mondays",
      data: { pattern: "skip_mondays" },
      source: "learning",
      confidence: 0.7,
    });

    await invalidateMemory({
      trustedUserId: USER_A,
      memoryId: created.record.memory_id,
      reason: "user_corrected",
    });

    const active = await retrieveMemory({
      trustedUserId: USER_A,
      family: "learning",
    });
    expect(active.records).toHaveLength(0);

    const all = await retrieveMemory({
      trustedUserId: USER_A,
      family: "learning",
      includeInvalidated: true,
    });
    expect(all.records[0]!.status).toBe("invalidated");
  });

  it("detects conflicting memory on same key", async () => {
    await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "goals",
      key: "primary",
      data: { goal: "massa" },
      source: "user",
      confidence: 0.9,
    });

    await expect(
      createMemory({
        trustedUserId: USER_A,
        family: "user",
        type: "goals",
        key: "primary",
        data: { goal: "cutting" },
        source: "user",
        confidence: 0.9,
      }),
    ).rejects.toBeInstanceOf(MemoryError);

    const superseded = await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "goals",
      key: "primary",
      data: { goal: "cutting" },
      source: "coach",
      confidence: 0.85,
      supersede: true,
    });
    expect(superseded.record.data["goal"]).toBe("cutting");

    const listed = await retrieveMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "goals",
      key: "primary",
    });
    expect(listed.records).toHaveLength(1);
  });

  it("flags low confidence memory and filters by minConfidence", async () => {
    const low = await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "facts",
      key: "guess",
      data: { value: "maybe" },
      source: "coach",
      confidence: 0.2,
    });
    expect(low.warnings).toContain("low_confidence");
    expect(low.record.low_confidence).toBe(true);

    await createMemory({
      trustedUserId: USER_A,
      family: "user",
      type: "facts",
      key: "solid",
      data: { value: "known" },
      source: "user",
      confidence: 0.95,
    });

    const filtered = await retrieveMemory({
      trustedUserId: USER_A,
      family: "user",
      minConfidence: 0.5,
    });
    expect(filtered.records.every((r) => r.confidence >= 0.5)).toBe(true);
    expect(filtered.records.some((r) => r.key === "guess")).toBe(false);
  });

  it("rejects sensitive keys", async () => {
    await expect(
      createMemory({
        trustedUserId: USER_A,
        family: "user",
        type: "facts",
        key: "api_token_secret",
        data: { value: "x" },
        source: "system",
        confidence: 0.5,
      }),
    ).rejects.toMatchObject({ code: MEMORY_ERROR.SENSITIVE_KEY });
  });
});
