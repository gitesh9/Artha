import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { savePlanning, removePlanning } from "../functions";
import { payloadSchema, type RecordKind, type FinancialRecord } from "../schema";
import { planningQuery } from "../queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteAction } from "@/shared/components/DeleteAction";
import { Panel } from "@/shared/components/PageHeader";
import { CURRENCIES, formatMoney, toMinor, fromMinor } from "@/shared/money";
import { toISODate } from "@/shared/dates";
import { useOffline } from "@/core/offline/OfflineProvider";
import { toast } from "sonner";
import { useDraft } from "@/shared/components/DraftProvider";
import { listAccounts } from "@/features/accounts/functions";
import { taggedNote } from "@/features/transactions/tags";
export function RecordEditor({ kind, title, parentKind, subtypes = ["other"], children }: { kind: RecordKind; title: string; parentKind?: RecordKind; subtypes?: string[]; children?: React.ReactNode }) {
  const { draft, setDraft } = useDraft();
  const suggestion = draft && ((draft.target === "goals" && kind === "goal") || (draft.target === "bills" && kind === "bill") || (draft.target === "portfolio" && kind === "holding") || (draft.target === "wealth" && kind === "asset")) ? draft.draft : null;
  const { data: records } = useSuspenseQuery(planningQuery), { online } = useOffline(); const qc = useQueryClient(); const save = useServerFn(savePlanning), remove = useServerFn(removePlanning);
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState<FinancialRecord | null>(null);
  const fetchAccounts = useServerFn(listAccounts);
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts(), enabled: kind === "bill" || kind === "salary" });
  const items = records.filter(r => r.kind === kind), parents = records.filter(r => r.kind === parentKind);
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if (!online || busy) return; const form = e.currentTarget, f = new FormData(form), currency = String(f.get("currency") || "INR"); setBusy(true);
    try { const payload = payloadSchema.parse({ name: f.get("name"), currency, amountMinor: toMinor(Number(f.get("amount") || 0), currency), date: f.get("date"), note: kind === "bill" ? taggedNote(String(f.get("note") || ""), String(f.get("tags") || "")) : String(f.get("note") || ""), valueMinor: toMinor(Number(f.get("value") || 0), currency), targetMinor: toMinor(Number(f.get("target") || 0), currency), quantity: Number(f.get("quantity") || 0), subtype: String(f.get("subtype") || "other"), installmentsLeft: Number(f.get("installments") || 1), ...(f.get("accountId") ? { accountId: f.get("accountId") } : {}), ...(f.get("linkedId") ? { linkedId: f.get("linkedId") } : {}), participants: String(f.get("participants") || "").split(",").map(s => s.trim()).filter(Boolean), payer: String(f.get("payer") || ""), from: String(f.get("from") || ""), to: String(f.get("to") || ""), ...(editing ? { paid: editing.payload.paid, history: editing.payload.history, paymentStatus: editing.payload.paymentStatus, penaltyMinor: editing.payload.penaltyMinor, category: editing.payload.category } : {}) });
      await save({ data: { id: editing?.id ?? crypto.randomUUID(), kind, payload } }); await qc.invalidateQueries({ queryKey: planningQuery.queryKey }); setEditing(null); if (suggestion) setDraft(null); form.reset(); toast.success("Saved online");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved. Your form is retained; retry."); } finally { setBusy(false); }
  }
  const p = editing?.payload;
  return <Panel><h2 className="text-xl font-semibold">{title}</h2>{children}<form key={editing?.id ?? "new"} onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="grid gap-2 text-sm">Name<Input name="name" maxLength={80} required defaultValue={p?.name ?? suggestion?.name} /></label>
    <label className="grid gap-2 text-sm">{kind === "holding" ? "Initial cost" : kind === "goal" ? "Already allocated" : "Amount"}<Input name="amount" required min="0" step="0.01" type="number" defaultValue={p ? fromMinor(p.amountMinor, p.currency) : kind === "goal" ? 0 : suggestion?.amount ?? 0} /></label>
    <label className="grid gap-2 text-sm">Currency<select name="currency" className="min-h-11 rounded-md border bg-background px-3" defaultValue={p?.currency ?? "INR"}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="grid gap-2 text-sm">{kind === "goal" ? "Target date" : kind === "bill" ? "Due date" : "Date"}<Input name="date" type="date" required defaultValue={p?.date ?? toISODate(new Date())} /></label>
    {subtypes.length > 1 && <label className="grid gap-2 text-sm">Type<select name="subtype" className="min-h-11 rounded-md border bg-background px-3" defaultValue={p?.subtype ?? subtypes[0]}>{subtypes.map(t => <option key={t}>{t}</option>)}</select></label>}
    {kind === "bill" && <label className="grid gap-2 text-sm">EMI installments remaining · including this one<Input name="installments" type="number" min="1" max="600" step="1" defaultValue={p?.installmentsLeft ?? 1} /></label>}
    {(kind === "bill" || kind === "salary") && <label className="grid gap-2 text-sm">{kind === "salary" ? "Credit account" : "Linked payment account"}<select name="accountId" required={kind === "salary"} className="min-h-11 rounded-md border bg-background px-3" defaultValue={p?.accountId ?? ""}><option value="">Choose account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>}
    {kind === "bill" && <label className="grid gap-2 text-sm">Tags<Input name="tags" placeholder="hospital, petrol, car-maintenance" /></label>}
    {kind === "bill" && <label className="grid gap-2 text-sm">SIP holding · required for SIP type<select name="linkedId" className="min-h-11 rounded-md border bg-background px-3" defaultValue={p?.linkedId ?? ""}><option value="">Not an SIP</option>{records.filter(r => r.kind === "holding").map(r => <option key={r.id} value={r.id}>{r.payload.name} · {r.payload.currency}</option>)}</select></label>}
    {(["asset", "liability", "holding"] as string[]).includes(kind) && <label className="grid gap-2 text-sm">Current value · manual estimate<Input name="value" type="number" min="0" step="0.01" required defaultValue={p ? fromMinor(p.valueMinor, p.currency) : 0} /></label>}
    {kind === "goal" && <label className="grid gap-2 text-sm">Target amount<Input name="target" type="number" min="0.01" step="0.01" required defaultValue={p ? fromMinor(p.targetMinor, p.currency) : suggestion?.amount} /></label>}
    {(kind === "holding" || kind === "flow") && <label className="grid gap-2 text-sm">Units (0 for cash-only holdings)<Input name="quantity" type="number" min="0" step="any" defaultValue={p?.quantity ?? 0} /></label>}
    {parentKind && <label className="grid gap-2 text-sm">Linked {parentKind}<select required name="linkedId" className="min-h-11 rounded-md border bg-background px-3" defaultValue={p?.linkedId ?? ""}><option value="">Choose</option>{parents.map(r => <option key={r.id} value={r.id}>{r.payload.name} · {r.payload.currency}</option>)}</select></label>}
    {kind === "split" && <><label className="grid gap-2 text-sm">Participants · comma separated<Input name="participants" required defaultValue={p?.participants.join(", ")} /></label><label className="grid gap-2 text-sm">Paid by<Input name="payer" required defaultValue={p?.payer} /></label></>}
    {kind === "settlement" && <><label className="grid gap-2 text-sm">From person<Input name="from" required defaultValue={p?.from} /></label><label className="grid gap-2 text-sm">To person<Input name="to" required defaultValue={p?.to} /></label></>}
    <label className="grid gap-2 text-sm">Note<Input name="note" maxLength={500} defaultValue={p?.note ?? suggestion?.note} /></label><div className="flex flex-wrap items-end gap-2"><Button disabled={!online || busy}>{busy ? "Saving…" : editing ? "Save changes" : `Add ${kind}`}</Button>{editing && <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>}</div>
  </form>{!online && <p className="mt-3 text-sm">Reconnect to save or remove planning records. Existing records remain readable.</p>}
  <div className="mt-6 divide-y">{items.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-medium">{r.payload.name}</h3><p className="mt-1 text-sm text-muted-foreground">{r.payload.date} · {r.payload.subtype} · {formatMoney(r.payload.amountMinor, r.payload.currency)}{r.payload.note ? ` · ${r.payload.note}` : ""}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!online} onClick={() => setEditing(r)}>Edit</Button><DeleteAction label={r.payload.name} description="This removes this planning record. Linked records must be removed first. Your transactions are unchanged." onConfirm={async () => { if (!online) throw new Error("Reconnect before deleting"); await remove({ data: { id: r.id } }); await qc.invalidateQueries({ queryKey: planningQuery.queryKey }); }} /></div></div>)}</div></Panel>;
}