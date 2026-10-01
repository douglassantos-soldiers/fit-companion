import { createServerFn } from "@tanstack/react-start";
import type { SocialWriteOp } from "@/lib/social-write.server";
import { parseSocialWriteOp } from "@/lib/validation/social-write";

const create = createServerFn({ method: "POST" }).inputValidator(parseSocialWriteOp);

// Large SocialWriteOp union breaks TanStack Start ServerFn generic inference (pre-existing pattern).
type SocialWriteCaller = (opts: { data: SocialWriteOp }) => Promise<Record<string, unknown>>;

export const socialWriteFn = (
  create as unknown as {
    handler: (
      fn: (ctx: { data: SocialWriteOp }) => Promise<Record<string, unknown>>,
    ) => unknown;
  }
).handler(async ({ data }) => {
  const { executeSocialWrite } = await import("@/lib/social-write.server");
  return executeSocialWrite(data) as Promise<Record<string, unknown>>;
}) as SocialWriteCaller;
