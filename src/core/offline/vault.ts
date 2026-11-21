import { get, set } from "idb-keyval";

export const vaultIterations = 600_000;
export const vaultMinLength = 12;
type Envelope = { version: 1; iv: number[]; ciphertext: number[] };
type VaultConfig = { version: 1; salt: number[]; check: Envelope };
const configKey = (id: string) => `artha:vault:config:v1:${id}`;
const unlocked = new Map<string, CryptoKey>();
let epoch = 0;

export function vaultIsUnlocked(id: string) { return unlocked.has(id); }
export async function vaultExists(id: string) { return Boolean(await get<VaultConfig>(configKey(id))); }
export function lockVaults() { epoch++; unlocked.clear(); }
function requireKey(id: string) {
  const key = unlocked.get(id);
  if (!key) throw new Error("Local financial data is locked. Unlock with your device passphrase.");
  return key;
}
async function derive(passphrase: string, salt: number[]) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations: vaultIterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(key: CryptoKey, scope: string, value: unknown): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(scope) }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { version: 1, iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
}
async function open<T>(key: CryptoKey, scope: string, envelope: Envelope): Promise<T> {
  if (envelope.version !== 1) throw new Error("Unsupported local encryption format");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(envelope.iv), additionalData: new TextEncoder().encode(scope) }, key, new Uint8Array(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
export async function createVault(id: string, passphrase: string) {
  return withVaultLock(id, async () => {
  if (passphrase.length < vaultMinLength) throw new Error("Use a device passphrase of at least 12 characters.");
  if (await vaultExists(id)) throw new Error("A local vault already exists. Unlock it instead.");
  const start = epoch;
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  const key = await derive(passphrase, salt);
  const check = await seal(key, configKey(id), "artha-vault-check");
  if (start !== epoch) throw new Error("Local data was locked. Try again.");
  await set(configKey(id), { version: 1, salt, check } satisfies VaultConfig);
  if (start !== epoch) throw new Error("Local data was locked. Try again.");
  unlocked.set(id, key);
  });
}
export async function unlockVault(id: string, passphrase: string) {
  const start = epoch;
  const config = await get<VaultConfig>(configKey(id));
  if (!config) throw new Error("Set up encryption for this device first.");
  const key = await derive(passphrase, config.salt);
  try {
    if (await open<string>(key, configKey(id), config.check) !== "artha-vault-check") throw new Error("Invalid check");
  } catch { throw new Error("That device passphrase did not unlock your data."); }
  if (start !== epoch) throw new Error("Local data was locked. Try again.");
  unlocked.set(id, key);
}
export async function readEncrypted<T>(id: string, storageKey: string) {
  const key = requireKey(id);
  const start = epoch;
  const envelope = await get<Envelope>(storageKey);
  if (!envelope) return undefined;
  const value = await open<T>(key, storageKey, envelope);
  if (start !== epoch || !vaultIsUnlocked(id)) throw new Error("Local data was locked.");
  return value;
}
export async function writeEncrypted(id: string, storageKey: string, value: unknown) {
  const start = epoch;
  const envelope = await seal(requireKey(id), storageKey, value);
  if (start !== epoch || !vaultIsUnlocked(id)) throw new Error("Local data was locked.");
  await set(storageKey, envelope);
}

let serial: Promise<unknown> = Promise.resolve();
export function withVaultLock<T>(id: string, work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(`artha-vault:${id}`, work);
  const result = serial.then(work, work);
  serial = result.catch(() => {});
  return result;
}

const signalKey = "artha:local-lock";
export function broadcastVaultLock() {
  lockVaults();
  // Signal contains no user identity, keys, or financial data.
  try { localStorage.setItem(signalKey, crypto.randomUUID()); } catch { /* BroadcastChannel still covers supported browsers. */ }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(signalKey); channel.postMessage("lock"); channel.close();
  }
  window.dispatchEvent(new Event("artha:vault-lock"));
}
export function listenForVaultLock(onLock: () => void) {
  const handle = () => { lockVaults(); onLock(); };
  const storage = (event: StorageEvent) => { if (event.key === signalKey) handle(); };
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(signalKey) : null;
  if (channel) channel.onmessage = handle;
  window.addEventListener("storage", storage); window.addEventListener("artha:vault-lock", handle);
  return () => { channel?.close(); window.removeEventListener("storage", storage); window.removeEventListener("artha:vault-lock", handle); };
}