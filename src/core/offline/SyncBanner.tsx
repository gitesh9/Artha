import { Link } from "@tanstack/react-router";
import { CheckCheck, CloudUpload, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOffline } from "./OfflineProvider";

export function SyncBanner() {
  const { online, ready, entries, syncing, lastSyncedAt, error, storageError, sync } = useOffline();
  const Icon = !online ? WifiOff : entries.length ? CloudUpload : CheckCheck;
  const status = !ready ? "Checking connection…" : !online ? "Offline · saved on this device" : syncing ? "Online · syncing local entries…" : entries.length ? `Online · ${entries.length} entries saved locally only` : "Online · no unsynced entries";
  return <section aria-label="Connection and sync" className={`w-full border-t px-4 py-3 md:px-8 ${!online || error ? "bg-muted" : "bg-background"}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1"><p role="status" className={`flex items-center gap-2 text-sm font-semibold ${!online || error ? "text-warning" : "text-income"}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{status}</p>
        <p className="mt-1 text-xs text-muted-foreground">Last expense synced online: {lastSyncedAt ? <time dateTime={new Date(lastSyncedAt).toISOString()}>{new Date(lastSyncedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</time> : "No recorded sync on this device"}</p>
      </div>
      <div className="flex flex-wrap gap-2">{entries.length > 0 && <Button variant="outline" size="sm" disabled={!ready || !online || syncing} onClick={() => void sync()}><RefreshCw aria-hidden="true" />Retry sync</Button>}<Button variant="ghost" size="sm" asChild><Link to="/sync-history">Sync history</Link></Button></div>
    </div>
    {(!online || entries.length > 0) && <p className="mt-2 text-xs text-muted-foreground">Unsynced entries are not included in reports. Sync resumes when this app is open and connected.</p>}
    {(storageError || error) && <p role="alert" className="mt-2 text-xs text-warning">{storageError ? "Device storage is unavailable; local saving cannot be guaranteed." : error}</p>}
  </section>;
}