/**
 * FASE 22.2 — RAG environment resolution.
 * DEVELOPMENT | TEST | PRODUCTION — production never silently uses InMemory.
 */

export type RagEnvironment = "development" | "test" | "production";

export type RagStoreMode = "memory" | "supabase";

/**
 * Resolve RAG environment.
 * - AI_RAG_ENV overrides when set
 * - VITEST=true → test
 * - NODE_ENV=production → production
 * - else development
 */
export function resolveRagEnvironment(): RagEnvironment {
  const explicit = (process.env["AI_RAG_ENV"] ?? "").trim().toLowerCase();
  if (explicit === "production" || explicit === "prod") return "production";
  if (explicit === "test") return "test";
  if (explicit === "development" || explicit === "dev") return "development";

  if (process.env["VITEST"] === "true" || process.env["VITEST"] === "1") return "test";
  if ((process.env["NODE_ENV"] ?? "").toLowerCase() === "production") return "production";
  return "development";
}

/**
 * Desired store mode from env + environment rules.
 * Production always requires supabase (memory is a config error).
 */
export function resolveRagStoreMode(env: RagEnvironment = resolveRagEnvironment()): RagStoreMode {
  const raw = (process.env["AI_RAG_STORE"] ?? "").trim().toLowerCase();
  if (env === "production") {
    if (raw === "memory") {
      throw new Error("RAG_UNAVAILABLE: AI_RAG_STORE=memory is forbidden in production");
    }
    return "supabase";
  }
  if (raw === "supabase") return "supabase";
  return "memory";
}

export function isRagProduction(env: RagEnvironment = resolveRagEnvironment()): boolean {
  return env === "production";
}
