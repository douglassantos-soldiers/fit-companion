import { roundLoad } from "@/lib/training/progression";
import type { SetPrescription } from "@/lib/training/sets";

/** Add 1–2 warmup sets for loaded compounds. Working prescriptions keep their targets. */
export function withWarmupPrescriptions(prescriptions: SetPrescription[]): SetPrescription[] {
  const working = prescriptions.filter((p) => p.type === "working");
  const first = working[0];
  if (!first || first.targetWeight < 20) return prescriptions.map((p, i) => ({ ...p, setNumber: i + 1 }));

  const warmups: SetPrescription[] = [
    {
      setNumber: 1,
      type: "warmup",
      targetReps: "8",
      targetWeight: roundLoad(first.targetWeight * 0.5),
      restSec: Math.min(45, first.restSec),
    },
  ];
  if (first.targetWeight >= 40) {
    warmups.push({
      setNumber: 2,
      type: "warmup",
      targetReps: "5",
      targetWeight: roundLoad(first.targetWeight * 0.7),
      restSec: Math.min(60, first.restSec),
    });
  }

  const rest = working.map((p, i) => ({ ...p, setNumber: warmups.length + i + 1 }));
  return [...warmups, ...rest];
}
