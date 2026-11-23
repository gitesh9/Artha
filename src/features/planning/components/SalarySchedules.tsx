import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/shared/components/PageHeader";
import { formatMoney, fromMinor } from "@/shared/money";
import { toISODate } from "@/shared/dates";
import { invalidateMoney } from "@/shared/queries";
import { enqueueEntry } from "@/core/offline/storage";
import { useOffline } from "@/core/offline/OfflineProvider";
import { finishSalary } from "../functions";
import { RecordEditor } from "./RecordEditor";
import type { FinancialRecord } from "../schema";
import { toast } from "sonner";
export function SalarySchedules({ records, userId }: { records: FinancialRecord[]; userId: string }) {
  const { records: journal, online } = useOffline(), finish = useServerFn(finishSalary), qc = useQueryClient();
  const [date,setDate] = useState(toISODate(new Date())), [busy,setBusy] = useState(false);
  return <><Panel><h2 className="text-xl font-semibold">Salary credits</h2><p className="mt-2 text-sm text-muted-foreground">Scheduled amounts are expected income, not a bank credit. Confirm when received; balances never change at month-end without a recorded entry.</p><label className="mt-4 grid max-w-sm gap-2 text-sm">Actual credit date<Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>{records.filter(r => r.kind === "salary").map(r => { const p=r.payload, entry=journal.find(e => e.data.clientId === r.id); return <div key={r.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t py-4"><div><h3 className="font-medium">{p.name} · {formatMoney(p.amountMinor,p.currency)}</h3><p className="mt-1 text-sm text-muted-foreground">Expected {p.date} · {p.paid ? "Received" : entry ? entry.status : "Not received"}</p></div>{!p.paid && (!entry ? <Button disabled={!p.accountId || busy || !date} onClick={async () => { if (!p.accountId) return; setBusy(true); try { await enqueueEntry(userId,{ data:{ clientId:r.id,accountId:p.accountId,kind:"income",category:"Salary",amount:fromMinor(p.amountMinor,p.currency),occurredOn:date,note:p.name },currency:p.currency,createdAt:Date.now() }); toast.success("Credit saved locally. Review cash reserves once it syncs."); } catch { toast.error("Could not save salary credit. Schedule retained."); } finally { setBusy(false); } }}>Confirm salary received</Button> : entry.status === "completed" ? <Button disabled={!online || busy} onClick={async () => { setBusy(true); try { await finish({data:{id:r.id}}); await invalidateMoney(qc); } catch { toast.error("Retry scheduling next month; credit is retained."); } finally { setBusy(false); } }}>Schedule next salary</Button> : null)}</div>; })}</Panel><RecordEditor kind="salary" title="Recurring salary schedule" subtypes={["monthly"]} /></>;
}