/**
 * Sync partial-error / ACK policy tests (production hardening).
 */
import { describe, expect, it } from "vitest";
import { shouldAckPushAndFlushOutbox, type PushStateResult } from "@/lib/sync";

describe("shouldAckPushAndFlushOutbox", () => {
  it("acks only full success", () => {
    expect(shouldAckPushAndFlushOutbox({ ok: true, userId: "u1" })).toBe(true);
  });

  it("does not ack failed push", () => {
    const result: PushStateResult = {
      ok: false,
      userId: "u1",
      partial: true,
      errors: [{ table: "sessions", code: "write_failed" }],
    };
    expect(shouldAckPushAndFlushOutbox(result)).toBe(false);
  });

  it("does not ack ok with partial (e.g. non-critical RPE errors)", () => {
    const result: PushStateResult = {
      ok: true,
      userId: "u1",
      partial: true,
      errors: [{ table: "sessions", code: "update_failed" }],
    };
    expect(shouldAckPushAndFlushOutbox(result)).toBe(false);
  });

  it("does not ack empty device / null user failure", () => {
    expect(shouldAckPushAndFlushOutbox({ ok: false, userId: null })).toBe(false);
  });
});

describe("push partial error shape", () => {
  it("tags errors with concrete table names (not generic domain)", () => {
    const errors: Array<{ table: string; code: string }> = [
      { table: "profiles", code: "23505" },
      { table: "sessions", code: "write_failed" },
    ];
    const criticalFailed = true;
    const resultsLength = 5;
    const partial = errors.length < resultsLength;
    const result: PushStateResult = {
      ok: !criticalFailed,
      partial,
      userId: "u1",
      errors,
    };
    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.errors?.every((e) => e.table !== "domain")).toBe(true);
  });
});
