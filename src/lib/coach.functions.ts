import { createServerFn } from "@tanstack/react-start";
import { rateLimitKey, readAccessSession } from "@/lib/access-session.server";
import {
  buildCoachSystemPrompt,
  buildStructuredCoachReply,
  detectCoachIntent,
  parseCoachInput,
  type CoachProvider,
  type CoachStructuredReply,
} from "@/lib/coach-contract";
import { buildCoachContextFromState } from "@/lib/engine/coach-context";

export type { CoachProvider, CoachStructuredReply };
export { parseCoachInput, buildCoachSystemPrompt };

/**
 * AI Coach 2.0 — context built server-side from authenticated user + DB hydrate.
 * Client must NOT send critical context (ignored if present).
 */
export const askAiCoach = createServerFn({ method: "POST" })
  .inputValidator(parseCoachInput)
  .handler(async ({ data }) => {
    const session = readAccessSession();
    if (!session) {
      return { text: "", error: "unauthorized" as const };
    }
    const rlKey = `coach:${session.email}`;
    if (!rateLimitKey(rlKey, 30, 60 * 60_000)) {
      return { text: "", error: "rate_limited" as const };
    }

    const deviceId = data.deviceId?.trim() || "";
    if (!deviceId || deviceId.length < 8) {
      return { text: "", error: "unauthorized" as const };
    }

    const { resolveTrustedIdentity } = await import("@/lib/session-identity.server");
    const identity = await resolveTrustedIdentity({ deviceId, requireAccess: true });
    if (!identity?.userId) {
      return { text: "", error: "unauthorized" as const };
    }

    const { hydrateAppStateFromDb } = await import("@/lib/customer360/hydrate.server");
    let state = await hydrateAppStateFromDb(identity.userId);
    state = { ...state, userId: identity.userId };

    try {
      const { loadCustomerProfile } = await import("@/lib/customer360/recompute.server");
      const c360 = await loadCustomerProfile(identity.userId);
      if (c360?.commerce) {
        state = {
          ...state,
          purchaseProductIds:
            state.purchaseProductIds?.length
              ? state.purchaseProductIds
              : (c360.commerce.productIds ?? state.purchaseProductIds ?? []),
        };
      }
    } catch {
      /* C360 optional enrichment */
    }

    const bundle = buildCoachContextFromState(state);
    const system = buildCoachSystemPrompt(bundle.contextText, bundle.safetyNotice);

    const lastUser = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const intent = detectCoachIntent(lastUser);
    const structured: CoachStructuredReply = buildStructuredCoachReply({
      kind: intent,
      summary:
        intent === "today"
          ? `Hoje: ${bundle.livingSummary}`
          : intent === "why"
            ? bundle.why[0] ?? "O plano reflete as decisões do Decision Engine para o seu contexto de hoje."
            : bundle.livingSummary,
      why: bundle.why,
      decisions: bundle.decisions,
      safetyNotice: bundle.safetyNotice,
    });

    if (data.provider === "chatgpt") {
      const key = process.env["OPENAI_API_KEY"];
      if (!key) return { text: "", structured, error: "not_configured" as const };

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 800,
          messages: [{ role: "system", content: system }, ...data.messages],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("OpenAI error", res.status, detail.slice(0, 200));
        return { text: "", structured, error: "upstream" as const };
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return {
        text: json.choices?.[0]?.message?.content?.trim() || "Não consegui responder agora.",
        structured,
      };
    }

    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) return { text: "", structured, error: "not_configured" as const };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        system,
        messages: data.messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic error", res.status, detail.slice(0, 200));
      return { text: "", structured, error: "upstream" as const };
    }

    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = json.content?.map((c) => c.text ?? "").join("").trim();
    return { text: text || "Não consegui responder agora.", structured };
  });
