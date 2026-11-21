import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createTransaction } from "@/features/transactions/functions";
import { getCurrentUser } from "@/core/auth/session.functions";
import { invalidateMoney } from "@/shared/queries";
import { acknowledgeEntry, markAttempt, markFailed, pendingEntries, persistQueries, syncJournal, type OfflineUser, type PendingEntry } from "./storage";
import type { SyncRecord } from "./sync-service";

const OfflineContext = createContext({ online: true, ready: false, entries: [] as PendingEntry[], records: [] as SyncRecord[], lastSyncedAt: null as number | null, syncing: false, error: "", storageError: false, sync: async (_id?: string) => {} });
export const useOffline = () => useContext(OfflineContext);

export function OfflineProvider({ user, children }: { user: OfflineUser; children: ReactNode }) {
  const qc = useQueryClient();
  const create = useServerFn(createTransaction);
  const verifyUser = useServerFn(getCurrentUser);
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const running = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const refresh = useCallback(async () => {
    try { const journal = await syncJournal(user.id); setRecords(journal.records); setEntries(journal.records.filter((r) => r.status !== "completed")); setLastSyncedAt(journal.lastSyncedAt); }
    catch { setStorageError(true); }
  }, [user.id]);
  const sync = useCallback(async (id?: string) => {
    if (!navigator.onLine || running.current) return;
    running.current = true;
    const run = async () => {
      setSyncing(true); setError("");
      try {
        const pending = (await pendingEntries(user.id)).filter((r) => !id || r.data.clientId === id);
        if (!pending.length) return;
        let current;
        try { current = await verifyUser(); }
        catch {
          const message = "Could not verify your online session. The local copy is retained; reconnect and retry.";
          for (const entry of pending) { await markAttempt(user.id, entry.data.clientId); await markFailed(user.id, entry.data.clientId, message); }
          setError(message);
          return;
        }
        if (current?.id !== user.id) {
          const message = "Sign in again to sync your saved entries. Nothing has been removed.";
          setError(message);
          for (const entry of pending) await markFailed(user.id, entry.data.clientId, message);
          return;
        }
        let completed = false;
        for (const entry of pending) {
          await markAttempt(user.id, entry.data.clientId);
          try {
            await create({ data: entry.data });
            await acknowledgeEntry(user.id, entry.data.clientId);
            completed = true;
          } catch {
            await markFailed(user.id, entry.data.clientId, "Not confirmed online. A connection error, missing account or conflicting version may have blocked this entry.");
            setError("Some entries could not sync. Local copies are safe; review sync history or retry.");
          }
        }
        if (completed) await invalidateMoney(qc);
      } catch {
        setError("Sync is unavailable. Unsynced entries remain on this device; retry when your connection returns.");
      } finally { setSyncing(false); await refresh(); }
    };
    try {
      if (navigator.locks) await navigator.locks.request(`artha-sync:${user.id}`, { ifAvailable: true }, async (lock) => { if (lock) await run(); });
      else await run();
    } finally { running.current = false; }
  }, [create, verifyUser, qc, refresh, user.id]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = qc.getQueryCache().subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void persistQueries(qc).catch(() => setStorageError(true)); }, 150);
    });
    const connection = () => { setOnline(navigator.onLine); setReady(true); if (navigator.onLine) void sync(); };
    const queue = () => { void refresh(); if (navigator.onLine) void sync(); };
    connection(); void refresh();
    void persistQueries(qc).catch(() => setStorageError(true));
    window.addEventListener("online", connection); window.addEventListener("offline", connection); window.addEventListener("artha:queue", queue);
    const otherTab = () => { void refresh(); };
    window.addEventListener("focus", otherTab);
    const interval = setInterval(() => { if (navigator.onLine) void sync(); }, 30000);
    return () => { unsubscribe(); if (timer) clearTimeout(timer); clearInterval(interval); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); window.removeEventListener("artha:queue", queue); window.removeEventListener("focus", otherTab); };
  }, [qc, refresh, sync]);

  return <OfflineContext.Provider value={{ online, ready, entries, records, lastSyncedAt, syncing, error, storageError, sync }}>
    {children}
  </OfflineContext.Provider>;
}