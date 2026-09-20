/**
 * Product analytics for admin (no PII). Uses user_events.
 */
import { adminDbLoose } from "@/lib/db-admin";

export type OpsTrendPoint = { date: string; workouts: number; actives: number };

export type OpsDashboard = {
  users: number;
  active7d: number;
  new7d: number;
  workouts7d: number;
  prs7d: number;
  challengeJoins7d: number;
  challengeCompletes7d: number;
  posts7d: number;
  trend: OpsTrendPoint[];
};

export type ProductAnalytics = {
  funnel: {
    created: number;
    onboarded: number;
    firstWorkout: number;
    secondWorkout: number;
  };
  retention: {
    cohortSize: number;
    d1: number;
    d7: number;
    d30: number;
  };
  northStar: {
    users: number;
    windowDays: 7;
  };
  ops: OpsDashboard;
};

const DAY = 24 * 60 * 60 * 1000;

const emptyOps = (): OpsDashboard => ({
  users: 0,
  active7d: 0,
  new7d: 0,
  workouts7d: 0,
  prs7d: 0,
  challengeJoins7d: 0,
  challengeCompletes7d: 0,
  posts7d: 0,
  trend: [],
});

export function aggregateOpsFromEvents(
  events: Array<{ user_id: string; event_type: string; occurred_at: string }>,
  nowMs: number,
): Pick<OpsDashboard, "active7d" | "new7d" | "workouts7d" | "trend"> {
  const weekAgo = new Date(nowMs - 7 * DAY).toISOString();
  const opened = new Set<string>();
  const workoutsUsers = new Set<string>();
  let workouts7d = 0;
  let new7d = 0;
  const byDay = new Map<string, { workouts: number; actives: Set<string> }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowMs - i * DAY).toISOString().slice(0, 10);
    byDay.set(d, { workouts: 0, actives: new Set() });
  }

  for (const row of events) {
    if (row.occurred_at < weekAgo) continue;
    const day = row.occurred_at.slice(0, 10);
    const bucket = byDay.get(day);
    if (row.event_type === "user_created") new7d += 1;
    if (row.event_type === "app_opened") {
      opened.add(row.user_id);
      bucket?.actives.add(row.user_id);
    }
    if (row.event_type === "workout_completed") {
      workouts7d += 1;
      workoutsUsers.add(row.user_id);
      if (bucket) bucket.workouts += 1;
      bucket?.actives.add(row.user_id);
    }
  }

  const active7d = opened.size > 0 ? opened.size : workoutsUsers.size;
  const trend: OpsTrendPoint[] = [...byDay.entries()].map(([date, v]) => ({
    date,
    workouts: v.workouts,
    actives: v.actives.size,
  }));
  return { active7d, new7d, workouts7d, trend };
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function loadProductAnalyticsServer(): Promise<ProductAnalytics> {
  const empty: ProductAnalytics = {
    funnel: { created: 0, onboarded: 0, firstWorkout: 0, secondWorkout: 0 },
    retention: { cohortSize: 0, d1: 0, d7: 0, d30: 0 },
    northStar: { users: 0, windowDays: 7 },
    ops: emptyOps(),
  };
  const db = await adminDbLoose();
  if (!db) return empty;

  const since = new Date(Date.now() - 120 * DAY).toISOString();
  const { data, error } = await db
    .from("user_events")
    .select("user_id, event_type, occurred_at")
    .in("event_type", ["user_created", "onboarding_completed", "app_opened", "workout_completed"])
    .gte("occurred_at", since)
    .not("user_id", "is", null)
    .limit(20000);

  const events = !error && data
    ? (data as Array<{ user_id: string; event_type: string; occurred_at: string }>)
    : [];

  const createdAt = new Map<string, string>();
  const onboarded = new Set<string>();
  const workouts = new Map<string, number>();
  const activityDays = new Map<string, Set<string>>();

  for (const row of events) {
    const uid = row.user_id;
    const type = row.event_type;
    const occurred = row.occurred_at;
    if (type === "user_created") {
      const prev = createdAt.get(uid);
      if (!prev || occurred < prev) createdAt.set(uid, occurred);
    }
    if (type === "onboarding_completed") onboarded.add(uid);
    if (type === "workout_completed") workouts.set(uid, (workouts.get(uid) ?? 0) + 1);
    if (type === "app_opened" || type === "workout_completed") {
      let set = activityDays.get(uid);
      if (!set) {
        set = new Set();
        activityDays.set(uid, set);
      }
      set.add(dayKey(occurred));
    }
  }

  const created = createdAt.size;
  let first = 0;
  let second = 0;
  for (const n of workouts.values()) {
    if (n >= 1) first += 1;
    if (n >= 2) second += 1;
  }

  let d1 = 0;
  let d7 = 0;
  let d30 = 0;
  for (const [uid, createdIso] of createdAt) {
    const origin = dayKey(createdIso);
    const days = activityDays.get(uid);
    if (!days) continue;
    if (days.has(addDays(origin, 1))) d1 += 1;
    if (days.has(addDays(origin, 7))) d7 += 1;
    if (days.has(addDays(origin, 30))) d30 += 1;
  }

  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const weekWorkouts = new Map<string, number>();
  for (const row of events) {
    if (row.event_type !== "workout_completed" || row.occurred_at < weekAgo) continue;
    weekWorkouts.set(row.user_id, (weekWorkouts.get(row.user_id) ?? 0) + 1);
  }
  let north = 0;
  for (const n of weekWorkouts.values()) {
    if (n >= 3) north += 1;
  }

  const opsFromEvents = aggregateOpsFromEvents(events, Date.now());

  let users = 0;
  let prs7d = 0;
  let challengeJoins7d = 0;
  let challengeCompletes7d = 0;
  let posts7d = 0;
  const weekAgoIso = new Date(Date.now() - 7 * DAY).toISOString();
  try {
    const [usersRes, prsRes, joinsRes, completesRes, postsRes, newUsersRes] = await Promise.all([
      db.from("users").select("id", { count: "exact", head: true }),
      db.from("personal_records").select("id", { count: "exact", head: true }).gte("achieved_at", weekAgoIso),
      db.from("challenge_entries").select("device_id", { count: "exact", head: true }).gte("joined_at", weekAgoIso),
      db
        .from("activity_events")
        .select("id", { count: "exact", head: true })
        .eq("kind", "challenge_complete")
        .gte("created_at", weekAgoIso),
      db.from("activity_events").select("id", { count: "exact", head: true }).gte("created_at", weekAgoIso),
      db.from("users").select("id", { count: "exact", head: true }).gte("created_at", weekAgoIso),
    ]);
    users = usersRes.count ?? 0;
    prs7d = prsRes.count ?? 0;
    challengeJoins7d = joinsRes.count ?? 0;
    challengeCompletes7d = completesRes.count ?? 0;
    posts7d = postsRes.count ?? 0;
    if ((newUsersRes.count ?? 0) > opsFromEvents.new7d) {
      opsFromEvents.new7d = newUsersRes.count ?? 0;
    }
  } catch (e) {
    console.warn("ops dashboard extra counts skipped", e);
  }

  return {
    funnel: {
      created,
      onboarded: onboarded.size,
      firstWorkout: first,
      secondWorkout: second,
    },
    retention: {
      cohortSize: created,
      d1,
      d7,
      d30,
    },
    northStar: { users: north, windowDays: 7 },
    ops: {
      users,
      active7d: opsFromEvents.active7d,
      new7d: opsFromEvents.new7d,
      workouts7d: opsFromEvents.workouts7d,
      prs7d,
      challengeJoins7d,
      challengeCompletes7d,
      posts7d,
      trend: opsFromEvents.trend,
    },
  };
}
