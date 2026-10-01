import { describe, expect, it } from "vitest";
import { parseSocialWriteOp } from "@/lib/validation/social-write";
import {
  normalizeImageUpload,
  sanitizeDisplayName,
  EmailSchema,
} from "@/lib/validation/common";
import { parseAppStatePush } from "@/lib/validation/app-state-push";

describe("security validation", () => {
  it("rejects social write without structured fields", () => {
    expect(() => parseSocialWriteOp({ op: "comment" })).toThrow();
  });

  it("accepts comment op with device + body", () => {
    const op = parseSocialWriteOp({
      op: "comment",
      deviceId: "device-abc-123",
      eventId: "evt-001-xyz",
      body: "  <b>oi</b>  ",
    });
    expect(op.op).toBe("comment");
    if (op.op === "comment") {
      expect(op.deviceId).toBe("device-abc-123");
      expect(op.body).toContain("oi");
    }
  });

  it("sanitizes display names", () => {
    expect(sanitizeDisplayName("  <b>Ana</b>  ")).toBe("Ana");
    expect(sanitizeDisplayName("<script>x</script>")).toBe("x");
  });

  it("rejects svg uploads", () => {
    expect(() =>
      normalizeImageUpload({ contentType: "image/svg+xml", fileExt: "svg" }),
    ).toThrow(/não permitido/);
  });

  it("validates email schema", () => {
    expect(EmailSchema.safeParse("a@b.com").success).toBe(true);
    expect(EmailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("caps push state arrays and sanitizes profile name", () => {
    const { state } = parseAppStatePush({
      deviceId: "device-abc-123",
      state: {
        profile: { name: "<b>Bob</b>", goal: "massa", level: "iniciante", daysPerWeek: 3 },
        sessions: Array.from({ length: 600 }, (_, i) => ({ id: String(i) })),
      },
    });
    expect(state.profile?.name).toBe("Bob");
    expect(state.sessions.length).toBe(500);
  });
});
