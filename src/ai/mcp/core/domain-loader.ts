/**
 * MCP Tool Layer — default domain context loader.
 * Uses existing Context / Decision assembly — never Agent → DB.
 */
import { asTrustedUserId, type TrustedUserId } from "@/ai/contracts/trusted-user-id";
import type { DomainContextLoader, ToolDomainContext } from "@/ai/mcp/core/types";
import { toPerformanceContext } from "@/lib/engine/performance-context";
import { todayKey, type AppState } from "@/lib/types";

async function loadState(userId: string): Promise<AppState> {
  try {
    const { getOrBuildDecisionContext } = await import("@/lib/engine/decision-context.server");
    const built = await getOrBuildDecisionContext(userId);
    if (built?.state) return { ...built.state, userId };
  } catch {
    // fall through to hydrate
  }
  try {
    const { hydrateAppStateFromDb } = await import("@/lib/customer360/hydrate.server");
    const state = await hydrateAppStateFromDb(userId);
    return { ...state, userId };
  } catch {
    const { emptyState } = await import("@/lib/types");
    return { ...emptyState, userId };
  }
}

export const defaultDomainContextLoader: DomainContextLoader = async (
  userId: TrustedUserId,
  date?: string,
): Promise<ToolDomainContext> => {
  const id = asTrustedUserId(userId);
  const day = date ?? todayKey();
  const state = await loadState(id);
  let performanceContext = null;
  try {
    const { getOrBuildDecisionContext } = await import("@/lib/engine/decision-context.server");
    const built = await getOrBuildDecisionContext(id, day);
    if (built?.snapshot) {
      performanceContext = toPerformanceContext(built.snapshot, built.state ?? state);
    }
  } catch {
    performanceContext = null;
  }
  return {
    userId: id,
    date: day,
    state,
    performanceContext,
  };
};
