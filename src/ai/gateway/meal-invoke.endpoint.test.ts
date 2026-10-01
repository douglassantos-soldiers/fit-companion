import { describe, expect, it, afterEach } from "vitest";
import { mealOpenAiEndpoint, resolveOpenAiApiBaseUrl } from "@/ai/gateway/meal-invoke";

describe("meal OpenAI endpoint config", () => {
  const prevBase = process.env["AI_OPENAI_BASE_URL"];
  const prevOpen = process.env["OPENAI_BASE_URL"];

  afterEach(() => {
    if (prevBase === undefined) delete process.env["AI_OPENAI_BASE_URL"];
    else process.env["AI_OPENAI_BASE_URL"] = prevBase;
    if (prevOpen === undefined) delete process.env["OPENAI_BASE_URL"];
    else process.env["OPENAI_BASE_URL"] = prevOpen;
  });

  it("defaults to api.openai.com/v1", () => {
    delete process.env["AI_OPENAI_BASE_URL"];
    delete process.env["OPENAI_BASE_URL"];
    expect(resolveOpenAiApiBaseUrl()).toBe("https://api.openai.com/v1");
    expect(mealOpenAiEndpoint("vision")).toBe("https://api.openai.com/v1/chat/completions");
    expect(mealOpenAiEndpoint("whisper")).toBe("https://api.openai.com/v1/audio/transcriptions");
  });

  it("honors AI_OPENAI_BASE_URL without trailing slash duplication", () => {
    process.env["AI_OPENAI_BASE_URL"] = "https://gateway.example/v1/";
    expect(resolveOpenAiApiBaseUrl()).toBe("https://gateway.example/v1");
    expect(mealOpenAiEndpoint("vision")).toBe("https://gateway.example/v1/chat/completions");
  });
});
