import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { set } from "idb-keyval";
import { acknowledgeEntry, clearOfflineUser, enqueueEntry, markAttempt, markFailed, pendingEntries, syncJournal } from "@/core/offline/storage";
import { completeSync, failSync, type SyncJournal } from "@/core/offline/sync-service";
import { createVault } from "@/core/offline/vault";

const entry = { data: { clientId: "history-one", accountId: "wallet", kind: "expense" as const, amount: 250, category: "Food", occurredOn: "2026-11-21" }, currency: "INR", createdAt: 1000 };
describe("expense sync history", () => {
  it("shows local saves as pending and never sets last-synced time before online acknowledgment", async () => {
    await createVault("history-user", "history-test-passphrase"); await createVault("different-user", "different-test-passphrase");
    await enqueueEntry("history-user", entry);
    let journal = await syncJournal("history-user");
    expect(journal.records[0]?.status).toBe("pending");
    expect(journal.records[0]?.createdAt).toBe(1000);
    expect(journal.lastSyncedAt).toBeNull();
    await markAttempt("history-user", entry.data.clientId);
    await markFailed("history-user", entry.data.clientId, "Connection unavailable");
    journal = await syncJournal("history-user");
    expect(journal.records[0]?.status).toBe("failed");
    expect(journal.records[0]?.attempts).toBe(1);
    expect(journal.records[0]?.attemptedAt).toBeGreaterThan(1000);
    expect(journal.lastSyncedAt).toBeNull();
    expect((await pendingEntries("history-user")).length).toBe(1);
    await markAttempt("history-user", entry.data.clientId);
    await acknowledgeEntry("history-user", entry.data.clientId);
    journal = await syncJournal("history-user");
    expect(journal.records[0]?.status).toBe("completed");
    expect(journal.records[0]?.attempts).toBe(2);
    expect(journal.records[0]?.completedAt).toBe(journal.lastSyncedAt);
    expect(journal.records[0]?.error).toBeUndefined();
    expect((await pendingEntries("history-user")).length).toBe(0);
    expect((await syncJournal("different-user")).records.length).toBe(0);
    await clearOfflineUser("history-user"); await clearOfflineUser("different-user");
  });
  it("retains completed entries while failures do not advance the timestamp or change completed state", () => {
    const journal: SyncJournal = { records: [{ ...entry, status: "pending", attempts: 1, updatedAt: 1000 }], lastSyncedAt: null };
    const completed = completeSync(journal, entry.data.clientId, 5000);
    expect(completed.lastSyncedAt).toBe(5000);
    expect(failSync(completed, entry.data.clientId, "stale failure", 6000).records[0]?.status).toBe("completed");
    expect(completeSync(completed, entry.data.clientId, 7000).lastSyncedAt).toBe(5000);
    expect(completeSync(journal, "unknown", 7000).lastSyncedAt).toBeNull();
  });
  it("migrates the old offline outbox without duplicates or fabricated completed history", async () => {
    await createVault("legacy-history", "legacy-test-passphrase");
    await set("artha:offline:entries:v1:legacy-history", [entry]);
    const journal = await syncJournal("legacy-history");
    expect(journal.records.length).toBe(1);
    expect(journal.records[0]?.status).toBe("pending");
    expect(journal.lastSyncedAt).toBeNull();
    await enqueueEntry("legacy-history", entry);
    expect((await syncJournal("legacy-history")).records.length).toBe(1);
    await clearOfflineUser("legacy-history");
  });
});