import { and, eq } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { financeRecord, transaction } from "@/core/db/schema";
import { atomicWrite } from "@/core/db/atomic.server";
import { recordInput } from "./schema";
import { nextBillDate } from "./service";
import { pairedId } from "../transactions/transfer-service";
export async function closeSalary(db: Db, userId: string, id: string) {
  const [row] = await db.select().from(financeRecord).where(and(eq(financeRecord.id, id), eq(financeRecord.userId, userId), eq(financeRecord.kind, "salary")));
  if (!row) throw new Error("Salary schedule unavailable.");
  const record = recordInput.parse({ id, kind: row.kind, payload: row.payload }), p = record.payload;
  if (p.paid) return;
  const [payment] = await db.select().from(transaction).where(and(eq(transaction.id, id), eq(transaction.userId, userId)));
  if (!payment || payment.kind !== "income" || payment.accountId !== p.accountId || payment.amountMinor !== p.amountMinor || payment.currency !== p.currency) throw new Error("Wait for the acknowledged salary credit before scheduling next month.");
  const nextId = await pairedId(`salary:${id}`), date = nextBillDate(p.date, 1);
  await atomicWrite(db, tx => [tx.update(financeRecord).set({ payload: { ...p, paid: true }, updatedAt: new Date() }).where(and(eq(financeRecord.id, id), eq(financeRecord.userId, userId))), tx.insert(financeRecord).values({ id: nextId, userId, kind: "salary", payload: { ...p, date, paid: false } }).onConflictDoNothing()]);
}