/**
 * FASE 22.7 — Run real production certification (probes + vitest suite + persist).
 */
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { evaluateProductionReady } from "@/ai/certification/gates";
import { runAllProbes } from "@/ai/certification/probes";
import { formatCertificationMarkdown } from "@/ai/certification/format-report";
import type {
  CertificationReport,
  CertEnvironment,
  CertTestSuiteResult,
} from "@/ai/certification/types";

const execFileAsync = promisify(execFile);

export type RunProductionCertificationOpts = {
  /** Skip spawning Vitest (e.g. when already inside a meta-test of helpers). Default false. */
  skipTestSuite?: boolean;
  /** Do not write docs artifacts. */
  skipPersist?: boolean;
  environment?: CertEnvironment;
};

function resolveEnvironment(override?: CertEnvironment): CertEnvironment {
  if (override) return override;
  if (process.env["CI"] === "true" || process.env["CI"] === "1") return "ci";
  return "local";
}

export async function resolveCommitSha(): Promise<string> {
  if (process.env["GITHUB_SHA"]?.trim()) return process.env["GITHUB_SHA"].trim();
  if (process.env["COMMIT_SHA"]?.trim()) return process.env["COMMIT_SHA"].trim();
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      timeout: 10_000,
      windowsHide: true,
    });
    const sha = stdout.trim();
    return sha || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Execute Vitest for real. Never hardcode ok:true.
 */
export async function runCertificationTestSuite(): Promise<CertTestSuiteResult> {
  const started = Date.now();
  const vitestBin = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
  const outFile = join(process.cwd(), "docs", "certification", "vitest-suite.json");
  mkdirSync(join(process.cwd(), "docs", "certification"), { recursive: true });
  const args = [
    vitestBin,
    "run",
    "src/ai/certification/security-attack.test.ts",
    "src/ai/certification/data-integrity.test.ts",
    "src/ai/certification/failure-modes.test.ts",
    "src/ai/certification/runtime-controls.test.ts",
    "src/ai/certification/certification-integrity.test.ts",
    "--reporter=json",
    `--outputFile=${outFile}`,
  ];
  const command = `node ${args.join(" ")}`;
  try {
    await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      timeout: 300_000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, AI_AUDIT_PERSIST: "0" },
    });
    // Exit 0 — parse output file if present
    let passed: number | null = null;
    let failed: number | null = null;
    try {
      const raw = readFileSync(outFile, "utf8");
      const parsed = JSON.parse(raw) as {
        numPassedTests?: number;
        numFailedTests?: number;
        success?: boolean;
        testResults?: unknown[];
      };
      passed = parsed.numPassedTests ?? null;
      failed = parsed.numFailedTests ?? null;
      const ok =
        parsed.success === true ||
        (typeof failed === "number" ? failed === 0 : true);
      return {
        executed: true,
        ok,
        passed,
        failed: failed ?? 0,
        duration_ms: Date.now() - started,
        command,
        error: ok ? null : "vitest_reported_failures",
      };
    } catch {
      // Exit 0 without parseable file — suite ran successfully
      return {
        executed: true,
        ok: true,
        passed,
        failed: 0,
        duration_ms: Date.now() - started,
        command,
        error: null,
      };
    }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number; message?: string };
    let passed: number | null = null;
    let failed: number | null = null;
    try {
      const raw = readFileSync(outFile, "utf8");
      const parsed = JSON.parse(raw) as {
        numPassedTests?: number;
        numFailedTests?: number;
        success?: boolean;
      };
      passed = parsed.numPassedTests ?? null;
      failed = parsed.numFailedTests ?? null;
    } catch {
      /* ignore */
    }
    return {
      executed: true,
      ok: false,
      passed,
      failed: failed ?? 1,
      duration_ms: Date.now() - started,
      command,
      error: `vitest_exit_${err.code ?? "error"}`,
    };
  }
}

export function persistCertificationReport(report: CertificationReport): {
  jsonPath: string;
  mdPath: string;
  historyPath: string;
} {
  const certDir = join(process.cwd(), "docs", "certification");
  mkdirSync(certDir, { recursive: true });
  const historyDir = join(certDir, "history");
  mkdirSync(historyDir, { recursive: true });

  const jsonPath = join(certDir, "latest.json");
  const stamp = report.timestamp.replace(/[:.]/g, "-");
  const historyPath = join(historyDir, `${stamp}.json`);
  const payload = JSON.stringify(report, null, 2);
  writeFileSync(jsonPath, payload, "utf8");
  writeFileSync(historyPath, payload, "utf8");

  const mdPath = join(process.cwd(), "docs", "AI_PRODUCTION_READINESS_REPORT.md");
  writeFileSync(mdPath, formatCertificationMarkdown(report), "utf8");

  return { jsonPath, mdPath, historyPath };
}

/**
 * Canonical entrypoint — real probes + real test suite + persisted report.
 */
export async function runProductionCertification(
  opts?: RunProductionCertificationOpts,
): Promise<{
  report: CertificationReport;
  markdown: string;
  persisted?: { jsonPath: string; mdPath: string; historyPath: string };
}> {
  const environment = resolveEnvironment(opts?.environment);
  const commit_sha = await resolveCommitSha();
  const timestamp = new Date().toISOString();

  const test_suite: CertTestSuiteResult = opts?.skipTestSuite
    ? {
        executed: false,
        ok: false,
        passed: null,
        failed: null,
        duration_ms: null,
        command: null,
        error: "skipped_by_caller",
      }
    : await runCertificationTestSuite();

  const checks = await runAllProbes({ environment });

  const report = evaluateProductionReady({
    checks,
    test_suite,
    timestamp,
    commit_sha,
    environment,
    evidence: {
      probe_count: checks.length,
      critical_count: checks.filter((c) => c.critical).length,
      pass_count: checks.filter((c) => c.status === "PASS").length,
      untested_count: checks.filter((c) => c.status === "UNTESTED").length,
      blocked_count: checks.filter((c) => c.status === "BLOCKED").length,
      fail_count: checks.filter((c) => c.status === "FAIL").length,
    },
  });

  const markdown = formatCertificationMarkdown(report);
  let persisted: { jsonPath: string; mdPath: string; historyPath: string } | undefined;
  if (!opts?.skipPersist) {
    persisted = persistCertificationReport(report);
  }

  return { report, markdown, ...(persisted ? { persisted } : {}) };
}
