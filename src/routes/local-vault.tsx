import { createFileRoute, redirect, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { getCurrentUser } from "@/core/auth/session.functions";
import { offlineUser, rememberOfflineUser, migrateFinancialData } from "@/core/offline/storage";
import { createVault, unlockVault, vaultExists, vaultMinLength } from "@/core/offline/vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/shared/components/ThemeProvider";
import { verifySecondaryPin } from "@/core/offline/secondary-pin";
import { safeReturnPath } from "@/core/offline/return-path";

export const Route = createFileRoute("/local-vault")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => { const r = safeReturnPath(search["redirect"]); return r ? { redirect: r } : {}; },
  beforeLoad: async () => {
    const offline = !navigator.onLine;
    const user = offline ? await offlineUser() : await getCurrentUser();
    if (!user) throw redirect({ to: "/auth" });
    const exists = await vaultExists(user.id);
    return { user, exists, offline };
  },
  head: () => ({ meta: [{ title: "Unlock local data — Artha" }, { name: "description", content: "Protect this device’s financial data with a private passphrase." }, { property: "og:title", content: "Unlock local data — Artha" }, { property: "og:description", content: "Set up or unlock your encrypted local financial cache." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: LocalVault,
});
function LocalVault() {
  const { user, exists, offline } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: returnTo } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(exists);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const passphrase = String(data.get("passphrase") || "");
    if (!configured && passphrase !== data.get("confirmation")) { setError("The device passphrases do not match."); return; }
    setBusy(true); setError("");
    try {
      if (configured) await unlockVault(user.id, passphrase);
      else { await createVault(user.id, passphrase); setConfigured(true); }
      await verifySecondaryPin(user.id, String(data.get("pin") || ""));
      await migrateFinancialData(user.id);
      if (!offline) await rememberOfflineUser(user);
      form.reset();
      if (returnTo) router.history.replace(returnTo); else await navigate({ to: "/dashboard", replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : "Local protection could not open. Keep your passphrase and try again; saved entries have not been removed."); }
    finally { setBusy(false); }
  }
  return <main className="relative flex min-h-dvh items-center justify-center px-5 py-20">
    <div className="absolute right-6 top-6"><ThemeToggle /></div>
    <div className="w-full max-w-lg space-y-6">
      <p className="text-3xl font-bold">Artha<span className="text-primary">.</span></p>
      <h1 className="flex items-center gap-3 text-2xl font-semibold"><LockKeyhole aria-hidden="true" className="h-6 w-6 text-primary" />{configured ? "Unlock local data" : "Protect this device"}</h1>
      <p className="text-sm text-muted-foreground">{configured ? "Your financial copies are locked. Enter this device’s passphrase to open them." : "Choose a separate device passphrase. It encrypts financial snapshots, saved entries, and sync history before they are stored in your browser."}</p>
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2"><Label htmlFor="device-passphrase">Device passphrase</Label><Input id="device-passphrase" name="passphrase" type="password" required minLength={vaultMinLength} maxLength={256} autoComplete="off" disabled={busy} /></div>
        {!configured && <div className="space-y-2"><Label htmlFor="device-confirmation">Confirm device passphrase</Label><Input id="device-confirmation" name="confirmation" type="password" required minLength={vaultMinLength} maxLength={256} autoComplete="off" disabled={busy} /></div>}
        {configured && <div className="space-y-2"><Label htmlFor="secondary-pin">Secondary PIN · only if enabled on this device</Label><Input id="secondary-pin" name="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={12} disabled={busy} /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={busy} className="w-full">{busy ? "Opening protected data…" : configured ? "Unlock" : "Encrypt local data"}</Button>
      </form>
      <div className="space-y-3 border-t pt-5 text-sm text-muted-foreground">
        <p>The passphrase never goes to a server or browser storage. A non-exportable encryption key stays only in this open tab’s memory. Refreshing, closing, locking, or signing out requires unlocking again.</p>
        <p>Use at least 12 characters; several unrelated words are better. There is no passphrase recovery: forgetting it can permanently lose unsynced entries. Resetting your sign-in password does not unlock local data.</p>
        <p>Other device users cannot read these encrypted copies without the passphrase while locked. They can still delete browser data. Someone using an unlocked app, or malicious extensions or code, may access visible data; keep your device screen locked.</p>
        <p>Existing unencrypted copies are converted when you unlock; copies belonging to another Artha account must be migrated by that account. Your name, email, account identifier, and offline-access expiry remain readable as sign-in metadata.</p>
      </div>
      <Button asChild variant="link"><Link to="/auth">Back to sign in</Link></Button>
    </div>
  </main>;
}