import { describe, expect, it } from "vitest";
import { isQuietHours, saoPauloHour } from "@/lib/push.server";

describe("push quiet hours America/Sao_Paulo", () => {
  it("maps 15:00 UTC to 12:00 in São Paulo (UTC-3)", () => {
    expect(saoPauloHour(new Date("2026-09-19T15:00:00.000Z"))).toBe(12);
  });

  it("is quiet at 23:00 São Paulo", () => {
    expect(isQuietHours(new Date("2026-09-20T02:00:00.000Z"))).toBe(true);
  });

  it("is not quiet at noon São Paulo", () => {
    expect(isQuietHours(new Date("2026-09-19T15:00:00.000Z"))).toBe(false);
  });
});
