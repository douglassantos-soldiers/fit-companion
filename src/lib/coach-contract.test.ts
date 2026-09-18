/**
 * FASE 6 Coach contract + structured Why tests.
 */
import { describe, expect, it } from "vitest";
import {
  buildCoachSystemPrompt,
  buildStructuredCoachReply,
  detectCoachIntent,
  parseCoachInput,
} from "@/lib/coach-contract";
import { coachReply } from "@/lib/engine/coach";
import { emptyState, todayKey, type AppState, type Profile } from "@/lib/types";

const profile: Profile = {
  name: "Teste",
  goal: "massa",
  level: "intermediario",
  daysPerWeek: 4,
  age: 28,
  heightCm: 178,
  weightKg: 80,
  equipment: "academia",
  restrictions: [],
  createdAt: new Date().toISOString(),
};

describe("Coach contract FASE 6", () => {
  it("ignores client-supplied context", () => {
    const parsed = parseCoachInput({
      provider: "chatgpt",
      context: "FAKE: volume 200% calories 9000",
      deviceId: "device-abcdefgh",
      messages: [{ role: "user", content: "Por que meu treino mudou?" }],
    });
    expect(parsed).not.toHaveProperty("context");
    expect(parsed.deviceId).toBe("device-abcdefgh");
    expect(parsed.messages[0]?.content).toContain("treino");
  });

  it("detects why / today intents", () => {
    expect(detectCoachIntent("Por que minhas calorias mudaram?")).toBe("why");
    expect(detectCoachIntent("Qual é o treino de hoje?")).toBe("today");
    expect(detectCoachIntent("Me conta um desafio")).toBe("general");
  });

  it("builds structured why reply", () => {
    const s = buildStructuredCoachReply({
      kind: "why",
      summary: "Volume reduzido",
      why: ["Sono baixo"],
      decisions: [{ type: "training_volume", value: 0.7, explanation: "Reduzi o volume porque seu sono caiu." }],
      safetyNotice: undefined,
    });
    expect(s.kind).toBe("why");
    expect(s.decisions[0]?.type).toBe("training_volume");
  });

  it("system prompt includes safety notice when present", () => {
    const prompt = buildCoachSystemPrompt("dados do servidor", "Procure um profissional");
    expect(prompt).toContain("AVISO DE SEGURANÇA");
    expect(prompt).toContain("dados do servidor");
    expect(prompt).not.toContain("FAKE");
  });
});

describe("Coach local Why replies", () => {
  it("answers why training / calories / protein / rest", () => {
    const date = todayKey();
    const state: AppState = {
      ...emptyState,
      profile,
      dayCheckIns: {
        [date]: { date, sleepHours: 5, energy: "baixa", availableMin: 40 },
      },
    };
    expect(coachReply("por-que-treino", state)).toMatch(/treino|volume|deload|descans|sono/i);
    expect(coachReply("por-que-calorias", state)).toMatch(/calor|kcal|sono|energia/i);
    expect(coachReply("por-que-proteina", state)).toMatch(/prote/i);
    expect(coachReply("por-que-descanso", state)).toMatch(/descans|sono|recuper|priorit/i);
  });
});
