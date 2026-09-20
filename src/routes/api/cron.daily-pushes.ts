import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/daily-pushes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"]?.trim() ?? "";
        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!secret || token !== secret) {
          return new Response(JSON.stringify({ ok: false, reason: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { sendDailyPushes } = await import("@/lib/push.server");
        const result = await sendDailyPushes();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
