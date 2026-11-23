import { toMinor } from "@/shared/money";
export function transferAmounts(source: { id: string; currency: string }, destination: { id: string; currency: string }, amount: number, received?: number) {
  if (source.id === destination.id) throw new Error("Choose two different accounts.");
  const outgoing = toMinor(amount, source.currency);
  const incoming = source.currency === destination.currency ? outgoing : toMinor(received ?? 0, destination.currency);
  if (!Number.isSafeInteger(outgoing) || !Number.isSafeInteger(incoming) || outgoing <= 0 || incoming <= 0) throw new Error("Enter positive sent and received amounts. Cross-currency transfers need the actual received amount.");
  return { outgoing, incoming };
}
export async function pairedId(id: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`artha-transfer:${id}`)));
  bytes[6] = ((bytes[6] ?? 0) & 15) | 64; bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const h = [...bytes.slice(0, 16)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}