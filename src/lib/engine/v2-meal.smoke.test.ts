/**
 * V2 relative challenges + meal-ai contract smoke tests.
 * Run: npm test
 */
import { describe, expect, it } from "vitest";
import { challengeById } from "@/data/challenges";
import { challengeProgress, challengeRawValue } from "@/lib/social";
import { relativeRankOrder } from "@/lib/engine/proof-of-performance";
import {
  parseMealAiInput,
  parseMealAiSuggestion,
  mealAiSystemPrompt,
} from "@/lib/meal-ai-contract";
import { emptyState, type SessionLog } from "@/lib/types";

function session(date: string, volumeKg: number): SessionLog {
  return {
    id: `s-${date}-${volumeKg}`,
    dayId: "d1",
    title: "Treino",
    date,
    durationMin: 45,
    exercises: [],
    volumeKg,
  };
}

describe("relative challenges", () => {
  it("computes % evolution vs baseline and completes at targetPct", () => {
    const c = challengeById("evolucao-volume-21")!;
    expect(c.rankingMode).toBe("relative");

    const baselineSessions = [session("2026-09-01", 5000), session("2026-09-03", 5000)];
    const baseline = challengeRawValue(c, baselineSessions);

    const grown = [
      ...baselineSessions,
      session("2026-09-10", 2000),
      session("2026-09-12", 2000),
    ];
    // Note: window is last 21 days from "now" — use high volumes to ensure pct
    const progress = challengeProgress(c, grown, baseline);
    expect(progress.baseline).toBe(baseline);
    expect(progress.pct).toBeGreaterThanOrEqual(0);

    // Force completion: baseline 100, current 125 → +25% >= 20%
    const p = challengeProgress(c, [session(new Date().toISOString().slice(0, 10), 125)], 100);
    expect(p.pct).toBe(25);
    expect(p.complete).toBe(true);
    expect(p.displayUnit).toBe("%");
  });

  it("ranks by % evolution not absolute volume (persona A vs B)", () => {
    // B has less absolute kg but higher % vs baseline
    const order = relativeRankOrder([
      { id: "A", current: 50000, baseline: 45000 }, // ~11%
      { id: "B", current: 12000, baseline: 8000 }, // 50%
    ]);
    expect(order[0]).toBe("B");
    expect(order[1]).toBe("A");
  });

  it("absolute challenges still use raw targets", () => {
    const c = challengeById("semana-perfeita")!;
    const today = new Date().toISOString().slice(0, 10);
    const sessions = Array.from({ length: 5 }, (_, i) =>
      session(today, 1000 + i),
    );
    // Same-day sessions: raw count is 5 if dates collide — use distinct dates
    const distinct = Array.from({ length: 5 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return session(d.toISOString().slice(0, 10), 1000);
    });
    const p = challengeProgress(c, distinct, 0);
    expect(p.complete).toBe(true);
    expect(p.displayUnit).toBe("treinos");
  });
});

describe("meal-ai contract", () => {
  it("parses valid photo/text input and rejects bad payloads", () => {
    expect(() => parseMealAiInput({})).toThrow(/Modo/);
    expect(() => parseMealAiInput({ mode: "text", slot: "almoco" })).toThrow(/Texto/);
    const text = parseMealAiInput({
      mode: "text",
      slot: "almoco",
      text: "arroz feijão frango",
    });
    expect(text.mode).toBe("text");

    const photo = parseMealAiInput({
      mode: "photo",
      slot: "jantar",
      mediaBase64: "aGVsbG8=",
      mimeType: "image/jpeg",
    });
    expect(photo.mediaBase64).toBe("aGVsbG8=");
  });

  it("parses suggestion JSON and strips fences", () => {
    const s = parseMealAiSuggestion(
      '```json\n{"label":"Frango com arroz","proteinG":42,"kcal":520,"quality":"verde","confidence":0.8}\n```',
    );
    expect(s.label).toContain("Frango");
    expect(s.proteinG).toBe(42);
    expect(s.quality).toBe("verde");
  });

  it("builds system prompt with slot", () => {
    expect(mealAiSystemPrompt("cafe")).toContain("cafe");
    expect(mealAiSystemPrompt("almoco")).toContain("JSON");
  });
});

describe("empty state has challengeBaselines", () => {
  it("defaults challengeBaselines to {}", () => {
    expect(emptyState.challengeBaselines).toEqual({});
  });
});
