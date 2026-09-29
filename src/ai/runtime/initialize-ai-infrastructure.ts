/**
 * FASE 23.4 — Central AI infrastructure bootstrap (awaited).
 * Single initializer: RAG → Memory → Rate Limit store → readiness marks.
 * Do not fire-and-forget critical dependencies in production.
 */

import { ensureVectorStore } from "@/ai/rag/core/vector-store";
import { registerAllKnowledgeSources } from "@/ai/rag/sources";
import { ensureMemoryStore } from "@/ai/memory/store/types";
import { resolveAiRateLimitStore } from "@/ai/runtime/rate-limit-store";
import { getRagReadiness } from "@/ai/rag/health";
import { getMemoryReadiness } from "@/ai/memory/health";
import { getLlmReadiness } from "@/ai/gateway/health";
import { resolveRagEnvironment } from "@/ai/rag/runtime/env";
import { resolveMemoryEnvironment } from "@/ai/memory/runtime/env";

export type AiInfrastructureStatus = "pending" | "ready" | "degraded" | "unavailable";

export type AiInfrastructureReport = {
  status: AiInfrastructureStatus;
  ready: boolean;
  rag: { ready: boolean; reasons: string[] };
  memory: { ready: boolean; reasons: string[] };
  llm: { ready: boolean; reasons: string[] };
  rate_limit: { ready: boolean; detail?: string };
  initialized_at: string;
  error?: string;
};

let initPromise: Promise<AiInfrastructureReport> | null = null;
let lastReport: AiInfrastructureReport | null = null;

function emptyReport(partial?: Partial<AiInfrastructureReport>): AiInfrastructureReport {
  return {
    status: "pending",
    ready: false,
    rag: { ready: false, reasons: ["not_initialized"] },
    memory: { ready: false, reasons: ["not_initialized"] },
    llm: { ready: false, reasons: ["not_initialized"] },
    rate_limit: { ready: false, detail: "not_initialized" },
    initialized_at: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Awaitable bootstrap. Idempotent — concurrent callers share one promise.
 */
export async function initializeAIInfrastructure(opts?: {
  force?: boolean;
  /** Seed RAG corpus in production (default: false — use npm run rag:seed). */
  seedRag?: boolean;
}): Promise<AiInfrastructureReport> {
  if (!opts?.force && lastReport?.ready) return lastReport;
  if (!opts?.force && initPromise) return initPromise;

  initPromise = (async (): Promise<AiInfrastructureReport> => {
    try {
      registerAllKnowledgeSources(opts?.force ? { force: true } : undefined);

      // RAG store
      try {
        await ensureVectorStore(opts?.force ? { force: true } : undefined);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const report = emptyReport({
          status: "unavailable",
          ready: false,
          rag: { ready: false, reasons: [msg] },
          error: `rag:${msg}`,
        });
        lastReport = report;
        return report;
      }

      if (opts?.seedRag === true && resolveRagEnvironment() === "production") {
        const { ensureCorpusSeeded } = await import("@/ai/rag/ingestion");
        const seed = await ensureCorpusSeeded();
        if (seed && !seed.ok) {
          console.error("[ai-infra] corpus seed failed:", seed.error ?? "unknown");
        }
      }

      // Memory
      if (resolveMemoryEnvironment() === "production" || typeof window === "undefined") {
        try {
          await ensureMemoryStore(opts?.force ? { force: true } : undefined);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Memory may be unavailable in local without service role — mark degraded, continue
          console.error("[ai-infra] memory ensure:", msg);
        }
      }

      // Rate limit store (best-effort resolve)
      let rlReady = false;
      let rlDetail: string | undefined;
      try {
        const store = await resolveAiRateLimitStore();
        rlReady = true;
        rlDetail = store.constructor?.name ?? "resolved";
      } catch (e) {
        rlDetail = e instanceof Error ? e.message : String(e);
      }

      const [rag, memory, llm] = await Promise.all([
        getRagReadiness(),
        getMemoryReadiness(),
        getLlmReadiness(),
      ]);

      const criticalFail =
        (resolveRagEnvironment() === "production" && !rag.RAG_READY) ||
        (resolveMemoryEnvironment() === "production" && !memory.MEMORY_READY);

      const ready = rag.RAG_READY && memory.MEMORY_READY && !criticalFail;
      const status: AiInfrastructureStatus = ready
        ? "ready"
        : criticalFail
          ? "unavailable"
          : "degraded";

      const report: AiInfrastructureReport = {
        status,
        ready,
        rag: { ready: rag.RAG_READY, reasons: rag.reasons },
        memory: { ready: memory.MEMORY_READY, reasons: memory.reasons },
        llm: { ready: llm.LLM_READY, reasons: llm.reasons },
        rate_limit: { ready: rlReady, detail: rlDetail },
        initialized_at: new Date().toISOString(),
      };
      lastReport = report;
      return report;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const report = emptyReport({
        status: "unavailable",
        ready: false,
        error: msg,
      });
      lastReport = report;
      return report;
    }
  })();

  return initPromise;
}

export function getAIInfrastructureReport(): AiInfrastructureReport | null {
  return lastReport;
}

export function resetAIInfrastructureForTests(): void {
  initPromise = null;
  lastReport = null;
}

/**
 * Guard for critical AI operations — awaits init once.
 * Returns report; callers must check report.ready / component readiness.
 */
export async function ensureAIInfrastructureReady(): Promise<AiInfrastructureReport> {
  return initializeAIInfrastructure();
}
