// @vitest-environment node
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/core/db/schema";
import type { Db } from "@/core/db/client";
import { planningRepo } from "@/features/planning/repository";
import { recordInput } from "@/features/planning/schema";
it("planning reads writes removals and linked flows stay within the signed-in owner's account", async () => {
  const pg = new PGlite(), actual = drizzle(pg, { schema }); await migrate(actual, { migrationsFolder: "./drizzle" }); const db = actual as unknown as Db;
  await actual.insert(schema.user).values([{ id: "owner", name: "Owner", email: "owner-planning@example.com" }, { id: "other", name: "Other", email: "other-planning@example.com" }]);
  const item = recordInput.parse({ id: "11111111-1111-4111-8111-111111111111", kind: "holding", payload: { name: "FD", currency: "INR", date: "2026-11-21", amountMinor: 1000000, valueMinor: 1100000 } });
  await planningRepo.save(db, "owner", item);
  expect((await planningRepo.list(db, "owner"))[0]?.payload.valueMinor).toBe(1100000);
  expect(await planningRepo.list(db, "other")).toEqual([]);
  await expect(planningRepo.save(db, "other", item)).rejects.toThrow("Record unavailable");
  await planningRepo.remove(db, "other", item.id); expect((await planningRepo.list(db, "owner")).length).toBe(1);
  const foreign = recordInput.parse({ id: "22222222-2222-4222-8222-222222222222", kind: "flow", payload: { name: "Buy", date: "2026-11-21", currency: "INR", amountMinor: 100, linkedId: item.id } });
  await expect(planningRepo.save(db, "other", foreign)).rejects.toThrow("same currency");
  await expect(planningRepo.save(db, "owner", { ...foreign, payload: { ...foreign.payload, currency: "USD" } })).rejects.toThrow("same currency");
  await pg.close();
}, 30000);