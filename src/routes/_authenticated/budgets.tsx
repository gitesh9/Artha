import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { DeleteAction } from "@/shared/components/DeleteAction";
import { toast } from "sonner";
import { deleteBudget, listBudgets, saveBudget } from "@/features/budgets/functions";
import { EXPENSE_CATEGORIES } from "@/shared/categories";
import { formatMoney } from "@/shared/money";
import { qk } from "@/shared/queries";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOffline } from "@/core/offline/OfflineProvider";
import { PageError } from "@/shared/components/NavigationStatus";
import { requireSavedData } from "@/shared/query-loading";
import { useDraft } from "@/shared/components/DraftProvider";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — Artha" }, { name: "description", content: "Monthly limits per category with overspend warnings." }, { property: "og:title", content: "Budgets — Artha" }, { property: "og:description", content: "Monthly limits per category with overspend warnings." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Budgets,
  loader: ({ context }) => { requireSavedData(context.queryClient, qk.budgets); return context.queryClient.ensureQueryData({ queryKey: qk.budgets, queryFn: () => listBudgets() }); },
  errorComponent: PageError,
  notFoundComponent: PageError,
});

const TONE = { ok: "bg-income", warning: "bg-warning", over: "bg-expense" } as const;

function Budgets() {
  const { draft, setDraft } = useDraft();
  const qc = useQueryClient();
  const { online } = useOffline();
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<string>(draft?.target === "budgets" && EXPENSE_CATEGORIES.some(c => c === draft.draft.category) ? draft.draft.category ?? EXPENSE_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  const { data } = useQuery({ queryKey: qk.budgets, queryFn: () => listBudgets() });
  const refresh = () => qc.invalidateQueries({ queryKey: qk.budgets });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const limit = Number(new FormData(form).get("limit"));
    if (!online || busy) return;
    setBusy(true);
    try { await saveBudget({ data: { category, limit } }); await refresh(); setDraft(null); toast.success("Budget saved"); form.reset(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not save"); }
    finally { setBusy(false); }
  }
  const cur = data?.baseCurrency ?? "INR";

  return (
    <>
      <PageHeader title="Budgets" subtitle="This month's spending against your limits" />
      <Panel className="mb-4">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2 text-sm">Category<select className="h-9 rounded-md border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select></label>
          <label className="grid w-full gap-2 text-sm sm:w-48">Monthly limit ({cur})<Input name="limit" type="number" min="1" step="1" required placeholder="0" defaultValue={draft?.target === "budgets" ? draft.draft.amount : undefined} /></label>
          <Button disabled={!online || busy}>{busy ? "Saving…" : "Set budget"}</Button>
        </form>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        {data?.budgets.length === 0 && <p className="text-muted-foreground">No budgets yet.</p>}
        {data?.budgets.map((b) => {
          const pct = Math.min(100, (b.spentMinor / b.limitMinor) * 100);
          return (
            <Panel card key={b.id}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{b.category}</h2>
                <DeleteAction label={`${b.category} budget`} description="This removes the monthly limit, not your transactions." onConfirm={async () => { await deleteBudget({ data: { id: b.id } }); await refresh(); }} />
              </div>
              <p className="num mt-1 text-sm text-muted-foreground">{formatMoney(b.spentMinor, cur)} of {formatMoney(b.limitMinor, cur)}</p>
              <div role="progressbar" aria-label={`${b.category} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={`${formatMoney(b.spentMinor, cur)} spent of ${formatMoney(b.limitMinor, cur)}`} className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${TONE[b.status]}`} style={{ width: `${pct}%` }} />
              </div>
              {b.status !== "ok" && (
                <p className="mt-2 text-sm font-medium text-expense">
                  {b.status === "over" ? `Over by ${formatMoney(b.spentMinor - b.limitMinor, cur)}` : "Close to the limit"}
                </p>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
