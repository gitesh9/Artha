import { and, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { transaction } from "@/core/db/schema";

export type TxFilter = { from?: string | null | undefined; to?: string | null | undefined; kind?: string | undefined; category?: string | undefined; search?: string | undefined; accountId?: string | undefined };

function where(userId: string, f: TxFilter): SQL | undefined {
  const c: (SQL | undefined)[] = [eq(transaction.userId, userId)];
  if (f.from) c.push(gte(transaction.occurredOn, f.from));
  if (f.to) c.push(lte(transaction.occurredOn, f.to));
  if (f.kind) c.push(eq(transaction.kind, f.kind));
  if (f.accountId) c.push(eq(transaction.accountId, f.accountId));
  if (f.category) c.push(eq(transaction.category, f.category));
  if (f.search) c.push(ilike(transaction.note, `%${f.search}%`));
  return and(...c);
}

export const transactionsRepo = {
  list: (db: Db, userId: string, f: TxFilter, limit = 500) =>
    db.select().from(transaction).where(where(userId, f))
      .orderBy(desc(transaction.occurredOn), desc(transaction.createdAt)).limit(limit),
  create: (db: Db, row: typeof transaction.$inferInsert) => db.insert(transaction).values(row).onConflictDoNothing({ target: transaction.id }),
  byId: async (db: Db, userId: string, id: string) => (await db.select().from(transaction).where(and(eq(transaction.userId, userId), eq(transaction.id, id))).limit(1))[0],
  remove: (db: Db, userId: string, id: string) =>
    db.delete(transaction).where(and(eq(transaction.userId, userId), eq(transaction.id, id))),
  async netByAccount(db: Db, userId: string) {
    const rows = await db
      .select({
        accountId: transaction.accountId,
        net: sql<string>`sum(case when ${transaction.kind} in ('income', 'transfer_in') then ${transaction.amountMinor} else -${transaction.amountMinor} end)`,
      })
      .from(transaction).where(eq(transaction.userId, userId)).groupBy(transaction.accountId);
    return new Map(rows.map((r) => [r.accountId, Number(r.net)]));
  },
};
