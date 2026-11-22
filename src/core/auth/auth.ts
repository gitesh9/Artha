/** Better Auth server config. Server-only. Email/password now; add social providers here. */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, type Db } from "@/core/db/client";
import * as schema from "@/core/db/schema";
import { passwordPolicy } from "./password-policy";
import { sendRecoveryEmail } from "@/core/integrations/recovery-email";
import { authRequestPolicy } from "./request-policy";

function createAuth(db: Db, secret: string, policy: ReturnType<typeof authRequestPolicy>) {
  return betterAuth({
    secret,
    ...policy,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true, autoSignIn: true,
      minPasswordLength: passwordPolicy.minLength,
      maxPasswordLength: passwordPolicy.maxLength,
      resetPasswordTokenExpiresIn: passwordPolicy.resetTokenSeconds,
      revokeSessionsOnPasswordReset: true,
      // Better Auth hashes passwords with salted scrypt; never encrypt/recover passwords.
      ...(process.env["RESEND_API_KEY"] && process.env["PASSWORD_RESET_FROM"] ? {
        sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
          const key = process.env["RESEND_API_KEY"];
          const sender = process.env["PASSWORD_RESET_FROM"];
          if (!key || !sender) throw new Error("Password recovery email is not configured.");
          await sendRecoveryEmail(user.email, url, key, sender);
        },
      } : {}),
    },
    session: { expiresIn: 60 * 60 * 24 * 30 },
  });
}

const instances = new Map<string, Promise<ReturnType<typeof createAuth>>>();

export function getAuth(request: Request): Promise<ReturnType<typeof createAuth>> {
  const policy = authRequestPolicy(request, process.env["BETTER_AUTH_URL"], import.meta.env.DEV);
  const key = JSON.stringify(policy);
  const existing = instances.get(key);
  if (existing) return existing;
  const instance = (async () => {
    const secret =
      process.env["BETTER_AUTH_SECRET"] ?? (import.meta.env.DEV ? "dev-only-secret-change-me-please-0123456789" : undefined);
    if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
    return createAuth(await getDb(), secret, policy);
  })().catch((e) => {
    instances.delete(key);
    throw e;
  });
  instances.set(key, instance);
  return instance;
}
