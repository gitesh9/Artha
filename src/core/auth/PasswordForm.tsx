import { useState, type FormEvent } from "react";
import { authClient } from "./client";
import { validateNewPassword, passwordPolicy } from "./password-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOffline } from "@/core/offline/OfflineProvider";
import { toast } from "sonner";

export function ChangePasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { online } = useOffline();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("newPassword"));
    const invalid = validateNewPassword(password, String(data.get("confirmation")));
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const result = await authClient.changePassword({ currentPassword: String(data.get("currentPassword")), newPassword: password, revokeOtherSessions: true });
      if (result.error) { setError(result.error.message ?? "Password could not be changed."); return; }
      form.reset(); toast.success("Password changed. Other devices have been signed out.");
    } catch { setError("Password change is unavailable. Please try again when connected."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-4">
    <div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required /></div>
    <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" name="newPassword" type="password" minLength={passwordPolicy.minLength} maxLength={passwordPolicy.maxLength} autoComplete="new-password" required /></div>
    <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={busy || !online}>{busy ? "Changing password…" : "Change password"}</Button>
  </form>;
}