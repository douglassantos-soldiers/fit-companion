import { describe, expect, it } from "vitest";
import {
  CLEAR_BY_USER_ID,
  CLEAR_BY_USER_ID_MULTI,
  CLEAR_BY_DEVICE_ID,
  REQUIRED_WIPE_TABLES,
  RETAIN_ON_ACCOUNT_DELETION,
  executeAccountWipe,
  type WipeDb,
} from "./account-deletion";

function createMockDb(seed: {
  userId: string;
  deviceIds: string[];
  rows: Record<string, Array<Record<string, unknown>>>;
}): {
  db: WipeDb;
  remaining: () => Record<string, Array<Record<string, unknown>>>;
  deletedOps: Array<{ table: string; col?: string; val?: string; or?: string; in?: string[] }>;
} {
  const store: Record<string, Array<Record<string, unknown>>> = structuredClone(seed.rows);
  const deletedOps: Array<{
    table: string;
    col?: string;
    val?: string;
    or?: string;
    in?: string[];
  }> = [];

  const db: WipeDb = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(col: string, val: string) {
              const data = (store[table] ?? []).filter((r) => String(r[col]) === val);
              return Promise.resolve({ data, error: null });
            },
          };
        },
        delete() {
          return {
            eq(col: string, val: string) {
              deletedOps.push({ table, col, val });
              store[table] = (store[table] ?? []).filter((r) => String(r[col]) !== val);
              return Promise.resolve({ error: null });
            },
            in(col: string, vals: string[]) {
              deletedOps.push({ table, in: vals });
              const set = new Set(vals);
              store[table] = (store[table] ?? []).filter((r) => !set.has(String(r[col])));
              return Promise.resolve({ error: null });
            },
            or(filter: string) {
              deletedOps.push({ table, or: filter });
              // filter like "follower_id.eq.u1,following_id.eq.u1"
              const parts = filter.split(",").map((p) => {
                const [c, , v] = p.split(".");
                return { col: c!, val: v! };
              });
              store[table] = (store[table] ?? []).filter(
                (r) => !parts.some((p) => String(r[p.col]) === p.val),
              );
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  return { db, remaining: () => store, deletedOps };
}

describe("account deletion inventory", () => {
  it("covers required wipe tables", () => {
    const covered = new Set<string>([
      ...CLEAR_BY_USER_ID,
      ...CLEAR_BY_USER_ID_MULTI.map((s) => s.table),
      "users",
    ]);
    for (const t of REQUIRED_WIPE_TABLES) {
      expect(covered.has(t) || CLEAR_BY_DEVICE_ID.includes(t as never)).toBe(true);
    }
  });

  it("never lists retain tables in wipe lists", () => {
    const wipe = new Set([
      ...CLEAR_BY_USER_ID,
      ...CLEAR_BY_USER_ID_MULTI.map((s) => s.table),
      ...CLEAR_BY_DEVICE_ID,
    ]);
    for (const r of RETAIN_ON_ACCOUNT_DELETION) {
      expect(wipe.has(r.table)).toBe(false);
    }
  });
});

describe("executeAccountWipe BEFORE/AFTER", () => {
  it("removes user-owned rows and users row; retains orders", async () => {
    const userId = "user-a";
    const other = "user-b";
    const { db, remaining, deletedOps } = createMockDb({
      userId,
      deviceIds: ["dev-a"],
      rows: {
        devices: [
          { device_id: "dev-a", user_id: userId },
          { device_id: "dev-b", user_id: other },
        ],
        meal_items: [
          { id: "1", user_id: userId },
          { id: "2", user_id: other },
        ],
        sessions: [{ client_id: "s1", user_id: userId }],
        ai_user_memory: [{ id: "m1", user_id: userId }],
        social_follows: [
          { follower_id: userId, following_id: other },
          { follower_id: other, following_id: "user-c" },
        ],
        activity_kudos: [
          { event_id: "e1", device_id: "dev-a" },
          { event_id: "e2", device_id: "dev-b" },
        ],
        orders: [{ id: "o1", user_id: userId }],
        users: [
          { id: userId },
          { id: other },
        ],
      },
    });

    // BEFORE
    expect(remaining().meal_items).toHaveLength(2);
    expect(remaining().ai_user_memory).toHaveLength(1);
    expect(remaining().social_follows).toHaveLength(2);
    expect(remaining().users).toHaveLength(2);

    const result = await executeAccountWipe(db, {
      userId,
      deviceIds: ["dev-a"],
    });

    // AFTER
    expect(result.ok).toBe(true);
    expect(result.usersRowDeleted).toBe(true);
    expect(remaining().meal_items.every((r) => r.user_id !== userId)).toBe(true);
    expect(remaining().meal_items).toHaveLength(1);
    expect(remaining().ai_user_memory).toHaveLength(0);
    expect(remaining().sessions).toHaveLength(0);
    expect(remaining().social_follows.every((r) => r.follower_id !== userId)).toBe(true);
    expect(remaining().activity_kudos.every((r) => r.device_id !== "dev-a")).toBe(true);
    expect(remaining().users.find((u) => u.id === userId)).toBeUndefined();
    expect(remaining().users.find((u) => u.id === other)).toBeDefined();
    // orders not in wipe path
    expect(deletedOps.some((o) => o.table === "orders")).toBe(false);
    expect(remaining().orders).toHaveLength(1);
  });

  it("reports partial when a table delete fails", async () => {
    const failing: WipeDb = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
          delete() {
            return {
              eq() {
                if (table === "meal_items") {
                  return Promise.resolve({ error: { code: "42501", message: "denied" } });
                }
                return Promise.resolve({ error: null });
              },
              in() {
                return Promise.resolve({ error: null });
              },
              or() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };

    const result = await executeAccountWipe(failing, { userId: "u1", deviceIds: [] });
    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.errors.some((e) => e.table === "meal_items")).toBe(true);
  });
});
