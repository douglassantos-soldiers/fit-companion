import type { ProofStatus } from "@/lib/types";
import { proofStatusLabel } from "@/lib/wearables/challenge-proof";
import { cn } from "@/lib/utils";

export function ProofStatusBadge({
  status,
  flagged,
  className,
}: {
  status?: ProofStatus | undefined;
  flagged?: boolean | undefined;
  className?: string | undefined;
}) {
  const label = flagged && status !== "verified" ? "Em revisão" : proofStatusLabel(status);
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        status === "verified"
          ? "bg-primary/15 text-primary"
          : flagged
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : "bg-muted/60 text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
