// @vitest-environment node
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/core/db/schema";
import type { Db } from "@/core/db/client";
import { restoreBackup } from "@/features/backup/repository";
import { backupSchema } from "@/features/backup/schema";
const backup = backupSchema.parse({ version: 1, id: "11111111-1111-4111-8111-111111111111", exportedAt: "2026-11-21T00:00:00Z", baseCurrency: "INR", accounts: [{ id: "22222222-2222-4222-8222-222222222222", name: "Backup bank", type: "bank", currency: "INR", openingBalanceMinor: 1000000 }], transactions: [{ id: "33333333-3333-4333-8333-333333333333", accountId: "22222222-2222-4222-8222-222222222222", kind: "expense", currency: "INR", amountMinor: 12500, category: "Food", note: "Test", occurredOn: "2026-11-21" }], budgets: [{ category: "Food", monthlyLimitMinor: 500000 }, { category: "Travel", monthlyLimitMinor: 800000 }], records: [] });
it("confirmed restore appends owned money once on retry, restores missing budgets and never overwrites existing limits", async () => {
 const pg = new PGlite(), actual = drizzle(pg, { schema }); await migrate(actual, { migrationsFolder: "./drizzle" }); const db = actual as unknown as Db;
 await actual.insert(schema.user).values([{ id: "owner", name: "Owner", email: "restore-owner@example.com" }, { id: "other", name: "Other", email: "restore-other@example.com" }]);
 await actual.insert(schema.budget).values({ id: crypto.randomUUID(), userId: "owner", category: "Food", monthlyLimitMinor: 100000 });
 await restoreBackup(db, "owner", backup); await restoreBackup(db, "owner", backup);
 expect((await actual.select().from(schema.moneyAccount)).length).toBe(1); const tx = (await actual.select().from(schema.transaction))[0]; expect(tx?.amountMinor).toBe(12500); expect(tx?.userId).toBe("owner");
 const budgets = await actual.select().from(schema.budget); expect(budgets.find(b => b.category === "Food")?.monthlyLimitMinor).toBe(100000); expect(budgets.find(b => b.category === "Travel")?.monthlyLimitMinor).toBe(800000);
 await restoreBackup(db, "other", backup); expect((await actual.select().from(schema.moneyAccount)).length).toBe(2); expect((await actual.select().from(schema.transaction)).filter(t => t.userId === "other")[0]?.id).not.toBe(tx?.id);
 await pg.close();
}, 30000);
it("invalid planning links are rejected before a backup can change accounts or money", () => expect(backupSchema.safeParse({ ...backup, records: [{ id: crypto.randomUUID(), kind: "flow", payload: { name: "Unknown holding", currency: "INR", date: "2026-11-21", linkedId: crypto.randomUUID(), amountMinor: 500 } }] }).success).toBe(false));