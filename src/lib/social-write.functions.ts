import { createServerFn } from "@tanstack/react-start";
import type { SocialWriteOp } from "@/lib/social-write.server";

function parseOp(input: unknown): SocialWriteOp {
  const v = input as SocialWriteOp | null;
  if (!v || typeof v !== "object" || !("op" in v)) throw new Error("op obrigatória");
  return v;
}

export const socialWriteFn = createServerFn({ method: "POST" })
  .inputValidator(parseOp)
  .handler(async ({ data }) => {
    const { executeSocialWrite } = await import("@/lib/social-write.server");
    return executeSocialWrite(data);
  });
