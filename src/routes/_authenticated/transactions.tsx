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

const ALL_CATS = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Artha" }, { name: "description", content: "Full history of your income and spending." }, { property: "og:title", content: "Transactions — Artha" }, { property: "og:description", content: "Full history of your income and spending." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Transactions,
  loader: ({ context }) => { requireSavedData(context.queryClient, qk.transactions({})); return context.queryClient.ensureQueryData({ queryKey: qk.transactions({}), queryFn: () => listTransactions({ data: {} }) }); },
  errorComponent: PageError,
  notFoundComponent: PageError,
});

function Transactions() {
  const [f, setF] = useState<{ kind?: "income" | "expense" | undefined; category?: string | undefined; search?: string; from?: string; to?: string }>({});
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
          onChange={(e) => setF({ ...f, kind: (e.target.value || undefined) as "income" | "expense" | undefined })}>
          <option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option>
        </select></label>
        <label className="grid gap-2 text-sm">Category<select aria-label="Category" className="h-9 rounded-md border bg-background px-2 text-sm" value={f.category ?? ""}
          onChange={(e) => setF({ ...f, category: e.target.value || undefined })}>
          <option value="">All categories</option>{ALL_CATS.map((c) => <option key={c}>{c}</option>)}
        </select></label>
        <label className="grid gap-2 text-sm">From<Input type="date" value={f.from ?? ""} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From" /></label>
        <label className="grid gap-2 text-sm">To<Input type="date" value={f.to ?? ""} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To" /></label>
      </Panel>
      <Panel className="p-0">
        {data.length === 0 ? <p className="p-8 text-center text-muted-foreground">No transactions match.</p> : (
          <ul className="divide-y">
            {data.map((t) => (
              <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-x-3 gap-y-1 py-4 sm:grid-cols-[100px_minmax(0,1fr)_auto_44px]">
                <span className="num col-span-3 text-xs text-muted-foreground sm:col-span-1">{t.occurredOn}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.category}</p>
                  <p className="truncate text-xs text-muted-foreground">{[t.note, t.accountName].filter(Boolean).join(" · ")}</p>
                </div>
                <span className={`num font-semibold ${t.kind === "income" ? "text-income" : "text-expense"}`}>
                  {t.kind === "income" ? "+" : "−"}{formatMoney(t.amountMinor, t.currency)}
                </span>
                <DeleteAction label={`${t.category} transaction`} description={`${formatMoney(t.amountMinor, t.currency)} on ${t.occurredOn} will be permanently removed.`} onConfirm={async () => { await deleteTransaction({ data: { id: t.id } }); await invalidateMoney(qc); }} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
