import { createFileRoute } from "@tanstack/react-router";
import { useOffline } from "@/core/offline/OfflineProvider";
import { PageHeader } from "@/shared/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, CircleAlert, RefreshCw } from "lucide-react";
import { formatMoney, toMinor } from "@/shared/money";
import { useState } from "react";
import { ConflictAssistant } from "@/features/sync-assistant/components/ConflictAssistant";

export const Route = createFileRoute("/_authenticated/sync-history")({
  validateSearch: (search: Record<string, unknown>): { status?: "pending" | "completed" | "failed" } => {
    const status = search["status"];
    return status === "pending" || status === "completed" || status === "failed" ? { status } : {};
  },
  head: () => ({ meta: [{ title: "Sync history — Artha" }, { name: "description", content: "Track local expense saves, confirmed online syncs and failed attempts." }, { property: "og:title", content: "Sync history — Artha" }, { property: "og:description", content: "Review expense sync timestamps and safely retry unsynced entries." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SyncHistory,
});
function Timestamp({ value }: { value: number }) { return <time dateTime={new Date(value).toISOString()}>{new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</time>; }
function SyncHistory() {
  const { records, online, syncing, ready, sync } = useOffline();
  const { status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [localVersion, setLocalVersion] = useState("");
  const visible = records.filter((r) => !status || r.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
  return <>
    <PageHeader title="Sync history" subtitle="Expense saves and sync attempts on this device" actions={<Button variant="outline" disabled={!ready || !online || syncing || !records.some((r) => r.status !== "completed")} onClick={() => void sync()}><RefreshCw aria-hidden="true" />{syncing ? "Syncing…" : "Retry all"}</Button>} />
    <div role="group" aria-label="Sync status filter" className="mb-6 flex flex-wrap gap-2">{([undefined, "pending", "completed", "failed"] as const).map((value) => <Button key={value ?? "all"} variant={status === value ? "secondary" : "ghost"} aria-pressed={status === value} onClick={() => void navigate({ search: value ? { status: value } : {} })}>{value ? value[0]?.toUpperCase() + value.slice(1) : "All"} <span className="num text-muted-foreground">{records.filter((r) => !value || r.status === value).length}</span></Button>)}</div>
    <ul className="divide-y border-y">{visible.map((record) => {
      const Icon = record.status === "completed" ? CheckCircle2 : record.status === "failed" ? CircleAlert : Clock3;
      const tone = record.status === "completed" ? "text-income" : record.status === "failed" ? "text-expense" : "text-warning";
      return <li key={record.data.clientId} className="grid min-w-0 gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-4 gap-y-2"><h2 className="font-semibold">{record.data.category} · {formatMoney(toMinor(record.data.amount, record.currency), record.currency)}</h2><span className={`flex items-center gap-2 text-sm font-medium ${tone}`}><Icon aria-hidden="true" className="h-4 w-4" />{record.status === "completed" ? "Completed · confirmed online" : record.status === "failed" ? "Failed · local copy retained" : "Pending · saved locally"}</span></div>
          {record.data.note && <p className="mt-1 break-words text-sm text-muted-foreground">{record.data.note}</p>}
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2"><div><dt>Saved locally</dt><dd className="mt-1"><Timestamp value={record.createdAt} /></dd></div><div><dt>{record.status === "completed" ? "Confirmed online" : "Last updated"}</dt><dd className="mt-1"><Timestamp value={record.completedAt ?? record.updatedAt} /></dd></div>{record.attemptedAt && <div><dt>Last attempt ({record.attempts} total)</dt><dd className="mt-1"><Timestamp value={record.attemptedAt} /></dd></div>}<div><dt>Expense date</dt><dd className="mt-1">{record.data.occurredOn} · {record.data.kind}</dd></div></dl>
          {record.error && record.status !== "completed" && <p className="mt-3 text-sm text-expense">{record.error}</p>}
        </div>
        {record.status !== "completed" && <div className="flex flex-wrap gap-2 self-start"><Button variant="outline" disabled={!online || syncing} aria-label={`Retry ${record.data.category} sync`} onClick={() => void sync(record.data.clientId)}><RefreshCw aria-hidden="true" />Retry</Button><Button variant="ghost" onClick={() => { setLocalVersion(`${record.data.kind}: ${record.data.amount} ${record.currency}; category: ${record.data.category}; date: ${record.data.occurredOn}; note: ${record.data.note || "none"}`); document.getElementById("conflict-local")?.focus(); }}>Review versions</Button></div>}
      </li>;
    })}</ul>
    {visible.length === 0 && <p role="status" className="py-12 text-center text-muted-foreground">{ready ? "No expense syncs in this view yet." : "Loading sync history…"}</p>}
    <ConflictAssistant localVersion={localVersion} onLocalChange={setLocalVersion} />
  </>;
}