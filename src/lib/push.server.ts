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
  /** Deep-link path opened on notification click (e.g. /coach?q=...). */
  url?: string;
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

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    tag: `soldiers-${opts.category}`,
    url: opts.url && opts.url.startsWith("/") ? opts.url.slice(0, 280) : "/",
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        payload,
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
      const coachQ = encodeURIComponent(
        "Meu streak está em risco. Monta um plano express realista para treinar hoje.",
      );
      const r = await notifyUserPush({
        userId,
        category: "streak",
        title: "Streak em risco",
        body: "Treine hoje — o Coach monta um express se o tempo estiver curto.",
        url: `/coach?q=${coachQ}`,
        respectQuietHours: true,
      });
      sent += r.sent;
      if (!r.sent) skipped += 1;
    }

    if (hour === reminderHour && prefs.workout !== false) {
      const coachQ = encodeURIComponent("Qual é o treino de hoje e por que o plano está assim?");
      const r = await notifyUserPush({
        userId,
        category: "workout",
        title: "Hora do treino",
        body: "Seu plano do dia está pronto — abra o Coach se quiser o porquê.",
        url: `/coach?q=${coachQ}`,
        respectQuietHours: true,
      });
      sent += r.sent;
      if (!r.sent) skipped += 1;
    }
  }

  if (hour === 12 && keys) {
    const digest = await sendClubDigestPushes(db, now);
    sent += digest.sent;
    skipped += digest.skipped;
  }

  return { sent, skipped };
}

/** Notify followers + clubmates (cap) when someone posts a session/proof. */
export async function fanOutSocialActivityPush(opts: {
  actorUserId: string;
  title: string;
  body: string;
}): Promise<{ sent: number }> {
  const db = await adminDbLoose();
  if (!db) return { sent: 0 };

  const recipientIds = new Set<string>();

  const { data: followers } = await db
    .from("social_follows")
    .select("follower_id")
    .eq("following_id", opts.actorUserId)
    .limit(40);
  for (const row of (followers ?? []) as Array<{ follower_id?: string }>) {
    const id = String(row.follower_id ?? "");
    if (id && id !== opts.actorUserId) recipientIds.add(id);
  }

  const { data: memberships } = await db
    .from("club_members")
    .select("club_id")
    .eq("user_id", opts.actorUserId)
    .limit(5);
  const clubIds = ((memberships ?? []) as Array<{ club_id?: string }>)
    .map((m) => String(m.club_id ?? ""))
    .filter(Boolean);
  if (clubIds.length) {
    const { data: mates } = await db
      .from("club_members")
      .select("user_id")
      .in("club_id", clubIds)
      .limit(80);
    for (const row of (mates ?? []) as Array<{ user_id?: string | null }>) {
      const id = String(row.user_id ?? "");
      if (id && id !== opts.actorUserId) recipientIds.add(id);
    }
  }

  let sent = 0;
  let n = 0;
  for (const userId of recipientIds) {
    if (n >= 25) break;
    n += 1;
    const { data: stateRow } = await db
      .from("app_state")
      .select("retention")
      .eq("user_id", userId)
      .maybeSingle();
    const retention = ((stateRow as { retention?: RetentionBlob } | null)?.retention ??
      {}) as RetentionBlob;
    if (retention.pushPrefs?.kudos === false) continue;
    const r = await notifyUserPush({
      userId,
      category: "kudos",
      title: opts.title,
      body: opts.body,
      respectQuietHours: true,
    });
    sent += r.sent;
  }
  return { sent };
}

async function sendClubDigestPushes(
  db: NonNullable<Awaited<ReturnType<typeof adminDbLoose>>>,
  now: Date,
): Promise<{ sent: number; skipped: number }> {
  const day = saoPauloDateKey(now);
  const startIso = `${day}T00:00:00.000-03:00`;
  let sent = 0;
  let skipped = 0;

  const { data: clubs } = await db.from("clubs").select("id, name").limit(100);
  for (const club of (clubs ?? []) as Array<{ id?: string; name?: string }>) {
    const clubId = String(club.id ?? "");
    if (!clubId) continue;
    const { data: members } = await db
      .from("club_members")
      .select("user_id, device_id")
      .eq("club_id", clubId)
      .limit(60);
    const memberUserIds = [
      ...new Set(
        ((members ?? []) as Array<{ user_id?: string | null }>)
          .map((m) => String(m.user_id ?? ""))
          .filter((id) => id.length >= 8),
      ),
    ];
    if (memberUserIds.length < 2) continue;

    const { count } = await db
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .in("user_id", memberUserIds)
      .in("kind", ["session", "proof"])
      .gte("created_at", startIso);
    const workouts = count ?? 0;
    if (workouts < 1) {
      skipped += 1;
      continue;
    }

    for (const userId of memberUserIds) {
      const { data: stateRow } = await db
        .from("app_state")
        .select("retention")
        .eq("user_id", userId)
        .maybeSingle();
      const retention = ((stateRow as { retention?: RetentionBlob } | null)?.retention ??
        {}) as RetentionBlob;
      if (retention.pushPrefs?.kudos === false) {
        skipped += 1;
        continue;
      }
      const r = await notifyUserPush({
        userId,
        category: "kudos",
        title: "Seu clube treinou",
        body: `${workouts} treino${workouts === 1 ? "" : "s"} hoje em ${club.name ?? "seu clube"} — veja o feed.`,
        respectQuietHours: true,
      });
      sent += r.sent;
      if (!r.sent) skipped += 1;
    }
  }

  return { sent, skipped };
}
