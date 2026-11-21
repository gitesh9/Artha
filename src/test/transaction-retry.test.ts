// @vitest-environment node
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/core/db/schema";
import { transactionsRepo } from "@/features/transactions/repository";
import { sameTransaction } from "@/features/transactions/service";
import type { Db } from "@/core/db/client";

it("stores one expense when an interrupted sync retries the same ID, without acknowledging another user's record", async () => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.insert(schema.user).values([{ id: "one", name: "One", email: "one@example.com" }, { id: "two", name: "Two", email: "two@example.com" }]);
  await db.insert(schema.moneyAccount).values({ id: "wallet", userId: "one", name: "Wallet", type: "cash", currency: "INR" });
  const client = db as unknown as Db;
  const row = { id: "stable-entry-id", userId: "one", accountId: "wallet", kind: "expense", amountMinor: 12345, currency: "INR", category: "Food", note: "Lunch", occurredOn: "2026-11-21" };
  await transactionsRepo.create(client, row);
  await transactionsRepo.create(client, row);
  const rows = await transactionsRepo.list(client, "one", {});
  expect(rows.length).toBe(1);
  expect(rows[0]?.amountMinor).toBe(12345);
  const saved = await transactionsRepo.byId(client, "one", row.id);
  expect(saved && sameTransaction(saved, row)).toBe(true);
  expect(await transactionsRepo.byId(client, "two", row.id)).toBeUndefined();
  await transactionsRepo.create(client, { ...row, amountMinor: 99999 });
  const unchanged = await transactionsRepo.byId(client, "one", row.id);
  expect(unchanged?.amountMinor).toBe(12345);
  expect(unchanged && sameTransaction(unchanged, { ...row, amountMinor: 99999 })).toBe(false);
  await pg.close();
}, 30000);