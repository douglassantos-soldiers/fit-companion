import { streakAtRisk } from "@/lib/engine/retention";
import { DAILY_XP_GOAL } from "@/lib/types";
import type { SessionLog } from "@/lib/types";

let timers: ReturnType<typeof setTimeout>[] = [];

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function msUntilHour(hour: number, from = new Date()): number {
  const target = new Date(from);
  target.setHours(hour, 0, 0, 0);
  if (target.getTime() <= from.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - from.getTime();
}

function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function show(title: string, body: string, tag: string) {
  if (!canNotify()) return;
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: "/favicon.png",
      badge: "/favicon.png",
    });
    n.onclick = () => {
      window.focus();
      n.close();
      try {
        window.location.assign("/");
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore */
  }
}

export function scheduleLocalReminders(opts: {
  enabled: boolean;
  hour: number;
  sessions: SessionLog[];
  freezeUsedDates?: string[];
  streakFreezes?: number;
  xpToday?: number;
  dayTitle?: string;
}) {
  clearTimers();
  if (!opts.enabled || !canNotify()) return;

  const hour = Math.min(22, Math.max(6, Math.round(opts.hour)));
  const dayLabel = opts.dayTitle ?? "seu treino";
  const freezes = opts.freezeUsedDates ?? [];

  const delayMain = msUntilHour(hour);
  timers.push(
    setTimeout(() => {
      show("Soldiers Performance", `Hora do treino: ${dayLabel}`, "soldiers-daily");
      scheduleLocalReminders(opts);
    }, delayMain),
  );

  if (streakAtRisk(opts.sessions, new Date(), freezes)) {
    const delayRisk = msUntilHour(20);
    if (delayRisk < delayMain || hour !== 20) {
      timers.push(
        setTimeout(() => {
          if (streakAtRisk(opts.sessions, new Date(), freezes)) {
            const freezeHint =
              (opts.streakFreezes ?? 0) > 0 ? " — use o freeze ou treine." : " — treine ou faça o Express.";
            const stHint = `Streak em risco${freezeHint}`;
            show("Soldiers Performance", stHint, "soldiers-streak");
          }
        }, delayRisk),
      );
    }
  }

  const xp = opts.xpToday ?? 0;
  if (xp < DAILY_XP_GOAL) {
    const delayXp = msUntilHour(21);
    timers.push(
      setTimeout(() => {
        const missing = DAILY_XP_GOAL - (opts.xpToday ?? 0);
        if (missing > 0) {
          show(
            "Soldiers Performance",
            `Faltam ${missing} XP para a meta de hoje.`,
            "soldiers-xp",
          );
        }
      }, delayXp),
    );
  }
}

export function clearLocalReminders() {
  clearTimers();
}

/** Show an immediate social-style local notification (Phase 4 bridge). */
export function notifySocial(title: string, body: string, tag = "soldiers-social") {
  show(title, body, tag);
}
