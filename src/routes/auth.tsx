import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient } from "@/core/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/shared/components/ThemeProvider";
import { broadcastVaultLock } from "@/core/offline/vault";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Artha" },
      { name: "description", content: "Sign in or create your Artha account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Sign in — Artha" },
      { property: "og:description", content: "Sign in or create your Artha account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    setError("");
    try {
    if (mode === "forgot") {
      const res = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
      if (res.error) { setError("Password recovery is unavailable. The email sender may not be configured; please try again later."); return; }
      setSent(true); return;
    }
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: String(f.get("name") || email.split("@")[0]) })
        : await authClient.signIn.email({ email, password });
    if (res.error) { setError(res.error.message ?? "Sign-in failed. Please try again."); return; }
    broadcastVaultLock();
    await navigate({ to: "/dashboard", replace: true });
    } catch { setError("Could not connect. Your details are still here; reconnect and try again."); }
    finally { setBusy(false); }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-background px-6 py-20">
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
        <div>
          <p className="mb-10 text-3xl font-bold">Artha<span className="text-primary">.</span></p>
          <h1 className="mt-2 text-3xl font-semibold">{mode === "signin" ? "Welcome back" : mode === "forgot" ? "Forgot password" : "Create account"}</h1>
        </div>
        {mode === "signup" && (
          <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" autoComplete="name" /></div>
        )}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
        {mode !== "forgot" && <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} required />
        </div>}
        {sent && <p role="status" className="text-sm">If an account matches that email, a reset link will arrive shortly. Check your spam folder too.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={busy || (mode === "forgot" && sent)}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create account"}</Button>
        {mode === "signin" && <Button variant="link" type="button" className="w-full" disabled={busy} onClick={() => { setMode("forgot"); setError(""); setSent(false); }}>Forgot password?</Button>}
        <Button variant="link" type="button" className="w-full whitespace-normal text-sm"
          disabled={busy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setSent(false); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </Button>
      </form>
    </main>
  );
}
