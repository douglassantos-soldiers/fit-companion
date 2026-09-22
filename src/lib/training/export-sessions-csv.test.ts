import { describe, expect, it } from "vitest";
import { exportSessionsCsv, SESSIONS_CSV_HEADER } from "@/lib/training/export-sessions-csv";
import type { SessionLog } from "@/lib/types";

describe("exportSessionsCsv", () => {
  it("exports header and one row per set with escaped title", () => {
    const sessions: SessionLog[] = [
      {
        id: "s1",
        dayId: "dia-1",
        title: "Peito, costas",
        date: "2026-09-20T12:00:00.000Z",
        durationMin: 45,
        volumeKg: 1000,
        rpe: "medio",
        exercises: [
          {
            exerciseId: "supino-reto",
            sets: [
              { reps: 8, weightKg: 60, done: true, type: "working", setNumber: 1 },
              { reps: 8, weightKg: 62.5, done: true, type: "working", setNumber: 2 },
            ],
          },
        ],
      },
    ];
    const csv = exportSessionsCsv(sessions);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(SESSIONS_CSV_HEADER);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Peito, costas"');
    expect(lines[1]).toContain("supino-reto");
    expect(lines[1]).toContain(",60,");
    expect(lines[2]).toContain(",62.5,");
  });

  it("returns header only when empty", () => {
    expect(exportSessionsCsv([])).toBe(SESSIONS_CSV_HEADER);
  });
});
