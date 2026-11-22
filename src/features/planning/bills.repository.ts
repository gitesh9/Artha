import { and, eq } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { financeRecord, transaction } from "@/core/db/schema";
import { atomicWrite } from "@/core/db/atomic.server";
import { recordInput } from "./schema";
import { nextBillDate } from "./service";
export async function closeBill(db: Db, userId: string, id: string) { const [row] = await db.select().from(financeRecord).where(and(eq(financeRecord.userId, userId), eq(financeRecord.id, id), eq(financeRecord.kind, "bill"))); if (!row) throw new Error("Bill unavailable"); const bill = recordInput.parse({ id, kind: row.kind, payload: row.payload }), p = bill.payload; if (p.paid) return;
 const [payment] = await db.select().from(transaction).where(and(eq(transaction.userId, userId), eq(transaction.id, id))); if (!payment || payment.amountMinor !== p.amountMinor || payment.currency !== p.currency || payment.kind !== "expense") throw new Error("Wait for an acknowledged matching payment before closing this bill.");
 const repeats = p.subtype === "monthly" || p.subtype === "annual" || (p.subtype === "emi" && p.installmentsLeft > 1), date = nextBillDate(p.date, p.subtype === "annual" ? 12 : 1);
 const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}|bill|${id}|${date}`))); bytes[6] = ((bytes[6] ?? 0) & 15) | 64; bytes[8] = ((bytes[8] ?? 0) & 63) | 128; const hex = [...bytes.slice(0, 16)].map(b => b.toString(16).padStart(2, "0")).join(""), nextId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
 await atomicWrite(db, tx => [tx.update(financeRecord).set({ payload: { ...p, paid: true }, updatedAt: new Date() }).where(and(eq(financeRecord.id, id), eq(financeRecord.userId, userId))), ...(repeats ? [tx.insert(financeRecord).values({ id: nextId, userId, kind: "bill", payload: { ...p, paid: false, date, installmentsLeft: p.subtype === "emi" ? p.installmentsLeft - 1 : p.installmentsLeft } }).onConflictDoNothing()] : [])]);
}