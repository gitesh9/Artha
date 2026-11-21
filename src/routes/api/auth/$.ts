import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/core/auth/auth";

// Better Auth handles all /api/auth/* requests (sign-up, sign-in, sign-out, session).
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => (await getAuth()).handler(request),
      POST: async ({ request }) => (await getAuth()).handler(request),
    },
  },
});
