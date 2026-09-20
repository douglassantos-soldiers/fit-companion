import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inviteToChallenge } from "@/lib/social";
import { listFollowingForInviteFn } from "@/lib/social/graph.functions";
import { useStore } from "@/lib/store";

export function InviteFriendsButton({
  deviceId,
  challengeId,
  displayName,
}: {
  deviceId: string;
  challengeId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const { bumpChallengeInvitesSent } = useStore();

  useEffect(() => {
    if (!open || !deviceId) return;
    void listFollowingForInviteFn({ data: { deviceId } })
      .then((res) => setPeople(res.people ?? []))
      .catch(() => toast.error("Não foi possível carregar amigos"));
  }, [open, deviceId]);

  return (
    <div>
      <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
        Convidar amigos
      </Button>
      {open ? (
        <ul className="mt-2 space-y-1">
          {!people.length ? (
            <li className="text-xs text-muted-foreground">Siga alguém para convidar.</li>
          ) : (
            people.map((p) => (
              <li key={p.userId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{p.displayName}</span>
                <Button
                  size="sm"
                  disabled={busy === p.userId}
                  onClick={() => {
                    setBusy(p.userId);
                    void inviteToChallenge(deviceId, challengeId, p.userId, displayName)
                      .then(() => {
                        bumpChallengeInvitesSent();
                        toast.success("Convite enviado");
                      })
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Não foi possível convidar"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  Convidar
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
