import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { planningQuery } from "@/features/planning/queries";
import { RecordEditor } from "@/features/planning/components/RecordEditor";
import { splitBalances } from "@/features/planning/service";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { formatMoney, CURRENCIES } from "@/shared/money";
import { financialHead, loadPlanning } from "@/shared/financial-page";
import { PageError } from "@/shared/components/NavigationStatus";
export const Route = createFileRoute("/_authenticated/splits")({ head: () => financialHead("Split expenses", "Private expense shares and settlements with exact balances."), loader: ({ context }) => loadPlanning(context.queryClient), errorComponent: PageError, component: Splits });
function Splits() { const { data: records } = useSuspenseQuery(planningQuery); const [currency, setCurrency] = useState("INR"); const balances = splitBalances(records, currency); return <><PageHeader title="Split expenses" subtitle="Equal shares · exact minor-unit allocation" /><p className="mb-5 text-sm text-muted-foreground">This is your private ledger. Names do not grant anyone access or notify them. Positive balance means the person should receive money; negative means they owe. No payments are sent.</p><Panel><label className="grid max-w-xs gap-2 text-sm">Balance currency<select className="min-h-11 rounded-md border bg-background px-3" value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label><ul className="mt-5 divide-y">{balances.map(b => <li key={b.person} className="flex justify-between gap-3 py-3"><span>{b.person}</span><span className="num">{formatMoney(b.amountMinor, currency)} · {b.amountMinor > 0 ? "Receives" : b.amountMinor < 0 ? "Owes" : "Settled"}</span></li>)}</ul></Panel><RecordEditor kind="split" title="Shared costs" /><RecordEditor kind="settlement" title="Settlements" /></>; }