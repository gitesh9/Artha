import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChangePasswordForm } from "@/core/auth/PasswordForm";
import { useOffline } from "@/core/offline/OfflineProvider";
import { toast } from "sonner";
import { getSettings, updateBaseCurrency } from "@/features/settings/functions";
import { CURRENCIES, type Currency } from "@/shared/money";
import { invalidateMoney, qk } from "@/shared/queries";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/components/ThemeProvider";
import { PageError } from "@/shared/components/NavigationStatus";
import { requireSavedData } from "@/shared/query-loading";
import { ReminderSettings } from "@/features/reminders/ReminderSettings";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { configurePin, disablePin } from "@/core/offline/secondary-pin";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Artha" }, { name: "description", content: "Base currency and exchange rates." }, { property: "og:title", content: "Settings — Artha" }, { property: "og:description", content: "Base currency and exchange rates." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SettingsPage,
  loader: ({ context }) => { requireSavedData(context.queryClient, qk.settings); return context.queryClient.ensureQueryData({ queryKey: qk.settings, queryFn: () => getSettings() }); },
  errorComponent: PageError,
  notFoundComponent: PageError,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const { online } = useOffline();
  const update = useServerFn(updateBaseCurrency);
  const { data } = useQuery({ queryKey: qk.settings, queryFn: () => getSettings() });
  const change = useMutation({ mutationFn: (c: Currency) => update({ data: { baseCurrency: c } }), onSuccess: async (_, c) => { await Promise.all([qc.invalidateQueries({ queryKey: qk.settings }), invalidateMoney(qc)]); toast.success(`Reports now in ${c}`); }, onError: () => toast.error("Currency could not be updated. Your previous setting has been kept.") });
  return (
    <>
      <PageHeader title="Settings" />
      <Panel className="max-w-xl">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div role="group" aria-label="Theme" className="mt-4 flex gap-3">
          <Button variant={theme === "dark" ? "default" : "outline"} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon aria-hidden="true" />Dark</Button>
          <Button variant={theme === "light" ? "default" : "outline"} aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun aria-hidden="true" />Light</Button>
        </div>
      </Panel>
      <Panel className="max-w-xl">
        <h2 className="text-lg font-semibold">Base currency</h2>
        <p className="mt-1 text-sm text-muted-foreground">All reports and budgets are converted into this currency using live rates.</p>
        <select aria-label="Base currency" className="mt-3 h-9 rounded-md border bg-background px-2 text-sm" value={data?.baseCurrency ?? "INR"}
          disabled={!online || change.isPending} onChange={(e) => change.mutate(e.target.value as Currency)}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        {data && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Rates for 1 {data.baseCurrency}{data.rates.date ? ` · ${data.rates.date}` : ""}</p>
            <ul className="num mt-2 grid grid-cols-3 gap-2 text-sm">
              {CURRENCIES.filter((c) => c !== data.baseCurrency).map((c) => (
                <li key={c}>{c} {data.rates.rates[c]?.toFixed(4) ?? "—"}</li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
      <Panel className="max-w-xl"><h2 className="text-lg font-semibold">Security</h2><ChangePasswordForm /></Panel>
      <Panel className="max-w-xl"><h2 className="text-lg font-semibold">Evening reminders</h2><ReminderSettings /></Panel>
      <Panel className="max-w-xl"><h2 className="text-lg font-semibold">Secondary device PIN</h2><p className="mt-3 text-sm text-muted-foreground">An optional extra check after your device passphrase. It never replaces that passphrase or unlocks encrypted data on its own. Use Lock local data for a quick lock. The verifier stays encrypted on this device.</p><label className="mt-4 grid gap-2 text-sm">PIN · 6–12 digits<Input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,12}" value={pin} onChange={e => setPin(e.target.value)} /></label><div className="mt-4 flex flex-wrap gap-3"><Button disabled={pinBusy || !/^\d{6,12}$/.test(pin)} onClick={async () => { setPinBusy(true); try { await configurePin(user.id, pin); setPin(""); toast.success("Secondary PIN enabled; future unlocks need both passphrase and PIN."); } catch { toast.error("PIN was not saved. Retry without closing this page."); } finally { setPinBusy(false); } }}>Enable secondary PIN</Button><Button variant="outline" disabled={pinBusy} onClick={async () => { setPinBusy(true); try { await disablePin(user.id); toast.success("Secondary PIN disabled. Device passphrase protection remains."); } catch { toast.error("Could not change PIN settings."); } finally { setPinBusy(false); } }}>Disable secondary PIN</Button></div></Panel>
      <Panel className="max-w-xl"><h2 className="text-lg font-semibold">Offline data on this device</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div><dt className="font-medium">Encrypted financial copies</dt><dd className="mt-1 text-muted-foreground">Financial snapshots, saved entries, and sync history are encrypted with AES-256-GCM in this browser, separated by account. Each save uses a fresh random nonce. Other websites cannot read this storage.</dd></div>
          <div><dt className="font-medium">How your key is protected</dt><dd className="mt-1 text-muted-foreground">Your separate device passphrase derives a non-exportable key using PBKDF2-SHA-256 with a random salt and 600,000 rounds. The passphrase is never sent to a server or saved by Artha. The key stays only in this tab’s memory, not in browser storage. Only a salt and encrypted check are saved. Use a long, unique passphrase; a weak one can be guessed offline.</dd></div>
          <div><dt className="font-medium">When you sign out</dt><dd className="mt-1 text-muted-foreground">Artha removes keys from open tabs, stops displaying financial data, clears in-memory snapshots, and deletes cached financial snapshots and app page caches. Saved entries and sync history stay encrypted so unsynced work is not lost. To sync them, sign in to the same account and enter this device’s passphrase. Online sign-out also revokes the current server session; if it fails, local data stays locked and you can retry.</dd></div>
          <div><dt className="font-medium">Locking is not signing out</dt><dd className="mt-1 text-muted-foreground">Lock local data works offline and removes the encryption key, but leaves your online session active. Refreshing or closing a tab also removes its key. Sign out online before sharing this device. Offline access still expires 24 hours after online verification.</dd></div>
          <div><dt className="font-medium">Protection on a shared device</dt><dd className="mt-1 text-muted-foreground">While locked, another device user needs the passphrase to read encrypted local finances. They may still delete or copy ciphertext. Encryption cannot protect an unlocked app from someone at your screen, malicious extensions, or injected code. Use separate device profiles, a screen lock, and device encryption.</dd></div>
          <div><dt className="font-medium">Recovery and readable metadata</dt><dd className="mt-1 text-muted-foreground">Your name, email, account identifier, and offline-access expiry remain readable. Passwords and authentication tokens are not in the financial cache. There is no device-passphrase recovery: forgetting it or clearing browser data can permanently lose unsynced entries. A sign-in password reset does not unlock local data. Legacy plaintext copies are migrated for each account when that account unlocks; encryption cannot erase earlier backups or forensic traces.</dd></div>
        </dl>
      </Panel>
    </>
  );
}
