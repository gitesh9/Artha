import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendar } from "@/features/analytics/functions";
import { listTransactions } from "@/features/transactions/functions";
import { formatMoney } from "@/shared/money";
import { qk } from "@/shared/queries";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { Button } from "@/components/ui/button";
import { PageError } from "@/shared/components/NavigationStatus";
import { requireSavedData } from "@/shared/query-loading";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Artha" }, { name: "description", content: "Daily spending on a calendar." }, { property: "og:title", content: "Calendar — Artha" }, { property: "og:description", content: "Daily spending on a calendar." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: CalendarPage,
  loader: ({ context }) => { const now = new Date(); const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; requireSavedData(context.queryClient, qk.calendar(month)); return context.queryClient.ensureQueryData({ queryKey: qk.calendar(month), queryFn: () => getCalendar({ data: { month } }) }); },
  errorComponent: PageError,
  notFoundComponent: PageError,
});

const pad = (n: number) => String(n).padStart(2, "0");

function CalendarPage() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [day, setDay] = useState<string | null>(null);
  const month = `${ym.y}-${pad(ym.m + 1)}`;
  const { data, isPlaceholderData, fetchStatus } = useQuery({ queryKey: qk.calendar(month), queryFn: () => getCalendar({ data: { month } }), placeholderData: (p) => p });
  const dayTx = useQuery({
    queryKey: qk.transactions({ day }),
    queryFn: () => listTransactions({ data: { from: day, to: day } }),
    enabled: !!day,
  });
  const days = new Map((data?.byDay ?? []).map((d) => [d.date, d]));
  const max = Math.max(1, ...[...days.values()].map((d) => d.expense));
  const first = new Date(ym.y, ym.m, 1).getDay();
  const count = new Date(ym.y, ym.m + 1, 0).getDate();
  const shift = (d: number) => { const n = new Date(ym.y, ym.m + d, 1); setYm({ y: n.getFullYear(), m: n.getMonth() }); setDay(null); };
  const cur = data?.baseCurrency ?? "INR";

  return (
    <>
      <PageHeader title="Calendar"
        subtitle={isPlaceholderData ? "This month is not loaded yet" : data ? `Spent ${formatMoney(data.expense, cur)} this month` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="w-36 text-center font-display text-lg">{new Date(ym.y, ym.m).toLocaleString("en-IN", { month: "long", year: "numeric" })}</span>
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        } />
      {fetchStatus === "paused" && isPlaceholderData && <p role="status" className="mb-4 text-sm text-warning">No saved report for this month. Reconnect to load it.</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: count }).map((_, i) => {
              const date = `${month}-${pad(i + 1)}`;
              const v = days.get(date);
              const intensity = v ? Math.max(0.12, v.expense / max) : 0;
              return (
                <Button variant="ghost" aria-label={`${date}: spent ${formatMoney(v?.expense ?? 0, cur)}`} aria-pressed={day === date} key={date} onClick={() => setDay(date)}
                  className={`relative flex h-auto min-h-14 min-w-0 flex-col items-start justify-start whitespace-normal rounded-md border px-1 pb-3 pt-1 text-left sm:aspect-square sm:p-2 transition hover:border-primary ${day === date ? "ring-2 ring-primary" : ""}`}>
                  <span aria-hidden="true" className={`absolute inset-x-1 bottom-1 h-1 rounded-full ${intensity > 0.65 ? "bg-expense" : intensity > 0 ? "bg-warning" : "bg-muted"}`} />
                  <span className="relative text-xs font-medium">{i + 1}</span>
                  {v && v.expense > 0 && (
                    <span className="num relative mt-1 block max-w-full text-[9px] sm:text-xs">{formatMoney(v.expense, cur, { compact: true })}</span>
                  )}
                </Button>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">{day ?? "Pick a day"}</h2>
          <ul className="mt-3 divide-y text-sm">
            {day && dayTx.isPending && <li role="status" className="py-2 text-muted-foreground">{dayTx.fetchStatus === "paused" ? "No saved entries for this day. Reconnect to load them." : "Loading entries…"}</li>}
            {day && dayTx.data?.length === 0 && <li className="py-2 text-muted-foreground">Nothing logged.</li>}
            {dayTx.data?.map((t) => (
              <li key={t.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>{t.category}{t.note ? ` · ${t.note}` : ""}</span>
                <span className={`num ${t.kind === "income" ? "text-income" : "text-expense"}`}>{t.kind === "income" ? "+" : "−"}{formatMoney(t.amountMinor, t.currency)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
