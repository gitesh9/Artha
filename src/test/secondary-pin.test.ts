import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { get, set } from "idb-keyval";
import { configurePin, verifySecondaryPin } from "@/core/offline/secondary-pin";
import { createVault, unlockVault, vaultIsUnlocked, lockVaults } from "@/core/offline/vault";
it("secondary PIN stays encrypted and cannot replace the passphrase; wrong PIN removes the vault key", async () => {
 const id = "secondary-pin-check", pass = "four separate passphrase words";
 await createVault(id, pass); await expect(configurePin(id, "12345")).rejects.toThrow("6–12"); await configurePin(id, "728493");
 expect(JSON.stringify(await get(`artha:secondary-pin:v1:${id}`))).not.toContain("728493");
 lockVaults(); await expect(verifySecondaryPin(id, "728493")).rejects.toThrow(); expect(vaultIsUnlocked(id)).toBe(false);
 await unlockVault(id, pass); await expect(verifySecondaryPin(id, "999999")).rejects.toThrow("did not match"); expect(vaultIsUnlocked(id)).toBe(false);
 await unlockVault(id, pass); await verifySecondaryPin(id, "728493"); expect(vaultIsUnlocked(id)).toBe(true); lockVaults();
});
it("unreadable PIN configuration fails closed and removes a just-unlocked key", async () => { const id = "broken-pin-check"; await createVault(id, "separate long vault passphrase"); await set(`artha:secondary-pin:v1:${id}`, { version: 1, iv: [], ciphertext: [] }); await expect(verifySecondaryPin(id, "728493")).rejects.toThrow(); expect(vaultIsUnlocked(id)).toBe(false); });