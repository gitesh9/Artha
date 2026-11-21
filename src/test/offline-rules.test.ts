import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { acknowledgeEntry, clearOfflineUser, enqueueEntry, pendingEntries, prepareOfflineUser, persistQueries, usableOfflineSession, offlineSessionLifetime } from "@/core/offline/storage";
import { refusesOfflineWorker } from "@/core/offline/register";
import { sameTransaction } from "@/features/transactions/service";
import { createVault } from "@/core/offline/vault";

describe("offline financial safety", () => {
  it("keeps each user's pending entries isolated and removes only an acknowledged ID", async () => {
    await createVault("one", "offline-test-passphrase"); await createVault("two", "different-test-passphrase");
    const entry = { data: { clientId: "first", accountId: "wallet", kind: "expense" as const, amount: 123.45, category: "Food", occurredOn: "2026-11-21" }, currency: "INR", createdAt: 1 };
    await enqueueEntry("one", entry);
    await enqueueEntry("one", { ...entry, data: { ...entry.data, clientId: "second" } });
    expect(await pendingEntries("two")).toEqual([]);
    expect((await pendingEntries("one")).map((row) => row.data.amount)).toEqual([123.45, 123.45]);
    await acknowledgeEntry("one", "first");
    expect((await pendingEntries("one")).map((row) => row.data.clientId)).toEqual(["second"]);
    await clearOfflineUser("one");
    expect(await pendingEntries("one")).toEqual([]);
  });
  it("restores financial snapshots without persisting auth queries or leaking another user's cache", async () => {
    const qc = new QueryClient();
    const user = { id: "cache-one", name: "Test", email: "test@example.com" };
    await createVault(user.id, "cache-test-passphrase"); await createVault("cache-two", "different-cache-passphrase");
    await prepareOfflineUser(user, qc, true);
    qc.setQueryData(["accounts"], [{ name: "Wallet", balanceMinor: 12345 }]);
    qc.setQueryData(["auth"], { secret: "must-not-persist" });
    await persistQueries(qc);
    const restored = new QueryClient();
    await prepareOfflineUser(user, restored, false);
    expect(restored.getQueryData(["accounts"])).toEqual([{ name: "Wallet", balanceMinor: 12345 }]);
    expect(restored.getQueryData(["auth"])).toBeUndefined();
    await prepareOfflineUser({ ...user, id: "cache-two" }, restored, true);
    expect(restored.getQueryData(["accounts"])).toBeUndefined();
    await clearOfflineUser(user.id); await clearOfflineUser("cache-two");
  });
  it("expires offline identity instead of extending server access", () => {
    const user = { id: "one", name: "Test", email: "test@example.com" };
    expect(offlineSessionLifetime).toBe(86400000);
    expect(usableOfflineSession({ user, expiresAt: 100 }, 99)).toEqual(user);
    expect(usableOfflineSession({ user, expiresAt: 100 }, 100)).toBeNull();
  });
  it("retains unsynced financial work when password recovery clears offline access", async () => {
    await createVault("recovering", "recovery-test-passphrase");
    await enqueueEntry("recovering", { data: { clientId: "recover-entry", accountId: "wallet", kind: "expense", amount: 20, category: "Food", occurredOn: "2026-11-21" }, currency: "INR", createdAt: 1 });
    await clearOfflineUser("recovering", true);
    expect((await pendingEntries("recovering")).map((entry) => entry.data.amount)).toEqual([20]);
    await clearOfflineUser("recovering");
  });
  it("requires exact amounts and ownership when acknowledging a duplicate entry", () => {
    const row = { userId: "one", accountId: "wallet", kind: "expense", amountMinor: 12345, currency: "INR", category: "Food", note: null, occurredOn: "2026-11-21" };
    expect(sameTransaction(row, { ...row })).toBe(true);
    expect(sameTransaction(row, { ...row, amountMinor: 12346 })).toBe(false);
    expect(sameTransaction(row, { ...row, userId: "two" })).toBe(false);
  });
});
describe("app worker safety", () => {
  it("refuses dev, iframe, kill switch, and Lovable preview hosts but permits published custom domains", () => {
    expect(refusesOfflineWorker("artha.example.com", false, false, false)).toBe(true);
    expect(refusesOfflineWorker("artha.example.com", true, true, false)).toBe(true);
    expect(refusesOfflineWorker("artha.example.com", true, false, true)).toBe(true);
    for (const host of ["id-preview--abc.lovable.app", "preview-2--abc.gpt-eng.com", "abc.lovableproject.com", "project--abc-dev.lovable.app", "beta.lovable.dev"]) expect(refusesOfflineWorker(host, true, false, false)).toBe(true);
    expect(refusesOfflineWorker("artha.example.com", true, false, false)).toBe(false);
    expect(refusesOfflineWorker("preview-v2--shop.example.com", true, false, false)).toBe(false);
  });
});