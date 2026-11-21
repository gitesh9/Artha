import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient } from "@/core/auth/client";
import { passwordPolicy, validateNewPassword } from "@/core/auth/password-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/shared/components/ThemeProvider";
import { clearOfflineUser, offlineUser } from "@/core/offline/storage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { broadcastVaultLock } from "@/core/offline/vault";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search["token"] === "string" ? search["token"] : "", error: typeof search["error"] === "string" ? search["error"] : "" }),
  head: () => ({ meta: [{ title: "Reset password — Artha" }, { name: "description", content: "Securely set a new password for your Artha account." }, { property: "og:title", content: "Reset password — Artha" }, { property: "og:description", content: "Securely recover access to your Artha account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }] }),
  component: ResetPassword,
});
function ResetPassword() {
  const { token, error: tokenError } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const newPassword = String(data.get("password"));
    const invalid = validateNewPassword(newPassword, String(data.get("confirmation")));
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const result = await authClient.resetPassword({ token, newPassword });
      if (result.error) { setError("This link is invalid or expired. Request a new reset link."); return; }
      await qc.cancelQueries(); qc.clear();
      const user = await offlineUser().catch(() => null);
      if (user) await clearOfflineUser(user.id, true).catch(() => {});
      broadcastVaultLock();
      toast.success("Password reset. Sign in with your new password.");
      await navigate({ to: "/auth", replace: true });
    } catch { setError("Password reset is unavailable. Please reconnect and try again."); }
    finally { setBusy(false); }
  }
  return <main className="relative flex min-h-dvh items-center justify-center px-6 py-20"><div className="absolute right-6 top-6"><ThemeToggle /></div><div className="w-full max-w-sm space-y-6"><p className="text-3xl font-bold">Artha<span className="text-primary">.</span></p><h1 className="text-3xl font-semibold">Reset password</h1>
    {!token || tokenError ? <p role="alert" className="text-sm text-destructive">Your reset link is missing or expired. Request a new link from the sign-in page.</p> : <form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="reset-password">New password</Label><Input id="reset-password" name="password" type="password" minLength={passwordPolicy.minLength} maxLength={passwordPolicy.maxLength} autoComplete="new-password" required /></div><div className="space-y-2"><Label htmlFor="reset-confirmation">Confirm new password</Label><Input id="reset-confirmation" name="confirmation" type="password" autoComplete="new-password" required /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? "Resetting password…" : "Reset password"}</Button></form>}
    <Button asChild variant="link"><Link to="/auth">Back to sign in</Link></Button>
  </div></main>;
}