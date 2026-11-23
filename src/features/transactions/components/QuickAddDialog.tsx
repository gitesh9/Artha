import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouteContext } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAccounts } from "@/features/accounts/functions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/shared/categories";
import { toISODate } from "@/shared/dates";
import { qk } from "@/shared/queries";
import { enqueueEntry } from "@/core/offline/storage";
import { taggedNote } from "../tags";

export function QuickAddDialog() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"expense" | "income" | "transfer">("expense");
  const [destinationId, setDestinationId] = useState("");
  const [category, setCategory] = useState<string>("Food");
  const [accountId, setAccountId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fetchAccounts = useServerFn(listAccounts);
  const { user } = useRouteContext({ from: "/_authenticated" });
  const accounts = useQuery({ queryKey: qk.accounts, queryFn: () => fetchAccounts(), enabled: open });
  const cats = kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const selectedAccount = accountId || accounts.data?.[0]?.id || "";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const data = {
          clientId: crypto.randomUUID(),
          kind, category, accountId: selectedAccount,
          amount: Number(f.get("amount")),
          note: taggedNote(String(f.get("note") || ""), String(f.get("tags") || "")),
          occurredOn: String(f.get("date")),
          ...(kind === "transfer" ? { destinationId, ...(f.get("received") ? { destinationAmount: Number(f.get("received")) } : {}) } : {}),
        };
      const account = accounts.data?.find((a) => a.id === selectedAccount);
      if (!account) throw new Error("Load an account before saving an entry.");
      if (kind === "transfer" && (!destinationId || destinationId === selectedAccount)) throw new Error("Choose two different accounts.");
      // Write durably BEFORE sending; a lost response can be safely retried using clientId.
      await enqueueEntry(user.id, { data, currency: account.currency, createdAt: Date.now() });
      toast.success(navigator.onLine ? "Entry saved on this device; syncing…" : "Entry saved offline. It will sync when connected.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save on this device. Keep this form open and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add entry</Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle className="font-display text-2xl">New entry</DialogTitle></DialogHeader>
        {accounts.isPending ? <p role="status" className="text-sm text-muted-foreground">{accounts.fetchStatus === "paused" ? "No saved accounts on this device. Reconnect to load them before logging." : "Loading accounts…"}</p> : accounts.isError ? <p role="alert" className="text-sm text-destructive">Accounts couldn’t load. Please reconnect and try again.</p> : accounts.data && accounts.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add an account first. <Link to="/accounts" onClick={() => setOpen(false)} className="text-primary underline">Go to accounts</Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
              {(["expense", "income", "transfer"] as const).map((k) => (
                <Button key={k} type="button" variant={kind === k ? "secondary" : "ghost"} aria-pressed={kind === k}
                  onClick={() => { setKind(k); setCategory(k === "expense" ? "Food" : k === "income" ? "Salary" : "Internal transfer"); }}
                  className={`rounded-md py-1.5 text-sm font-medium capitalize ${kind === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                  {k}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required autoFocus className="num text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {kind !== "transfer" && <div className="space-y-2">
                <Label htmlFor="entry-category">Category</Label>
                <Select value={category} onValueChange={(value) => { if (cats.some((option) => option === value)) setCategory(value); }}>
                  <SelectTrigger id="entry-category" className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>}
              <div className="space-y-2">
                <Label htmlFor="entry-account">Account</Label>
                <Select value={selectedAccount} onValueChange={setAccountId}>
                  <SelectTrigger id="entry-account" className="min-h-11"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {kind === "transfer" && <><label className="grid gap-2 text-sm">Destination account<select className="min-h-11 rounded-md border bg-background px-3" required value={destinationId} onChange={e => setDestinationId(e.target.value)}><option value="">Choose account</option>{accounts.data?.filter(a => a.id !== selectedAccount).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>{accounts.data?.find(a => a.id === destinationId)?.currency !== accounts.data?.find(a => a.id === selectedAccount)?.currency && destinationId && <label className="grid gap-2 text-sm">Actual amount received in destination currency<Input name="received" type="number" min="0.01" step="0.01" required /></label>}<p className="text-sm text-muted-foreground">Internal movement · excluded from income and spending. Enter fees separately as an expense.</p></>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="date">Date</Label><Input id="date" name="date" type="date" defaultValue={toISODate(new Date())} required /></div>
              <div className="space-y-2"><Label htmlFor="note">Note</Label><Input id="note" name="note" placeholder="Lunch, Uber…" /></div>
            </div>
            <label className="grid gap-2 text-sm">Tags<Input name="tags" placeholder="hospital, car-maintenance, petrol" /></label>
            <Button className="w-full" disabled={busy || !selectedAccount}>Save</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
