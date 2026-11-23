import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { planningQuery, cashflowQuery } from "@/features/planning/queries";
import { RecordEditor } from "@/features/planning/components/RecordEditor";
import { savePlanning } from "@/features/planning/functions";
import { recurringCandidates, nextBillDate } from "@/features/planning/service";
import { listTransactions } from "@/features/transactions/functions";
import { listAccounts } from "@/features/accounts/functions";
import { BillPayment } from "@/features/planning/components/BillPayment";
import { SalarySchedules } from "@/features/planning/components/SalarySchedules";
import { CashflowAdvice } from "@/features/planning/components/CashflowAdvice";
import { useOffline } from "@/core/offline/OfflineProvider";
import { PageHeader, Panel } from "@/shared/components/PageHeader";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/shared/money";
import { financialHead, loadPlanning } from "@/shared/financial-page";
import { PageError } from "@/shared/components/NavigationStatus";
import { requireSavedData } from "@/shared/query-loading";
import { toast } from "sonner";
import { payloadSchema } from "@/features/planning/schema";
const tq = { queryKey: ["money", "bill-patterns"], queryFn: () => listTransactions({ data: {} }) }, aq = { queryKey: ["accounts"], queryFn: () => listAccounts() };
export const Route = createFileRoute("/_authenticated/bills")({ head: () => financialHead("Bills and EMIs", "Due dates, recurring candidates and confirmed payment records."), loader: async ({ context }) => { requireSavedData(context.queryClient, tq.queryKey); requireSavedData(context.queryClient, aq.queryKey); requireSavedData(context.queryClient, cashflowQuery.queryKey); await Promise.all([context.queryClient.ensureQueryData(cashflowQuery),loadPlanning(context.queryClient), context.queryClient.ensureQueryData(tq), context.queryClient.ensureQueryData(aq)]); }, errorComponent: PageError, component: Bills });
function Bills() {
  const { data: records } = useSuspenseQuery(planningQuery), { data: txs } = useSuspenseQuery(tq), { data: accounts } = useSuspenseQuery(aq);
  const { user } = Route.useRouteContext(), { online } = useOffline(), qc = useQueryClient(), save = useServerFn(savePlanning);
  const [busy, setBusy] = useState(false), bills = records.filter(r => r.kind === "bill");
  return <><PageHeader title="Bills, EMIs & salary" subtitle="Expected payments and income · nothing is charged automatically" />
    <CashflowAdvice />
    <Panel><h2 className="text-xl font-semibold">Payment schedule</h2>{bills.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No bills scheduled.</p>}{bills.map(b => <BillPayment key={b.id} bill={b} accounts={accounts} userId={user.id} />)}</Panel>
    <RecordEditor kind="bill" title="Bills and installments" subtypes={["other", "monthly", "annual", "emi", "sip"]} />
    <SalarySchedules records={records} userId={user.id} />
    <Panel><h2 className="text-xl font-semibold">Possible subscriptions</h2><p className="mt-2 text-sm text-muted-foreground">Same note and amount at least three times, 25–35 days apart. Review before adding a bill.</p>{recurringCandidates(txs).map((t,i) => <div key={i} className="mt-3 border-t py-3"><p>{t.note} · {formatMoney(t.amountMinor,t.currency)}</p><Button className="mt-3" variant="outline" disabled={!online || busy || bills.some(b => b.payload.name === t.note && !b.payload.paid)} onClick={async () => { setBusy(true); try { await save({data:{id:crypto.randomUUID(),kind:"bill",payload:payloadSchema.parse({name:t.note,currency:t.currency,amountMinor:t.amountMinor,date:nextBillDate(t.occurredOn,1),accountId:t.accountId,category:t.category,subtype:"monthly",note:"Accepted recurring pattern"})}}); await qc.invalidateQueries({queryKey:planningQuery.queryKey}); } catch { toast.error("Bill was not saved. Retry without changing expenses."); } finally { setBusy(false); } }}>Accept as monthly bill</Button></div>)}</Panel>
  </>;
}
