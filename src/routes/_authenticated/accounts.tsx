import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { DeleteAction } from "@/shared/components/DeleteAction";
import { toast } from "sonner";
import { createAccount, deleteAccount, listAccounts } from "@/features/accounts/functions";
import { getSettings } from "@/features/settings/functions";
import { ACCOUNT_TYPES, type AccountType } from "@/shared/categories";
import { CURRENCIES, formatMoney, minorFactor, type Currency } from "@/shared/money";
import { convertMinor } from "@/core/integrations/currency";
import { invalidateMoney, qk } from "@/shared/queries";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOffline } from "@/core/offline/OfflineProvider";
import { PageError } from "@/shared/components/NavigationStatus";
import { requireSavedData } from "@/shared/query-loading";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Artha" }, { name: "description", content: "Your bank, cash, card and wallet balances." }, { property: "og:title", content: "Accounts — Artha" }, { property: "og:description", content: "Your bank, cash, card and wallet balances." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Accounts,
  loader: async ({ context }) => { requireSavedData(context.queryClient, qk.accounts); requireSavedData(context.queryClient, qk.settings); await Promise.all([context.queryClient.ensureQueryData({ queryKey: qk.accounts, queryFn: () => listAccounts() }), context.queryClient.ensureQueryData({ queryKey: qk.settings, queryFn: () => getSettings() })]); },
  errorComponent: PageError,
  notFoundComponent: PageError,
});

function Accounts() {
  const qc = useQueryClient();
  const { online } = useOffline();
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<AccountType>("bank");
  const [currency, setCurrency] = useState<Currency>("INR");
  const { data = [] } = useQuery({ queryKey: qk.accounts, queryFn: () => listAccounts() });
  const settings = useQuery({ queryKey: qk.settings, queryFn: () => getSettings() });
  const base = settings.data?.baseCurrency ?? "INR";
  const total = settings.data
    ? data.reduce((s, a) => s + (convertMinor(a.balanceMinor, a.currency, base, settings.data.rates, minorFactor) ?? 0), 0)
    : 0;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (!online || busy) return;
    setBusy(true);
    try {
      await createAccount({ data: { name: String(f.get("name")), type, currency, openingBalance: Number(f.get("opening") || 0) } });
      await invalidateMoney(qc);
      toast.success("Account added");
      form.reset();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Accounts" subtitle={`Total balance ${formatMoney(total, base)}`} />
      <Panel className="mb-4">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-2 text-sm sm:w-56">Account name<Input name="name" required placeholder="e.g. HDFC Savings" /></label>
          <label className="grid gap-2 text-sm">Account type<select aria-label="Type" className="h-9 rounded-md border bg-background px-2 text-sm capitalize" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select></label>
          <label className="grid gap-2 text-sm">Currency<select aria-label="Currency" className="h-9 rounded-md border bg-background px-2 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select></label>
          <label className="grid w-full gap-2 text-sm sm:w-40">Opening balance<Input name="opening" type="number" step="0.01" placeholder="0.00" /></label>
          <Button disabled={!online || busy}>{busy ? "Saving…" : "Add account"}</Button>
        </form>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        {data.map((a) => (
          <Panel card key={a.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{a.type} · {a.currency}</p>
                <h2 className="mt-1 text-lg font-semibold">{a.name}</h2>
              </div>
              <DeleteAction label={`${a.name} account`} description="This will permanently remove the account and all its transactions." onConfirm={async () => { await deleteAccount({ data: { id: a.id } }); await invalidateMoney(qc); }} />
            </div>
            <p className={`num mt-3 text-2xl font-semibold ${a.balanceMinor < 0 ? "text-expense" : ""}`}>{formatMoney(a.balanceMinor, a.currency)}</p>
          </Panel>
        ))}
        {data.length === 0 && <p className="text-muted-foreground">Add your first account to start logging.</p>}
      </div>
    </>
  );
}
