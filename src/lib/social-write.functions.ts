import { createServerFn } from "@tanstack/react-start";
import type { SocialWriteOp } from "@/lib/social-write.server";

function parseOp(input: unknown): SocialWriteOp {
  const v = input as SocialWriteOp | null;
  if (!v || typeof v !== "object" || !("op" in v)) throw new Error("op obrigatória");
  return v;
}

const create = createServerFn({ method: "POST" }).inputValidator(parseOp);

// Large SocialWriteOp union breaks TanStack Start ServerFn generic inference (pre-existing pattern).
export const socialWriteFn = (
  create as unknown as {
    handler: (
      fn: (ctx: { data: SocialWriteOp }) => Promise<Record<string, unknown>>,
    ) => typeof create;
  }
).handler(async ({ data }) => {
  const { executeSocialWrite } = await import("@/lib/social-write.server");
  return executeSocialWrite(data);
}) as typeof create;
