import { useEffect, type ReactNode } from "react";
import { trackHomeSurface } from "@/lib/home/track-home-surface";

/** Fires a one-shot impression when a home block mounts. */
export function HomeBlockImpression({
  blockId,
  children,
}: {
  blockId: string;
  children: ReactNode;
}) {
  useEffect(() => {
    trackHomeSurface("home_block_impression", { blockId });
  }, [blockId]);
  return <>{children}</>;
}
