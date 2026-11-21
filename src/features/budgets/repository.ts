import { and, eq } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { budget } from "@/core/db/schema";

export const budgetsRepo = {
  list: (db: Db, userId: string) => db.select().from(budget).where(eq(budget.userId, userId)),
  upsert: (db: Db, userId: string, category: string, monthlyLimitMinor: number) =>
    db.insert(budget).values({ id: crypto.randomUUID(), userId, category, monthlyLimitMinor })
      .onConflictDoUpdate({ target: [budget.userId, budget.category], set: { monthlyLimitMinor } }),
  remove: (db: Db, userId: string, id: string) =>
    db.delete(budget).where(and(eq(budget.userId, userId), eq(budget.id, id))),
};
