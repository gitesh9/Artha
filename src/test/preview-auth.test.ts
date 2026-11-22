import { describe, expect, it } from "vitest";
import { authRequestPolicy } from "@/core/auth/request-policy";

const preview = "https://61f8f5db-ea02-48d8-8dc0-4bc37337670c.lovableproject.com";
describe("preview sessions", () => {
  it("uses secure partitioned cookies for embedded preview sign-in and the subsequent session lookup", () => {
    const signIn = authRequestPolicy(new Request("http://localhost:8080/api/auth/sign-in/email", { headers: { origin: preview } }), undefined, true);
    const session = authRequestPolicy(new Request("http://localhost:8080/_serverFn/session", { headers: { "x-forwarded-host": new URL(preview).host, "x-forwarded-proto": "https" } }), undefined, true);
    expect(signIn).toEqual(session);
    expect(signIn.baseURL).toBe(preview);
    expect(signIn.advanced.defaultCookieAttributes).toEqual({ httpOnly: true, secure: true, sameSite: "none", partitioned: true });
    expect(signIn.advanced.useSecureCookies).toBe(true);
  });
  it("preserves local HTTP sign-in without requesting invalid cross-site cookies", () => {
    const policy = authRequestPolicy(new Request("http://localhost:8080/api/auth/sign-in/email"), "https://artha98.netlify.app", true);
    expect(policy.baseURL).toBe("http://localhost:8080");
    expect(policy.advanced.defaultCookieAttributes).toEqual({ httpOnly: true, secure: false, sameSite: "lax" });
  });
  it("does not grant cookie or origin exceptions to an arbitrary host or to production", () => {
    const request = new Request("https://attacker.example/api/auth/sign-in/email", { headers: { origin: "https://attacker.example", "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https" } });
    for (const development of [false, true]) {
      const policy = authRequestPolicy(request, "https://artha98.netlify.app", development);
      expect(policy.baseURL).toBe("https://artha98.netlify.app");
      expect(policy.advanced.defaultCookieAttributes.sameSite).toBe("lax");
      expect(policy.advanced.defaultCookieAttributes).not.toHaveProperty("partitioned");
      expect(policy.trustedOrigins ?? []).not.toContain("https://attacker.example");
    }
  });
});