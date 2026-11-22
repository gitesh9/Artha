import { and, eq } from "drizzle-orm";
import { financeRecord } from "@/core/db/schema";
import type { Db } from "@/core/db/client";
import { recordInput, type FinancialRecord } from "./schema";
export const planningRepo = {
  async list(db: Db, userId: string): Promise<FinancialRecord[]> { return (await db.select().from(financeRecord).where(eq(financeRecord.userId, userId))).map(r => recordInput.parse({ id: r.id, kind: r.kind, payload: r.payload })); },
  async save(db: Db, userId: string, item: FinancialRecord) {
    const existing = (await db.select().from(financeRecord).where(eq(financeRecord.id, item.id)).limit(1))[0];
    if (existing && existing.userId !== userId) throw new Error("Record unavailable");
    if (existing && existing.kind !== item.kind) throw new Error("Record type cannot change");
    const rows = await planningRepo.list(db, userId);
    if (item.kind === "flow" || item.kind === "contribution") {
      const expected = item.kind === "flow" ? "holding" : "goal";
      const parent = rows.find(r => r.id === item.payload.linkedId && r.kind === expected);
      if (!parent || parent.payload.currency !== item.payload.currency) throw new Error("Choose a linked record in the same currency.");
    } else if (item.payload.linkedId && !rows.some(r => r.id === item.payload.linkedId)) throw new Error("Linked record unavailable");
    if (existing && ["asset", "liability", "holding"].includes(item.kind)) {
      const old = recordInput.parse({ id: existing.id, kind: existing.kind, payload: existing.payload });
      item.payload.history = [...old.payload.history, { date: old.payload.date, amountMinor: old.payload.valueMinor }].slice(-500);
    }
    await db.insert(financeRecord).values({ id: item.id, userId, kind: item.kind, payload: item.payload }).onConflictDoUpdate({ target: financeRecord.id, set: { payload: item.payload, updatedAt: new Date() }, setWhere: eq(financeRecord.userId, userId) });
  },
  remove: (db: Db, userId: string, id: string) => db.delete(financeRecord).where(and(eq(financeRecord.userId, userId), eq(financeRecord.id, id))),
};