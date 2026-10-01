import { describe, expect, it } from "vitest";
import { buildProgressPhotoPath, isValidProgressPhotoPath } from "@/lib/progress/body";
import { readFileSync } from "node:fs";

describe("progress photo ownership (P1-13)", () => {
  it("builds paths under app userId owner folder", () => {
    const path = buildProgressPhotoPath({
      ownerId: "user-aaaaaaaa-bbbb-cccc-dddddddddddd",
      takenOn: "2026-09-30",
      pose: "front",
      id: "photo1",
    });
    expect(path.startsWith("user-aaaaaaaa-bbbb-cccc-dddddddddddd/")).toBe(true);
    expect(isValidProgressPhotoPath(path, "user-aaaaaaaa-bbbb-cccc-dddddddddddd")).toBe(true);
    expect(isValidProgressPhotoPath(path, "other-user")).toBe(false);
  });

  it("server upload path exists for access-only identity", () => {
    const server = readFileSync("src/lib/progress/photos.server.ts", "utf8");
    expect(server).toContain("uploadProgressPhotoBytesServer");
    expect(server).toContain("pathOwnedBy");
    expect(server).toContain("allowedPhotoOwners");
  });
});

describe("verifyPurchase rate limit (P1-9)", () => {
  it("uses distributed burst limit (not process Map)", () => {
    const src = readFileSync("src/lib/shopify.functions.ts", "utf8");
    expect(src).toContain("consumeNamedBurst");
    expect(src).toContain("@/lib/security/burst-limit");
    expect(src).toContain("shopify:verify:");
    expect(src).not.toMatch(/const rateHits = new Map/);
  });
});
