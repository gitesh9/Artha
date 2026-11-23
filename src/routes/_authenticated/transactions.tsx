import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DeleteAction } from "@/shared/components/DeleteAction";
import { deleteTransaction, listTransactions } from "@/features/transactions/functions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/shared/categories";
import { formatMoney } from "@/shared/money";
import { invalidateMoney, qk } from "@/shared/queries";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { Input } from "@/components/ui/input";
import { PageError } from "@/shared/components/NavigationStatus";
import { requireSavedData } from "@/shared/query-loading";
import { Button } from "@/components/ui/button";

const ALL_CATS = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

export const Route = createFileRoute("/_authenticated/transactions")({
  validateSearch: (search: Record<string, unknown>): { tag?: string; from?: string; to?: string } => ({ tag: typeof search["tag"] === "string" ? search["tag"] : "", from: typeof search["from"] === "string" ? search["from"] : "", to: typeof search["to"] === "string" ? search["to"] : "" }),
  head: () => ({ meta: [{ title: "Transactions — Artha" }, { name: "description", content: "Full history of your income and spending." }, { property: "og:title", content: "Transactions — Artha" }, { property: "og:description", content: "Full history of your income and spending." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Transactions,
  loader: ({ context }) => { requireSavedData(context.queryClient, qk.transactions({})); return context.queryClient.ensureQueryData({ queryKey: qk.transactions({}), queryFn: () => listTransactions({ data: {} }) }); },
  errorComponent: PageError,
  notFoundComponent: PageError,
});

function Transactions() {
  const search = Route.useSearch();
  const [f, setF] = useState<{ kind?: "income" | "expense" | "transfer_in" | "transfer_out" | undefined; category?: string | undefined; search?: string; from?: string; to?: string; tag?: string }>({ tag: search.tag ?? "", from: search.from ?? "", to: search.to ?? "" });
  const qc = useQueryClient();
  const { data = [], isFetching, fetchStatus } = useQuery({
    queryKey: qk.transactions(f),
    queryFn: () => listTransactions({ data: { ...f, search: f.search || undefined, from: f.from || null, to: f.to || null } }),
    placeholderData: (p) => p,
  });

  return (
    <>
      <PageHeader title="Transactions" subtitle={`${data.length} entries${isFetching ? " · updating…" : ""}`} />
      {fetchStatus === "paused" && <p role="status" className="mb-4 text-sm text-warning">Offline · filters cannot refresh. Showing the last saved results for this view.</p>}
      <Panel className="mb-4 grid gap-3 md:grid-cols-5">
        <label className="grid gap-2 text-sm">Search<Input aria-label="Search notes" placeholder="Search notes" value={f.search ?? ""} onChange={(e) => setF({ ...f, search: e.target.value })} /></label>
        <label className="grid gap-2 text-sm">Type<select aria-label="Transaction type" className="h-9 rounded-md border bg-background px-2 text-sm" value={f.kind ?? ""}
          onChange={(e) => setF({ ...f, kind: (e.target.value || undefined) as typeof f.kind })}>
          <option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer_in">Transfers in</option><option value="transfer_out">Transfers out</option>
        </select></label>
        <label className="grid gap-2 text-sm">Category<select aria-label="Category" className="h-9 rounded-md border bg-background px-2 text-sm" value={f.category ?? ""}
          onChange={(e) => setF({ ...f, category: e.target.value || undefined })}>
          <option value="">All categories</option>{ALL_CATS.map((c) => <option key={c}>{c}</option>)}
        </select></label>
        <label className="grid gap-2 text-sm">From<Input type="date" value={f.from ?? ""} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From" /></label>
        <label className="grid gap-2 text-sm">To<Input type="date" value={f.to ?? ""} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To" /></label>
      </Panel>
      <label className="mb-5 grid max-w-sm gap-2 text-sm">Tag<Input aria-label="Filter by tag" placeholder="hospital" value={f.tag ?? ""} onChange={e => setF({ ...f, tag: e.target.value })} /></label>
      {f.tag && <div className="mb-5 border-y py-4"><h2 className="font-semibold">#{f.tag.replace(/^#/, "")} · recorded expenses</h2>{[...new Set(data.filter(t => t.kind === "expense").map(t => t.currency))].map(currency => <p key={currency} className="num mt-2">{formatMoney(data.filter(t => t.kind === "expense" && t.currency === currency).reduce((s, t) => s + t.amountMinor, 0), currency)}</p>)}<div className="mt-4 flex flex-wrap gap-4">{[...new Set(data.filter(t => t.kind === "expense").map(t => `${t.occurredOn.slice(0, 7)} · ${t.currency}`))].sort().map(key => { const [month, currency] = key.split(" · "); if (!currency || !month) return null; return <p key={key} className="text-sm">{month} · {formatMoney(data.filter(t => t.kind === "expense" && t.currency === currency && t.occurredOn.startsWith(month)).reduce((s,t) => s + t.amountMinor, 0), currency)}</p>; })}</div></div>}
      <Panel className="p-0">
        {data.length === 0 ? <p className="p-8 text-center text-muted-foreground">No transactions match.</p> : (
          <ul className="divide-y">
            {data.map((t) => (
              <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-x-3 gap-y-1 py-4 sm:grid-cols-[100px_minmax(0,1fr)_auto_44px]">
                <span className="num col-span-3 text-xs text-muted-foreground sm:col-span-1">{t.occurredOn}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.category}</p>
                  <p className="truncate text-xs text-muted-foreground">{[t.note, t.accountName].filter(Boolean).join(" · ")}</p>
                  <div className="mt-1 flex flex-wrap gap-2">{t.tags.map(tag => <Button key={tag} size="sm" variant="link" className="h-auto px-0 text-xs" onClick={() => setF({ ...f, tag })}>#{tag}</Button>)}</div>
                </div>
                <span className={`num font-semibold ${t.transferId ? "text-muted-foreground" : t.kind === "income" ? "text-income" : "text-expense"}`}>
                  {t.kind === "income" || t.kind === "transfer_in" ? "+" : "−"}{formatMoney(t.amountMinor, t.currency)}{t.transferId ? " · Transfer" : ""}
                </span>
                <DeleteAction label={`${t.category} transaction`} description={t.transferId ? "Both sides of this internal transfer will be removed together." : `${formatMoney(t.amountMinor, t.currency)} on ${t.occurredOn} will be permanently removed.`} onConfirm={async () => { await deleteTransaction({ data: { id: t.id } }); await invalidateMoney(qc); }} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
