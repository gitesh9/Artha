import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { planningQuery } from "../planning/queries";
import { payloadSchema } from "../planning/schema";
import { savePlanning, removePlanning } from "../planning/functions";
import { insightsInput } from "./functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toISODate } from "@/shared/dates";
import { useOffline } from "@/core/offline/OfflineProvider";
import { toast } from "sonner";
type Filter = { from: string; to: string; compareFrom: string; compareTo: string; accountId: string; category: string };
export function ComparisonBookmarks({ filter, select }: { filter: Filter; select: (filter: Filter) => void }) { const { data } = useSuspenseQuery(planningQuery), qc = useQueryClient(), save = useServerFn(savePlanning), remove = useServerFn(removePlanning), { online } = useOffline(); const [name, setName] = useState("Spending comparison"), [busy, setBusy] = useState(false);
 return <div className="mb-5 border-b pb-5"><div className="flex flex-wrap items-end gap-3"><label className="grid gap-2 text-sm">Comparison name<Input value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label><Button variant="outline" disabled={!online || busy} onClick={async () => { setBusy(true); try { await save({ data: { id: crypto.randomUUID(), kind: "comparison", payload: payloadSchema.parse({ name, currency: "INR", amountMinor: 0, date: toISODate(new Date()), inputs: filter }) } }); await qc.invalidateQueries({ queryKey: planningQuery.queryKey }); toast.success("Comparison saved"); } catch { toast.error("Comparison could not save. Selected dates remain here."); } finally { setBusy(false); } }}>Save selected comparison</Button></div><div className="mt-3 flex flex-wrap gap-2">{data.filter(r => r.kind === "comparison").map(r => <div key={r.id} className="flex gap-1"><Button variant="ghost" onClick={() => { const parsed = insightsInput.safeParse(r.payload.inputs); if (parsed.success) select(parsed.data); else toast.error("Saved comparison no longer has valid dates."); }}>{r.payload.name}</Button><Button variant="ghost" size="icon" aria-label={`Remove ${r.payload.name} comparison`} disabled={!online || busy} onClick={async () => { await remove({ data: { id: r.id } }); await qc.invalidateQueries({ queryKey: planningQuery.queryKey }); }}>×</Button></div>)}</div></div>;
}