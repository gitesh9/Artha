import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

/** Returns the current user or null. Safe to call from route beforeLoad (SSR reads the cookie). */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  const { getAuth } = await import("./auth");
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: getRequest().headers });
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null;
});
