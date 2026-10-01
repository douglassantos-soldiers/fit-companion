import { toast } from "sonner";
import { requestNotificationPermission } from "@/lib/notifications";
import { registerPushWorker, subscribePush } from "@/lib/push";

/** Shared enable reminders + web push subscription flow. */
export async function enableRemindersWithPush(opts: {
  setRemindersEnabled: (enabled: boolean) => void;
}): Promise<"granted" | "unsupported" | "denied" | "push_failed"> {
  const perm = await requestNotificationPermission();
  if (perm === "granted") {
    opts.setRemindersEnabled(true);
    try {
      await registerPushWorker();
      await subscribePush();
      toast.success("Notificações ligadas");
      return "granted";
    } catch {
      toast.error("Permissão ok, mas o push não ativou. Tente de novo nas configurações.");
      return "push_failed";
    }
  }
  if (perm === "unsupported") {
    toast.error("Notificações não suportadas neste aparelho");
    return "unsupported";
  }
  toast.error("Permissão de notificação negada");
  return "denied";
}
