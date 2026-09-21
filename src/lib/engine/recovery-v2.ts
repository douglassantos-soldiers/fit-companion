/**
 * Compat shim — Recovery v2 is an adapter over RecoverySnapshot.
 */
export {
  computeRecoveryV2,
  snapshotToRecoveryV2,
  type RecoveryV2,
  type RecoveryManualSignals,
  type RecoveryWearableSignals,
  type RecoverySignals,
} from "@/lib/engine/recovery/adapters";
export type { RecoveryLevel } from "@/lib/engine/recovery/types";
