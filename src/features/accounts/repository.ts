import { and, eq } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { moneyAccount } from "@/core/db/schema";

export const accountsRepo = {
  list: (db: Db, userId: string) =>
    db.select().from(moneyAccount).where(eq(moneyAccount.userId, userId)).orderBy(moneyAccount.createdAt),
  create: (db: Db, row: typeof moneyAccount.$inferInsert) => db.insert(moneyAccount).values(row),
  remove: (db: Db, userId: string, id: string) =>
    db.delete(moneyAccount).where(and(eq(moneyAccount.userId, userId), eq(moneyAccount.id, id))),
};
