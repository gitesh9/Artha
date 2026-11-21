// @vitest-environment node
import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/core/db/schema";
import { passwordPolicy, validateNewPassword } from "@/core/auth/password-policy";

describe("password security", () => {
  it("rejects mismatched new passwords", () => expect(validateNewPassword("long-password", "different-password")).not.toBeNull());
  it("uses salted hashes and single-use recovery tokens, and revokes sessions after reset", async () => {
    const pg = new PGlite();
    const db = drizzle(pg, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    let resetToken = "";
    const auth = betterAuth({ secret: "test-only-credential-not-used-in-app-1234567890", baseURL: "http://localhost:8080", database: drizzleAdapter(db, { provider: "pg", schema }), emailAndPassword: { enabled: true, minPasswordLength: passwordPolicy.minLength, maxPasswordLength: passwordPolicy.maxLength, resetPasswordTokenExpiresIn: passwordPolicy.resetTokenSeconds, revokeSessionsOnPasswordReset: true, sendResetPassword: async ({ token }) => { resetToken = token; } } });
    const password = "test-password-for-security";
    const first = await auth.api.signUpEmail({ body: { email: "one@example.com", password, name: "One" } });
    await auth.api.signUpEmail({ body: { email: "two@example.com", password, name: "Two" } });
    const accounts = await db.select().from(schema.account);
    const hashes = accounts.map((row) => row.password);
    expect(hashes.every((value) => typeof value === "string" && value !== password)).toBe(true);
    expect(hashes[0] !== hashes[1]).toBe(true);
    expect(passwordPolicy.resetTokenSeconds).toBe(3600);
    await auth.api.requestPasswordReset({ body: { email: "one@example.com", redirectTo: "http://localhost:8080/reset-password" } });
    expect(Boolean(resetToken)).toBe(true);
    const newPassword = "new-test-password-for-security";
    await auth.api.resetPassword({ body: { token: resetToken, newPassword } });
    expect((await db.select().from(schema.session).where(eq(schema.session.userId, first.user.id))).length).toBe(0);
    let reused = false;
    try { await auth.api.resetPassword({ body: { token: resetToken, newPassword } }); reused = true; } catch { /* Expected: token consumed. */ }
    expect(reused).toBe(false);
    let oldWorks = false;
    try { await auth.api.signInEmail({ body: { email: "one@example.com", password } }); oldWorks = true; } catch { /* Expected. */ }
    expect(oldWorks).toBe(false);
    const signedIn = await auth.api.signInEmail({ body: { email: "one@example.com", password: newPassword } });
    expect(signedIn.user.id === first.user.id).toBe(true);
    await pg.close();
  }, 30000);
});