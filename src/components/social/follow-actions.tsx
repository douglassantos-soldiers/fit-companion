import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmOverlay } from "@/components/confirm-overlay";
import { blockUser, followUser, muteUser, unfollowUser, unmuteUser } from "@/lib/social";

export function FollowActions({
  deviceId,
  displayName,
  targetUserId,
  isSelf,
  viewerFollows,
  muted,
  blocked,
  onChanged,
}: {
  deviceId: string;
  displayName: string;
  targetUserId: string;
  isSelf?: boolean;
  viewerFollows: boolean;
  muted?: boolean;
  blocked?: boolean;
  onChanged?: () => void;
}) {
  const [blockOpen, setBlockOpen] = useState(false);
  if (isSelf) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={viewerFollows ? "secondary" : "default"}
        onClick={() => {
          const op = viewerFollows
            ? unfollowUser(deviceId, targetUserId)
            : followUser(deviceId, targetUserId, displayName);
          void op
            .then(() => {
              toast.success(viewerFollows ? "Deixou de seguir" : "Seguindo");
              onChanged?.();
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "Falha no grafo"));
        }}
      >
        {viewerFollows ? "Seguindo" : "Seguir"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          const op = muted ? unmuteUser(deviceId, targetUserId) : muteUser(deviceId, targetUserId);
          void op
            .then(() => {
              toast.success(muted ? "Silêncio removido" : "Silenciado");
              onChanged?.();
            })
            .catch(() => toast.error("Não foi possível silenciar"));
        }}
      >
        {muted ? "Ouvir" : "Silenciar"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (blocked) {
            void import("@/lib/social")
              .then(({ unblockUser }) => unblockUser(deviceId, targetUserId))
              .then(() => {
                toast.success("Desbloqueado");
                onChanged?.();
              })
              .catch(() => toast.error("Não foi possível desbloquear"));
            return;
          }
          setBlockOpen(true);
        }}
      >
        {blocked ? "Desbloquear" : "Bloquear"}
      </Button>
      <ConfirmOverlay
        open={blockOpen}
        title="Bloquear esta pessoa?"
        description="Vocês deixam de se seguir."
        confirmLabel="Bloquear"
        destructive
        onClose={() => setBlockOpen(false)}
        onConfirm={() => {
          void blockUser(deviceId, targetUserId)
            .then(() => {
              toast.success("Bloqueado");
              onChanged?.();
            })
            .catch(() => toast.error("Não foi possível bloquear"));
        }}
      />
    </div>
  );
}
