import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowDownLeft, ArrowUpRight, Percent, Wallet } from "lucide-react";
import { useState, useTransition } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboard } from "@/features/analytics/functions";
import { RANGES, type RangeKey } from "@/shared/dates";
import { formatMoney, fromMinor, minorFactor } from "@/shared/money";
import { qk } from "@/shared/queries";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { PageError } from "@/shared/components/NavigationStatus";
import { requireSavedData } from "@/shared/query-loading";
import { useOffline } from "@/core/offline/OfflineProvider";

const dashQuery = (range: RangeKey) =>
  queryOptions({ queryKey: qk.dashboard(range), queryFn: () => getDashboard({ data: { range } }) });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Overview — Artha" }, { name: "description", content: "Your money flow at a glance." }, { property: "og:title", content: "Overview — Artha" }, { property: "og:description", content: "Your money flow at a glance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => { requireSavedData(context.queryClient, qk.dashboard("1M")); return context.queryClient.ensureQueryData(dashQuery("1M")); },
  errorComponent: PageError,
  notFoundComponent: PageError,
  component: Dashboard,
});

function Dashboard() {
  const { online } = useOffline();
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("1M");
  const [isPending, startTransition] = useTransition();
  const { data, isFetching } = useSuspenseQuery(dashQuery(range));
  const cur = data.baseCurrency;
  const fmt = (m: number) => formatMoney(m, cur);
  const trend = data.trend.map((d) => ({ ...d, income: fromMinor(d.income, cur), expense: fromMinor(d.expense, cur) }));
  const top = data.byCategory[0];
  const tips: string[] = [];
  if (data.income > 0 && data.savingsRate < 0.2) tips.push(`You're saving ${(data.savingsRate * 100).toFixed(0)}% of income. Aim for at least 20% (the 50/30/20 rule).`);
  if (data.income > 0 && data.savingsRate >= 0.2) tips.push(`Great — you're saving ${(data.savingsRate * 100).toFixed(0)}% of income. Consider moving the surplus into an emergency fund, then SIPs.`);
  if (top && data.expense > 0 && top.amount / data.expense > 0.35) tips.push(`${top.category} is ${((top.amount / data.expense) * 100).toFixed(0)}% of your spending — the first place to look for cuts.`);
  if (data.income === 0 && data.expense > 0) tips.push("Log your income too, so savings rate and advice become accurate.");

  return (
    <>
      <PageHeader title="Overview" subtitle={`All amounts in ${cur}${isFetching || isPending ? " · Updating…" : ""}`}
        actions={
          <div role="group" aria-label="Report period" className="flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <Button disabled={!online && qc.getQueryData(qk.dashboard(r)) === undefined} title={!online && qc.getQueryData(qk.dashboard(r)) === undefined ? "Reconnect to load this period" : undefined} variant={range === r ? "secondary" : "ghost"} aria-pressed={range === r} size="sm" key={r} onClick={() => startTransition(() => setRange(r))}
                className={`num rounded-md px-3 py-1 text-xs ${range === r ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{r}</Button>
            ))}
          </div>
        } />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={ArrowDownLeft} label="Income" value={fmt(data.income)} tone="text-income" />
        <Stat icon={ArrowUpRight} label="Spent" value={fmt(data.expense)} tone="text-expense" />
        <Stat icon={Wallet} label="Net saved" value={fmt(data.net)} tone={data.net >= 0 ? "text-income" : "text-expense"} />
        <Stat icon={Percent} label="Savings rate" value={`${(data.savingsRate * 100).toFixed(1)}%`} tone="text-foreground" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Money flow by {data.trendUnit}</h2>
          <div className="mt-3 flex gap-5 text-xs"><span className="flex items-center gap-2 text-income"><span aria-hidden="true" className="w-5 border-t-2 border-income" />Income</span><span className="flex items-center gap-2 text-expense"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-expense" />Expenses</span></div>
          <div className="mt-4 h-64">
            {trend.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <AreaChart accessibilityLayer data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(value: number) => formatMoney(Math.round(value * minorFactor(cur)), cur)} />
                  <Area name="Income" isAnimationActive={false} dataKey="income" stroke="var(--income)" fill="var(--income)" fillOpacity={0.15} />
                  <Area name="Expenses" isAnimationActive={false} strokeDasharray="5 4" dataKey="expense" stroke="var(--expense)" fill="var(--expense)" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">Suggestions</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {tips.length === 0 ? <li className="text-muted-foreground">Log a few entries to get suggestions.</li> :
              tips.map((t) => <li key={t} className="border-l-2 border-accent pl-3">{t}</li>)}
          </ul>
        </Panel>
      </div>
      <Panel className="mt-4">
        <h2 className="text-lg font-semibold">Where your money went</h2>
        <div className="mt-4 h-72">
          {data.byCategory.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <BarChart accessibilityLayer data={data.byCategory.map((c) => ({ ...c, amount: fromMinor(c.amount, cur) }))} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(value: number) => formatMoney(Math.round(value * minorFactor(cur)), cur)} />
                <Bar name="Expenses" isAnimationActive={false} dataKey="amount" fill="var(--primary)" radius={[0, 6, 6, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
      <details className="mt-4 border-t py-4">
        <summary className="flex items-center text-sm font-medium">Report data</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm"><caption className="sr-only">Money flow in {cur}</caption><thead><tr><th scope="col" className="py-3">Period</th><th scope="col">Income</th><th scope="col">Expenses</th></tr></thead><tbody>{data.trend.map((d) => <tr key={d.date} className="border-t"><th scope="row" className="py-3 font-normal">{d.date}</th><td className="num">{fmt(d.income)}</td><td className="num">{fmt(d.expense)}</td></tr>)}</tbody></table>
          <table className="mt-6 w-full text-left text-sm"><caption className="sr-only">Expenses by category in {cur}</caption><thead><tr><th scope="col" className="py-3">Category</th><th scope="col">Expenses</th></tr></thead><tbody>{data.byCategory.map((c) => <tr key={c.category} className="border-t"><th scope="row" className="py-3 font-normal">{c.category}</th><td className="num">{fmt(c.amount)}</td></tr>)}</tbody></table>
        </div>
      </details>
    </>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon: typeof Wallet }) {
  return (
    <Panel card>
      <div className="flex items-center justify-between text-muted-foreground"><p className="text-sm">{label}</p><Icon aria-hidden="true" className="h-4 w-4" /></div>
      <p className={`num mt-4 break-words text-2xl font-semibold ${tone}`}>{value}</p>
    </Panel>
  );
}
function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No entries in this period yet.</div>;
}
