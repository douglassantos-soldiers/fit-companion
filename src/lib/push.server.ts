/**
 * Web Push send path (server-only). web-push is never imported from the client.
 */
import { adminDbLoose } from "@/lib/db-admin";

export type PushCategory = "workout" | "streak" | "challenge" | "kudos";

const MAX_SENDS_PER_DAY = 3;
const TZ = "America/Sao_Paulo";

export function saoPauloHour(now = new Date()): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(now),
  );
  return Number.isFinite(hour) ? hour : now.getUTCHours();
}

export function saoPauloDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isQuietHours(now = new Date()): boolean {
  const hour = saoPauloHour(now);
  return hour >= 22 || hour < 7;
}

function vapidConfigured(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"]?.trim() ?? "";
  const privateKey = process.env["VAPID_PRIVATE_KEY"]?.trim() ?? "";
  const subject = process.env["VAPID_SUBJECT"]?.trim() || "mailto:privacy@soldiersnutrition.com.br";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKeyServer(): string {
  return process.env["VAPID_PUBLIC_KEY"]?.trim() ?? "";
}

async function countSendsToday(userId: string, category?: PushCategory): Promise<number> {
  const db = await adminDbLoose();
  if (!db) return MAX_SENDS_PER_DAY;
  const start = `${saoPauloDateKey()}T00:00:00.000-03:00`;
  let q = db.from("push_sends").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("sent_at", start);
  if (category) q = q.eq("category", category);
  const { count } = await q;
  return count ?? 0;
}

export async function canSendPush(userId: string, category: PushCategory): Promise<boolean> {
  const total = await countSendsToday(userId);
  if (total >= MAX_SENDS_PER_DAY) return false;
  const cat = await countSendsToday(userId, category);
  return cat < 1;
}

export async function savePushSubscriptionServer(opts: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<{ ok: boolean }> {
  const db = await adminDbLoose();
  if (!db) return { ok: false };
  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: opts.userId,
      endpoint: opts.endpoint,
      p256dh: opts.p256dh,
      auth: opts.auth,
      user_agent: opts.userAgent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.warn("savePushSubscription failed", error);
    return { ok: false };
  }
  return { ok: true };
}

async function recordSend(userId: string, category: PushCategory): Promise<void> {
  const db = await adminDbLoose();
  if (!db) return;
  await db.from("push_sends").insert({ user_id: userId, category, sent_at: new Date().toISOString() });
}

export async function notifyUserPush(opts: {
  userId: string;
  category: PushCategory;
  title: string;
  body: string;
  /** Immediate social sends skip quiet hours; scheduled respects them. */
  respectQuietHours?: boolean;
}): Promise<{ sent: number; skipped: string | null }> {
  const keys = vapidConfigured();
  if (!keys) return { sent: 0, skipped: "vapid_missing" };
  if (opts.respectQuietHours !== false && isQuietHours()) return { sent: 0, skipped: "quiet_hours" };
  if (!(await canSendPush(opts.userId, opts.category))) return { sent: 0, skipped: "cap" };

  const db = await adminDbLoose();
  if (!db) return { sent: 0, skipped: "db" };
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", opts.userId);
  if (!subs?.length) return { sent: 0, skipped: "no_subscription" };

  const webpush = await import("web-push");
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        JSON.stringify({ title: opts.title, body: opts.body, tag: `soldiers-${opts.category}` }),
      );
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.warn("web-push send failed", e);
      }
    }
  }
  if (sent > 0) await recordSend(opts.userId, opts.category);
  return { sent, skipped: sent ? null : "send_failed" };
}

type RetentionBlob = {
  reminderHour?: number;
  remindersEnabled?: boolean;
  pushPrefs?: { workout?: boolean; streak?: boolean; challenge?: boolean; kudos?: boolean };
};

export async function sendDailyPushes(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const keys = vapidConfigured();
  if (!keys) return { sent: 0, skipped: 0 };
  if (isQuietHours(now)) return { sent: 0, skipped: 0 };

  const hour = saoPauloHour(now);
  const db = await adminDbLoose();
  if (!db) return { sent: 0, skipped: 0 };

  const { data: subs } = await db.from("push_subscriptions").select("user_id");
  const userIds: string[] = [];
  for (const row of (subs ?? []) as Array<{ user_id?: string }>) {
    const id = String(row.user_id ?? "");
    if (id.length >= 8 && !userIds.includes(id)) userIds.push(id);
  }
  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const { data: stateRow } = await db.from("app_state").select("retention, reminder_hour").eq("user_id", userId).maybeSingle();
    const retention = ((stateRow as { retention?: RetentionBlob } | null)?.retention ?? {}) as RetentionBlob;
    const reminderHour = Math.min(
      22,
      Math.max(6, Math.round(retention.reminderHour ?? Number(stateRow?.reminder_hour ?? 18))),
    );
    const prefs = retention.pushPrefs ?? {};
    const enabled = retention.remindersEnabled !== false;

    if (!enabled) {
      skipped += 1;
      continue;
    }

    if (hour === 20 && prefs.streak !== false) {
      const r = await notifyUserPush({
        userId,
        category: "streak",
        title: "Streak em risco",
        body: "Treine hoje para não quebrar a sequência.",
        respectQuietHours: true,
      });
      sent += r.sent;
      if (!r.sent) skipped += 1;
    }

    if (hour === reminderHour && prefs.workout !== false) {
      const r = await notifyUserPush({
        userId,
        category: "workout",
        title: "Hora do treino",
        body: "Seu plano do dia está pronto.",
        respectQuietHours: true,
      });
      sent += r.sent;
      if (!r.sent) skipped += 1;
    }
  }

  return { sent, skipped };
}
