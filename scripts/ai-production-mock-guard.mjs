#!/usr/bin/env node
/**
 * FASE 22.5 — Static CI guard: fail if production AI paths import or use Mock LLM provider.
 * Scans src/ai TypeScript sources excluding tests, mock module, eval, golden, e2e.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const AI_ROOT = path.join(ROOT, "src", "ai");

const EXCLUDE_DIR_PARTS = [
  `${path.sep}eval${path.sep}`,
  `${path.sep}golden${path.sep}`,
  `${path.sep}e2e${path.sep}`,
];

const FORBIDDEN = [
  { re: /\bgetMockAIProvider\b/, label: "getMockAIProvider" },
  { re: /\bMockAIProvider\b/, label: "MockAIProvider" },
  { re: /\bsetMockProviderForTests\b/, label: "setMockProviderForTests" },
  { re: /from\s+["']@\/ai\/providers\/mock["']/, label: 'from "@/ai/providers/mock"' },
  { re: /fallback_provider\s*:\s*["']mock["']/, label: 'fallback_provider: "mock"' },
  { re: /AI_FALLBACK_PROVIDER\s*=\s*["']?mock/, label: "AI_FALLBACK_PROVIDER=mock" },
];

/** Allow mock id only in registry type unions / listProviderIds / comments handled separately */
const PROVIDER_MOCK_ASSIGN = /\bprovider\s*:\s*["']mock["']/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (EXCLUDE_DIR_PARTS.some((p) => full.includes(p))) continue;
      walk(full, out);
      continue;
    }
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    if (name === "mock.ts") continue;
    out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const files = walk(AI_ROOT);
const violations = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const raw = fs.readFileSync(file, "utf8");
  const code = stripComments(raw);

  // registry.ts may mention "mock" as a key in the Record — allow listProviderIds / registry map
  const isRegistry = rel.endsWith("src/ai/providers/registry.ts");
  const isTypes = rel.endsWith("src/ai/providers/types.ts");
  const isEnv = rel.endsWith("src/ai/gateway/runtime/env.ts");
  const isCircuit = rel.endsWith("src/ai/gateway/circuit-breaker.ts");
  const isHealth = rel.endsWith("src/ai/gateway/health.ts");
  const isGateway = rel.endsWith("src/ai/gateway/gateway.ts");
  const isFallback = rel.endsWith("src/ai/gateway/fallback.ts");
  const isErrors = rel.endsWith("src/ai/providers/errors.ts");

  for (const f of FORBIDDEN) {
    if (isRegistry && (f.label === "getMockAIProvider" || f.label === "MockAIProvider" || f.label === 'from "@/ai/providers/mock"' || f.label === "setMockProviderForTests")) {
      // registry wires mock for test/dev only — allowed
      continue;
    }
    if (f.re.test(code)) {
      violations.push(`${rel}: forbidden ${f.label}`);
    }
  }

  if (
    !isTypes &&
    !isEnv &&
    !isRegistry &&
    !isCircuit &&
    !isHealth &&
    !isGateway &&
    !isFallback &&
    !isErrors &&
    PROVIDER_MOCK_ASSIGN.test(code)
  ) {
    violations.push(`${rel}: forbidden provider: "mock" assignment in product code`);
  }
}

if (violations.length) {
  console.error("AI production mock guard FAILED:\n" + violations.map((v) => `  - ${v}`).join("\n"));
  process.exit(1);
}

console.log(`AI production mock guard PASS (${files.length} files scanned)`);
