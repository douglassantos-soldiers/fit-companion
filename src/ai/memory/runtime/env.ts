/**
 * FASE 22.3 — Memory environment resolution.
 * DEVELOPMENT | TEST | PRODUCTION — production never silently uses InMemory.
 */

export type MemoryEnvironment = "development" | "test" | "production";

export type MemoryStoreMode = "memory" | "supabase";

/**
 * Resolve Memory environment.
 * - AI_MEMORY_ENV overrides when set
 * - VITEST=true → test
 * - NODE_ENV=production → production
 * - else development
 */
export function resolveMemoryEnvironment(): MemoryEnvironment {
  const explicit = (process.env["AI_MEMORY_ENV"] ?? "").trim().toLowerCase();
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
export function resolveMemoryStoreMode(
  env: MemoryEnvironment = resolveMemoryEnvironment(),
): MemoryStoreMode {
  const raw = (process.env["AI_MEMORY_STORE"] ?? "").trim().toLowerCase();
  if (env === "production") {
    if (raw === "memory") {
      throw new Error("MEMORY_UNAVAILABLE: AI_MEMORY_STORE=memory is forbidden in production");
    }
    return "supabase";
  }
  if (raw === "supabase") return "supabase";
  return "memory";
}

export function isMemoryProduction(env: MemoryEnvironment = resolveMemoryEnvironment()): boolean {
  return env === "production";
}
