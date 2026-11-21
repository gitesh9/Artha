import type { PendingEntry } from "./storage";
export type SyncRecord = PendingEntry & { status: "pending" | "completed" | "failed"; attempts: number; updatedAt: number; attemptedAt?: number; completedAt?: number; error?: string };
export type SyncJournal = { records: SyncRecord[]; lastSyncedAt: number | null };
export function completeSync(journal: SyncJournal, id: string, now: number): SyncJournal {
  const exists = journal.records.some((r) => r.data.clientId === id && r.status !== "completed");
  if (!exists) return journal;
  return { lastSyncedAt: Math.max(journal.lastSyncedAt ?? 0, now), records: journal.records.map((r) => {
    if (r.data.clientId !== id) return r;
    const { error: _error, ...record } = r;
    return { ...record, status: "completed", updatedAt: now, completedAt: now };
  }) };
}
export function failSync(journal: SyncJournal, id: string, message: string, now: number): SyncJournal {
  return { ...journal, records: journal.records.map((r) => r.data.clientId === id && r.status !== "completed" ? { ...r, status: "failed", updatedAt: now, error: message } : r) };
}