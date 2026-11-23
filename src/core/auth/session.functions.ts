import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

/** Returns the current user or null. Safe to call from route beforeLoad (SSR reads the cookie). */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  const { getAuth } = await import("./auth");
  const request = getRequest();
  const auth = await getAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null;
});
export const getSignInOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { googleConfigured } = await import("./google-policy");
  return { google: googleConfigured(process.env["GOOGLE_CLIENT_ID"], process.env["GOOGLE_CLIENT_SECRET"]) };
});
