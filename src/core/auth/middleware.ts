/** Server-function middleware: resolves the signed-in user or throws. Use on every private server fn. */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

export const requireUser = createMiddleware({ type: "function" }).server(async ({ next }) => {
  setResponseHeader("Cache-Control", "no-store");
  const request = getRequest();
  const auth = await getAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Unauthorized");
  return next({ context: { userId: session.user.id, user: session.user } });
});
