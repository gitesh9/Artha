import { get, set, del } from "idb-keyval";
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";
import { completeSync, failSync, type SyncJournal } from "./sync-service";
import { readEncrypted, writeEncrypted, withVaultLock, vaultIsUnlocked } from "./vault";

export type OfflineUser = { id: string; name: string; email: string };
export type Entry = { clientId: string; accountId: string; kind: "income" | "expense" | "transfer"; amount: number; category: string; note?: string; occurredOn: string; destinationId?: string; destinationAmount?: number; sipBillId?: string; units?: number };
export type PendingEntry = { data: Entry; currency: string; createdAt: number };
type SavedSession = { user: OfflineUser; expiresAt: number };
const sessionKey = "artha:offline:session:v1";
const cacheKey = (id: string) => `artha:offline:queries:v2:${id}`;
const journalKey = (id: string) => `artha:offline:sync:v3:${id}`;
const oldCacheKey = (id: string) => `artha:offline:queries:v1:${id}`;
const queueKey = (id: string) => `artha:offline:entries:v1:${id}`;
const oldJournalKey = (id: string) => `artha:offline:sync:v2:${id}`;
export const offlineSessionLifetime = 24 * 60 * 60 * 1000;
export function usableOfflineSession(session: SavedSession | undefined, now = Date.now()) {
  return session && session.expiresAt > now ? session.user : null;
}
export async function offlineUser() { return usableOfflineSession(await get<SavedSession>(sessionKey)); }
export async function rememberOfflineUser(user: OfflineUser) {
  await set(sessionKey, { user, expiresAt: Date.now() + offlineSessionLifetime });
}

/** Encrypt each legacy copy before deleting it. A failed migration never silently drops work. */
export async function migrateFinancialData(userId: string) {
  await withVaultLock(userId, async () => {
    const oldCache = await get<DehydratedState>(oldCacheKey(userId));
    if (oldCache) {
      if (!await readEncrypted(userId, cacheKey(userId))) await writeEncrypted(userId, cacheKey(userId), oldCache);
      await del(oldCacheKey(userId));
    }
    const legacy = await get<PendingEntry[]>(queueKey(userId));
    const old = await get<SyncJournal>(oldJournalKey(userId));
    if (old || legacy) {
      const current = await readEncrypted<SyncJournal>(userId, journalKey(userId)) ?? { records: [], lastSyncedAt: null };
      const imported = [...(old?.records ?? []), ...(legacy ?? []).map((entry) => ({ ...entry, status: "pending" as const, attempts: 0, updatedAt: entry.createdAt }))];
      const records = [...current.records];
      for (const record of imported) if (!records.some((r) => r.data.clientId === record.data.clientId)) records.push(record);
      await writeEncrypted(userId, journalKey(userId), { records, lastSyncedAt: current.lastSyncedAt ?? old?.lastSyncedAt ?? null });
      await del(queueKey(userId)); await del(oldJournalKey(userId));
    }
  });
}
export async function prepareOfflineUser(user: OfflineUser, qc: QueryClient, online: boolean) {
  if (!vaultIsUnlocked(user.id)) throw new Error("Unlock local data before accessing financial pages.");
  const previous = await get<SavedSession>(sessionKey);
  if (previous?.user.id !== user.id) qc.clear();
  await migrateFinancialData(user.id);
  const saved = await readEncrypted<DehydratedState>(user.id, cacheKey(user.id));
  if (saved) hydrate(qc, saved);
  if (online) await rememberOfflineUser(user);
}
export async function persistQueries(qc: QueryClient) {
  const user = await offlineUser();
  if (!user || !vaultIsUnlocked(user.id)) return;
  const snapshot = dehydrate(qc, { shouldDehydrateMutation: () => false, shouldDehydrateQuery: (q) => q.state.status === "success" && ["money", "accounts", "settings"].includes(String(q.queryKey[0])) });
  await withVaultLock(user.id, () => writeEncrypted(user.id, cacheKey(user.id), snapshot));
}
export async function syncJournal(userId: string): Promise<SyncJournal> {
  await migrateFinancialData(userId);
  return await readEncrypted<SyncJournal>(userId, journalKey(userId)) ?? { records: [], lastSyncedAt: null };
}
export async function pendingEntries(userId: string): Promise<PendingEntry[]> { return (await syncJournal(userId)).records.filter((r) => r.status !== "completed"); }
async function changeJournal(userId: string, change: (journal: SyncJournal) => SyncJournal) {
  await migrateFinancialData(userId);
  await withVaultLock(userId, async () => {
    const journal = await readEncrypted<SyncJournal>(userId, journalKey(userId)) ?? { records: [], lastSyncedAt: null };
    await writeEncrypted(userId, journalKey(userId), change(journal));
  });
  window.dispatchEvent(new Event("artha:queue"));
}
export async function enqueueEntry(userId: string, entry: PendingEntry) {
  await changeJournal(userId, (state) => state.records.some((r) => r.data.clientId === entry.data.clientId) ? state : { ...state, records: [...state.records, { ...entry, status: "pending", attempts: 0, updatedAt: entry.createdAt }] });
}
export async function acknowledgeEntry(userId: string, id: string) { await changeJournal(userId, (journal) => completeSync(journal, id, Date.now())); }
export async function markAttempt(userId: string, id: string) {
  await changeJournal(userId, (state) => ({ ...state, records: state.records.map((r) => r.data.clientId === id && r.status !== "completed" ? { ...r, status: "pending", attempts: r.attempts + 1, attemptedAt: Date.now(), updatedAt: Date.now() } : r) }));
}
export async function markFailed(userId: string, id: string, message: string) { await changeJournal(userId, (journal) => failSync(journal, id, message, Date.now())); }
export async function clearAppCaches() {
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("artha-")).map((name) => caches.delete(name)));
  }
}
export async function clearOfflineUser(userId: string, preserveEntries = false) {
  await del(sessionKey);
  await withVaultLock(userId, async () => {
    await del(cacheKey(userId)); await del(oldCacheKey(userId));
    if (!preserveEntries) { await del(queueKey(userId)); await del(oldJournalKey(userId)); await del(journalKey(userId)); }
  });
  await clearAppCaches();
}