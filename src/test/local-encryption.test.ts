import "fake-indexeddb/auto";
import { get, set, keys } from "idb-keyval";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createVault, unlockVault, lockVaults, readEncrypted, writeEncrypted, vaultIterations, vaultMinLength, vaultIsUnlocked } from "@/core/offline/vault";
import { clearOfflineUser, enqueueEntry, pendingEntries, persistQueries, prepareOfflineUser, syncJournal, migrateFinancialData, offlineUser } from "@/core/offline/storage";

const passphrase = "four-unrelated-test-words";
const entry = { data: { clientId: "encrypted-entry", accountId: "wallet", kind: "expense" as const, amount: 853.27, category: "Confidential groceries", note: "Private receipt details", occurredOn: "2026-11-21" }, currency: "INR", createdAt: 1000 };
describe("local financial encryption", () => {
  it("requires a 12-character passphrase and uses 600,000 derivation rounds", async () => {
    expect(vaultMinLength).toBe(12); expect(vaultIterations).toBe(600000);
    await expect(createVault("too-short", "12345678901")).rejects.toThrow();
  });
  it("stores only ciphertext for financial snapshots and pending/completed sync records", async () => {
    const user = { id: "cipher-user", name: "Test", email: "test@example.com" };
    await createVault(user.id, passphrase);
    const qc = new QueryClient(); await prepareOfflineUser(user, qc, true);
    qc.setQueryData(["accounts"], [{ name: "Private bank name", balanceMinor: 85327 }]);
    await persistQueries(qc); await enqueueEntry(user.id, entry);
    const rawJournal = JSON.stringify(await get(`artha:offline:sync:v3:${user.id}`));
    const rawCache = JSON.stringify(await get(`artha:offline:queries:v2:${user.id}`));
    expect(rawJournal).not.toContain("Private receipt details"); expect(rawJournal).not.toContain("Confidential groceries");
    expect(rawCache).not.toContain("Private bank name");
    expect(await pendingEntries(user.id)).toEqual([expect.objectContaining(entry)]);
    expect(JSON.stringify(await get(`artha:vault:config:v1:${user.id}`))).not.toContain(passphrase);
    expect((await keys()).some((key) => String(key).includes("CryptoKey"))).toBe(false);
    await clearOfflineUser(user.id);
  });
  it("rejects access after locking and a wrong passphrase, then restores exact unsynced entries", async () => {
    await createVault("lock-user", passphrase); await enqueueEntry("lock-user", entry);
    lockVaults(); expect(vaultIsUnlocked("lock-user")).toBe(false);
    await expect(pendingEntries("lock-user")).rejects.toThrow();
    await expect(enqueueEntry("lock-user", entry)).rejects.toThrow();
    await expect(unlockVault("lock-user", "incorrect-passphrase")).rejects.toThrow("did not unlock");
    await unlockVault("lock-user", passphrase);
    expect((await pendingEntries("lock-user"))[0]?.data.amount).toBe(853.27);
    await clearOfflineUser("lock-user");
  });
  it("binds encrypted data to the account and detects ciphertext tampering", async () => {
    await createVault("owner-a", passphrase); await createVault("owner-b", passphrase);
    await writeEncrypted("owner-a", "artha:test:owner-a", { amountMinor: 85327 });
    const envelope = await get<{ version: number; iv: number[]; ciphertext: number[] }>("artha:test:owner-a");
    if (!envelope) throw new Error("Missing ciphertext");
    await expect(readEncrypted("owner-b", "artha:test:owner-a")).rejects.toThrow();
    await set("artha:test:owner-b", envelope);
    await expect(readEncrypted("owner-a", "artha:test:owner-b")).rejects.toThrow();
    const altered = [...envelope.ciphertext]; altered[0] = (altered[0] ?? 0) ^ 1;
    await set("artha:test:owner-a", { ...envelope, ciphertext: altered });
    await expect(readEncrypted("owner-a", "artha:test:owner-a")).rejects.toThrow();
  });
  it("migrates plaintext only after durable encrypted saves without losing pending entries", async () => {
    await createVault("migration-user", passphrase);
    await set("artha:offline:entries:v1:migration-user", [entry]);
    await set("artha:offline:sync:v2:migration-user", { records: [], lastSyncedAt: null });
    await migrateFinancialData("migration-user");
    expect(await get("artha:offline:entries:v1:migration-user")).toBeUndefined();
    expect(await get("artha:offline:sync:v2:migration-user")).toBeUndefined();
    expect((await pendingEntries("migration-user"))[0]?.data.note).toBe("Private receipt details");
    await clearOfflineUser("migration-user");
  });
  it("secure sign-out cleanup removes offline identity and snapshots but preserves locked unsynced work", async () => {
    const user = { id: "signout-user", name: "Test", email: "test@example.com" };
    await createVault(user.id, passphrase);
    const qc = new QueryClient(); await prepareOfflineUser(user, qc, true);
    qc.setQueryData(["accounts"], [{ name: "Signout wallet" }]); await persistQueries(qc); await enqueueEntry(user.id, entry);
    lockVaults(); qc.clear(); await clearOfflineUser(user.id, true);
    expect(await offlineUser()).toBeNull();
    expect(qc.getQueryData(["accounts"])).toBeUndefined();
    expect(await get(`artha:offline:queries:v2:${user.id}`)).toBeUndefined();
    await expect(syncJournal(user.id)).rejects.toThrow();
    await unlockVault(user.id, passphrase);
    expect((await pendingEntries(user.id))[0]?.data.amount).toBe(853.27);
    await clearOfflineUser(user.id);
  });
  it("serializes simultaneous encrypted saves rather than losing money entries", async () => {
    await createVault("concurrent-user", passphrase);
    await Promise.all([enqueueEntry("concurrent-user", entry), enqueueEntry("concurrent-user", { ...entry, data: { ...entry.data, clientId: "second-encrypted-entry" } })]);
    expect((await pendingEntries("concurrent-user")).map((r) => r.data.clientId).sort()).toEqual(["encrypted-entry", "second-encrypted-entry"]);
    await clearOfflineUser("concurrent-user");
  });
});