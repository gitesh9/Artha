/** Better Auth server config. Server-only. Email/password now; add social providers here. */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, type Db } from "@/core/db/client";
import * as schema from "@/core/db/schema";
import { passwordPolicy } from "./password-policy";
import { sendRecoveryEmail } from "@/core/integrations/recovery-email";

function createAuth(db: Db, secret: string) {
  const baseURL = process.env["BETTER_AUTH_URL"];
  const secure = !import.meta.env.DEV || Boolean(baseURL?.startsWith("https://"));
  return betterAuth({
    secret,
    ...(baseURL ? { baseURL } : {}),
    // Local Netlify proxy and direct Vite both need to pass Better Auth's origin check.
    ...(import.meta.env.DEV ? { trustedOrigins: ["http://localhost:5173", "http://localhost:8888", "http://localhost:8080", "https://id-preview--61f8f5db-ea02-48d8-8dc0-4bc37337670c.lovable.app"] } : {}),
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
    advanced: { defaultCookieAttributes: { sameSite: secure && import.meta.env.DEV ? "none" : "lax", secure } },
  });
}

let instance: Promise<ReturnType<typeof createAuth>> | undefined;

export function getAuth(): Promise<ReturnType<typeof createAuth>> {
  instance ??= (async () => {
    const secret =
      process.env["BETTER_AUTH_SECRET"] ?? (import.meta.env.DEV ? "dev-only-secret-change-me-please-0123456789" : undefined);
    if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
    return createAuth(await getDb(), secret);
  })().catch((e) => {
    instance = undefined;
    throw e;
  });
  return instance;
}
