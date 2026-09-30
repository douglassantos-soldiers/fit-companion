// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public (non-secret) Supabase values. .env is git-ignored in this project, so the
// published build would otherwise ship without them ("Missing Supabase environment variable(s)").
// Vite picks up VITE_* from process.env, so these fill in only when .env is absent.
const PUBLIC_SUPABASE = {
  VITE_SUPABASE_URL: "https://zphtvrsxlhfgltwgbreu.supabase.co",
  VITE_SUPABASE_PROJECT_ID: "zphtvrsxlhfgltwgbreu",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaHR2cnN4bGhmZ2x0d2dicmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNTc1MTEsImV4cCI6MjEwNDgzMzUxMX0.szipA1i-3PwnV-UI6van70vT840wKy-OqQ7SLvssjls",
};
for (const [k, v] of Object.entries(PUBLIC_SUPABASE)) {
  if (!process.env[k]) process.env[k] = v;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
