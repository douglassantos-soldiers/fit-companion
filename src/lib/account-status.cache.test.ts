import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("account status TTL cache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/db-admin");
    vi.doUnmock("@/lib/admin.server");
    vi.resetModules();
  });

  async function loadWithMockDb(opts?: {
    status?: string;
    selectCalls?: { n: number };
  }) {
    const selectCalls = opts?.selectCalls ?? { n: 0 };
    const status = opts?.status ?? "active";

    const usersSelectChain = {
      select(this: unknown, _cols?: string) {
        return this;
      },
      eq(this: unknown, _col?: string, _val?: string) {
        return this;
      },
      async maybeSingle() {
        selectCalls.n += 1;
        return {
          data: { status, status_until: null, status_reason: null, id: "u1" },
          error: null,
        };
      },
      update(this: unknown) {
        return this;
      },
    };

    vi.doMock("@/lib/db-admin", () => ({
      adminDbLoose: async () => ({
        from: (_table: string) => usersSelectChain,
      }),
    }));
    vi.doMock("@/lib/admin.server", () => ({
      ADMIN_ACTOR: { kind: "admin" },
      writeAudit: async () => undefined,
      lookupUserByEmail: async () => ({
        id: "u1",
        email: "test@example.com",
        status: "active",
      }),
    }));

    const mod = await import("@/lib/account-status.server");
    mod.clearAccountStatusCacheForTests();
    return { mod, selectCalls };
  }

  it("second checkUserBlocked within TTL does not re-query users.status", async () => {
    const { mod, selectCalls } = await loadWithMockDb();
    const a = await mod.checkUserBlocked({ userId: "u1" });
    const b = await mod.checkUserBlocked({ userId: "u1" });
    expect(a).toEqual({ blocked: false, statusKnown: true });
    expect(b).toEqual(a);
    expect(selectCalls.n).toBe(1);
  });

  it("invalidateAccountStatusCache forces a fresh query", async () => {
    const { mod, selectCalls } = await loadWithMockDb();
    await mod.checkUserBlocked({ userId: "u1" });
    expect(selectCalls.n).toBe(1);
    mod.invalidateAccountStatusCache({ userId: "u1" });
    await mod.checkUserBlocked({ userId: "u1" });
    expect(selectCalls.n).toBe(2);
  });

  it("setUserAccountStatus invalidates cache so ban is visible immediately", async () => {
    const selectCalls = { n: 0 };
    const usersChain = {
      select(this: unknown) {
        return this;
      },
      eq(this: unknown) {
        return this;
      },
      async maybeSingle() {
        selectCalls.n += 1;
        if (selectCalls.n === 1) {
          // First: checkUserBlocked loads status
          return {
            data: { status: "active", status_until: null, status_reason: null },
            error: null,
          };
        }
        if (selectCalls.n === 2) {
          // setUserAccountStatus looks up id by email
          return { data: { id: "u1" }, error: null };
        }
        // After invalidate: check sees banned
        return {
          data: { status: "banned", status_until: null, status_reason: "test" },
          error: null,
        };
      },
      update(this: unknown) {
        return {
          eq: async () => ({ error: null }),
        };
      },
    };

    vi.doMock("@/lib/db-admin", () => ({
      adminDbLoose: async () => ({
        from: () => usersChain,
      }),
    }));
    vi.doMock("@/lib/admin.server", () => ({
      ADMIN_ACTOR: { kind: "admin" },
      writeAudit: async () => undefined,
      lookupUserByEmail: async () => ({
        id: "u1",
        email: "test@example.com",
        status: "banned",
      }),
    }));

    const mod = await import("@/lib/account-status.server");
    mod.clearAccountStatusCacheForTests();

    const before = await mod.checkUserBlocked({ userId: "u1", email: "test@example.com" });
    expect(before.blocked).toBe(false);

    const set = await mod.setUserAccountStatus({
      email: "test@example.com",
      status: "banned",
      reason: "test",
    });
    expect(set.ok).toBe(true);

    const after = await mod.checkUserBlocked({ userId: "u1", email: "test@example.com" });
    expect(after.blocked).toBe(true);
    expect(after.statusKnown).toBe(true);
  });

  it("does not cache DB-unavailable fail-closed results", async () => {
    vi.doMock("@/lib/db-admin", () => ({
      adminDbLoose: async () => null,
    }));
    const mod = await import("@/lib/account-status.server");
    mod.clearAccountStatusCacheForTests();
    const a = await mod.checkUserBlocked({ userId: "u1" });
    expect(a).toEqual({ blocked: true, statusKnown: false });
    // Still miss after "cache" — next call hits adminDbLoose again (still null).
    const b = await mod.checkUserBlocked({ userId: "u1" });
    expect(b).toEqual(a);
  });
});
