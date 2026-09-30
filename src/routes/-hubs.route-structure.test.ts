import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("hubs route tree (P0-3)", () => {
  it("parent /hubs is a layout with Outlet, not an unconditional redirect", () => {
    const layout = readFileSync(resolve("src/routes/hubs.tsx"), "utf8");
    expect(layout).toContain("Outlet");
    expect(layout).not.toMatch(/beforeLoad[\s\S]*redirect/);
  });

  it("index /hubs/ redirects to social hubs tab", () => {
    const index = readFileSync(resolve("src/routes/hubs.index.tsx"), "utf8");
    expect(index).toContain('createFileRoute("/hubs/")');
    expect(index).toContain("redirect");
    expect(index).toContain('tab: "hubs"');
  });

  it("detail /hubs/$slug remains a real page route", () => {
    const detail = readFileSync(resolve("src/routes/hubs.$slug.tsx"), "utf8");
    expect(detail).toContain('createFileRoute("/hubs/$slug")');
    expect(detail).toContain("HubDetailPage");
  });
});
