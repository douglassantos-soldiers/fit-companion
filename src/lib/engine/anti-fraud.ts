/**
 * Anti-fraud architecture for performance / social ranking.
 * Flags suspicious activity. Policy (aviso / block input) lives in anti-fraud-policy.ts.
 * Does NOT ban or suspend — account-status remains admin-only.
 */

export type FraudFlagCode =
  | "duplicate_event"
  | "impossible_value"
  | "suspicious_spike"
  | "negative_value"
  | "out_of_range";

export interface FraudFlag {
  code: FraudFlagCode;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface FraudValidationResult {
  ok: boolean;
  flags: FraudFlag[];
}

export interface SessionFingerprintInput {
  deviceId: string;
  date: string;
  dayId?: string;
  volumeKg: number;
  durationMin: number;
  /** Recent fingerprints for duplicate detection (e.g. last N session ids/hashes) */
  recentFingerprints?: string[];
  fingerprint?: string;
}

export interface ActivityLogInput {
  kind: "steps" | "football" | "run_km";
  value: number;
  date: string;
}

export interface ChallengeProgressInput {
  value: number;
  baseline: number;
  personalTarget?: number;
  metric: string;
}

const MAX_STEPS_PER_DAY = 100_000;
const MAX_VOLUME_PER_SESSION = 200_000;
const MAX_DURATION_MIN = 480;
const MAX_RUN_KM_PER_DAY = 100;
const MAX_FOOTBALL_PER_DAY = 3;
const SPIKE_RATIO = 8;

function flag(code: FraudFlagCode, message: string, severity: FraudFlag["severity"]): FraudFlag {
  return { code, message, severity };
}

export function sessionFingerprint(input: {
  date: string;
  dayId?: string;
  volumeKg: number;
  durationMin: number;
}): string {
  return `${input.date}|${input.dayId ?? ""}|${Math.round(input.volumeKg)}|${input.durationMin}`;
}

export function validateSessionEvent(input: SessionFingerprintInput): FraudValidationResult {
  const flags: FraudFlag[] = [];
  if (input.volumeKg < 0 || input.durationMin < 0) {
    flags.push(flag("negative_value", "Volume ou duração negativa", "high"));
  }
  if (input.volumeKg > MAX_VOLUME_PER_SESSION) {
    flags.push(flag("impossible_value", `Volume > ${MAX_VOLUME_PER_SESSION} kg`, "high"));
  }
  if (input.durationMin > MAX_DURATION_MIN) {
    flags.push(flag("impossible_value", `Duração > ${MAX_DURATION_MIN} min`, "medium"));
  }
  const fp =
    input.fingerprint ??
    sessionFingerprint({
      date: input.date,
      ...(input.dayId !== undefined ? { dayId: input.dayId } : {}),
      volumeKg: input.volumeKg,
      durationMin: input.durationMin,
    });
  if (input.recentFingerprints?.includes(fp)) {
    flags.push(flag("duplicate_event", "Sessão duplicada na janela recente", "high"));
  }
  return { ok: flags.filter((f) => f.severity === "high").length === 0, flags };
}

export function validateActivityLog(input: ActivityLogInput): FraudValidationResult {
  const flags: FraudFlag[] = [];
  if (input.value < 0) {
    flags.push(flag("negative_value", "Valor negativo", "high"));
  }
  if (input.kind === "steps" && input.value > MAX_STEPS_PER_DAY) {
    flags.push(flag("impossible_value", `Passos > ${MAX_STEPS_PER_DAY}/dia`, "high"));
  }
  if (input.kind === "run_km" && input.value > MAX_RUN_KM_PER_DAY) {
    flags.push(flag("impossible_value", `Km > ${MAX_RUN_KM_PER_DAY}/dia`, "high"));
  }
  if (input.kind === "football" && input.value > MAX_FOOTBALL_PER_DAY) {
    flags.push(flag("impossible_value", `Jogos > ${MAX_FOOTBALL_PER_DAY}/dia`, "medium"));
  }
  if (input.kind === "football" && input.value !== Math.floor(input.value)) {
    flags.push(flag("out_of_range", "Jogos devem ser inteiros", "low"));
  }
  return { ok: flags.filter((f) => f.severity === "high").length === 0, flags };
}

export function validateChallengeProgress(input: ChallengeProgressInput): FraudValidationResult {
  const flags: FraudFlag[] = [];
  if (input.value < 0 || input.baseline < 0) {
    flags.push(flag("negative_value", "Progresso ou baseline negativo", "high"));
  }
  if (input.personalTarget != null && input.personalTarget <= 0) {
    flags.push(flag("out_of_range", "Meta pessoal inválida", "medium"));
  }
  const base = Math.max(input.baseline, 1);
  if (input.value > base * SPIKE_RATIO && input.baseline > 0) {
    flags.push(
      flag(
        "suspicious_spike",
        `Progresso > ${SPIKE_RATIO}x o baseline`,
        "medium",
      ),
    );
  }
  if (input.metric === "steps" && input.value > MAX_STEPS_PER_DAY * 45) {
    flags.push(flag("impossible_value", "Soma de passos impossível no período", "high"));
  }
  // Spike alone does not fail ok — only high-severity blocks soft acceptance
  return { ok: flags.filter((f) => f.severity === "high").length === 0, flags };
}
