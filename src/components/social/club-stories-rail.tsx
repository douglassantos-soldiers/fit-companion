import { useState } from "react";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { SocialAvatar } from "@/components/social/social-avatar";
import type { ClubStory } from "@/lib/social";

export function ClubStoriesRail({ stories }: { stories: ClubStory[] }) {
  const [active, setActive] = useState<ClubStory | null>(null);

  if (!stories.length) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {stories.map((s) => (
          <button
            key={s.id}
            type="button"
            className="shrink-0 text-center"
            onClick={() => setActive(s)}
            aria-label={`Story de ${s.displayName}`}
          >
            <SocialAvatar name={s.displayName} src={s.imageUrl} size="md" ring />
            <p className="mt-1 max-w-14 truncate text-[0.6rem] text-muted-foreground">{s.displayName}</p>
          </button>
        ))}
      </div>
      <SoldiersOverlay
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.displayName ?? "Story"}
      >
        {active ? (
          <img
            src={active.imageUrl}
            alt={active.displayName}
            className="w-full rounded-xl object-cover"
          />
        ) : null}
      </SoldiersOverlay>
    </>
  );
}
