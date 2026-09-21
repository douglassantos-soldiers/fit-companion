export {
  computeRecoverySnapshot,
  type ComputeRecoverySnapshotOpts,
} from "@/lib/engine/recovery/snapshot";
export {
  computeRecoveryV2,
  snapshotToRecoveryV2,
  snapshotToContextRecovery,
  type RecoveryV2,
  type RecoveryManualSignals,
  type RecoveryWearableSignals,
  type RecoverySignals,
} from "@/lib/engine/recovery/adapters";
export {
  consecutiveHardRpeStreak,
  extractWearableRecovery,
  wearableConfidenceOf,
} from "@/lib/engine/recovery/signals";
export {
  buildMuscleRecoverySnapshots,
  muscleRecoveryMap,
  freshnessForGroups,
  sortGroupsByFreshness,
  recoveryLabel,
  freshnessToHeat,
  GROUP_LABEL,
  ALL_GROUPS,
  EXERCISES,
  RECOVERY_HOURS,
  type MuscleRecovery,
  type MuscleRecoverySnapshot,
  type RecoveryContext,
} from "@/lib/engine/recovery/muscle";
export {
  readinessToLevel,
  trafficScoreForReadiness,
  type ReadinessLevel,
  type RecoveryLevel,
  type RecoverySnapshot,
  type MuscleRecoveryRow,
  type MuscleRecoveryStatus,
  type RecoverySourceSummary,
  type WearableRecoveryInput,
  type SleepSource,
} from "@/lib/engine/recovery/types";
