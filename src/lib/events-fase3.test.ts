/**
 * FASE 3 event normalize + conflict + day-checkin mapping tests.
 */
import { describe, expect, it } from "vitest";
import {
  buildIdempotencyKey,
  normalizeEventType,
  sanitizeMetadata,
} from "@/lib/events/normalize";
import { CANONICAL_EVENT_TYPES } from "@/lib/events/types";
import { nextVersion, shouldAcceptWrite } from "@/lib/sync/conflict";
import {
  dayCheckInToRow,
  mergeDayCheckIns,
  recentDayCheckIns,
  rowToDayCheckIn,
} from "@/lib/sync/day-checkin";
import type { DayCheckIn } from "@/lib/types";

describe("normalizeEventType aliases", () => {
  it("maps legacy names to canonical FASE 3 types", () => {
    expect(normalizeEventType("restock_cta_click")).toBe("restock_clicked");
    expect(normalizeEventType("checkin_sleep")).toBe("checkin_completed");
    expect(normalizeEventType("challenge_join")).toBe("challenge_joined");
    expect(normalizeEventType("challenge_started")).toBe("challenge_joined");
    expect(normalizeEventType("challenge_complete")).toBe("challenge_completed");
  });

  it("keeps canonical types unchanged", () => {
    for (const t of CANONICAL_EVENT_TYPES) {
      expect(normalizeEventType(t)).toBe(t);
    }
  });
});

describe("sanitizeMetadata", () => {
  it("strips sensitive keys and truncates notes", () => {
    const clean = sanitizeMetadata({
      date: "2026-09-18",
      email: "secret@x.com",
      token: "abc",
      notes: "x".repeat(400),
      sleepHours: 7,
    });
    expect(clean["email"]).toBeUndefined();
    expect(clean["token"]).toBeUndefined();
    expect(clean["sleepHours"]).toBe(7);
    expect(String(clean["notes"]).length).toBeLessThanOrEqual(280);
  });
});

describe("buildIdempotencyKey", () => {
  it("builds stable keys for workouts and checkins", () => {
    expect(buildIdempotencyKey("workout_started", { entityId: "day-a" })).toBe(
      "workout:day-a:workout_started",
    );
    expect(buildIdempotencyKey("checkin_sleep", { date: "2026-09-18" })).toBe("checkin:2026-09-18");
  });
});

describe("shouldAcceptWrite / nextVersion", () => {
  it("accepts when incoming version is newer or equal", () => {
    expect(shouldAcceptWrite({ version: 2, updated_at: "2026-01-01T00:00:00Z" }, { version: 2 })).toBe(
      true,
    );
    expect(shouldAcceptWrite({ version: 3, updated_at: "2026-01-01T00:00:00Z" }, { version: 2 })).toBe(
      false,
    );
  });

  it("falls back to timestamps when versions missing", () => {
    expect(
      shouldAcceptWrite(
        { version: 0, updated_at: "2026-01-02T00:00:00Z" },
        { version: 0, clientUpdatedAt: "2026-01-03T00:00:00Z" },
      ),
    ).toBe(true);
    expect(
      shouldAcceptWrite(
        { version: 0, updated_at: "2026-01-05T00:00:00Z" },
        { version: 0, clientUpdatedAt: "2026-01-03T00:00:00Z" },
      ),
    ).toBe(false);
  });

  it("increments version", () => {
    expect(nextVersion(undefined)).toBe(1);
    expect(nextVersion(4)).toBe(5);
  });
});

describe("day_checkin mapping", () => {
  it("round-trips AppState ↔ row", () => {
    const checkIn: DayCheckIn = {
      date: "2026-09-18",
      sleepHours: 7.5,
      energy: "ok",
      availableMin: 40,
      noEquipment: true,
      soreness: 2,
      stress: 4,
      notes: "viagem",
      version: 1,
    };
    const row = dayCheckInToRow(checkIn, { user_id: "u1", device_id: "d1" }, 2);
    expect(row["sleep"]).toBe(7.5);
    expect(row["available_time"]).toBe(40);
    expect(row["equipment"]).toBe("none");
    expect(row["version"]).toBe(2);

    const back = rowToDayCheckIn(row);
    expect(back.date).toBe("2026-09-18");
    expect(back.sleepHours).toBe(7.5);
    expect(back.noEquipment).toBe(true);
    expect(back.soreness).toBe(2);
    expect(back.stress).toBe(4);
  });

  it("merges table over retention by version", () => {
    const retention: Record<string, DayCheckIn> = {
      "2026-09-18": {
        date: "2026-09-18",
        sleepHours: 6,
        energy: "baixa",
        availableMin: 25,
        version: 1,
      },
    };
    const merged = mergeDayCheckIns(retention, [
      {
        date: "2026-09-18",
        sleepHours: 8,
        energy: "alta",
        availableMin: 60,
        version: 2,
      },
    ]);
    expect(merged["2026-09-18"]?.sleepHours).toBe(8);
  });

  it("recentDayCheckIns sorts by date desc", () => {
    const recent = recentDayCheckIns(
      {
        "2026-09-10": { date: "2026-09-10", sleepHours: 7, energy: "ok", availableMin: 60 },
        "2026-09-18": { date: "2026-09-18", sleepHours: 8, energy: "alta", availableMin: 40 },
        "2026-09-15": { date: "2026-09-15", sleepHours: 6, energy: "baixa", availableMin: 25 },
      },
      2,
    );
    expect(recent.map((c) => c.date)).toEqual(["2026-09-18", "2026-09-15"]);
  });
});

describe("outbox op shape", () => {
  it("event op includes idempotency fields", () => {
    const op = {
      opId: "workout:day-a:workout_started",
      kind: "event" as const,
      createdAt: new Date().toISOString(),
      deviceId: "device-12345678",
      eventType: "workout_started",
      metadata: { dayId: "day-a" },
      occurredAt: new Date().toISOString(),
      source: "app",
      idempotencyKey: "workout:day-a:workout_started",
    };
    expect(op.kind).toBe("event");
    expect(op.idempotencyKey).toContain("workout_started");
  });
});
