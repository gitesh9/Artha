// @vitest-environment node
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/core/db/schema";
import type { Db } from "@/core/db/client";
import { closeBill } from "@/features/planning/bills.repository";
import { planningRepo } from "@/features/planning/repository";
import { recordInput } from "@/features/planning/schema";
it("closing an EMI requires acknowledged payment, retries schedule only once and the last installment stops", async () => {
 const pg = new PGlite(), actual = drizzle(pg, { schema }); await migrate(actual, { migrationsFolder: "./drizzle" }); const db = actual as unknown as Db;
 await actual.insert(schema.user).values({ id: "owner", name: "Owner", email: "bill-completion@example.com" });
 await actual.insert(schema.moneyAccount).values({ id: "bank", userId: "owner", name: "Bank", type: "bank", currency: "INR" });
 const bill = recordInput.parse({ id: "11111111-1111-4111-8111-111111111111", kind: "bill", payload: { name: "EMI", currency: "INR", date: "2026-01-31", amountMinor: 200000, subtype: "emi", installmentsLeft: 2 } });
 await planningRepo.save(db, "owner", bill); await expect(closeBill(db, "owner", bill.id)).rejects.toThrow("acknowledged"); await expect(closeBill(db, "other", bill.id)).rejects.toThrow("unavailable");
 await actual.insert(schema.transaction).values({ id: bill.id, accountId: "bank", userId: "owner", kind: "expense", amountMinor: 200000, currency: "INR", category: "Bills", occurredOn: "2026-01-31" });
 await closeBill(db, "owner", bill.id); await closeBill(db, "owner", bill.id);
 const rows = await planningRepo.list(db, "owner"), next = rows.find(r => r.id !== bill.id); expect(rows.length).toBe(2); expect(next?.payload).toMatchObject({ date: "2026-02-28", installmentsLeft: 1, paid: false });
 if (!next) throw new Error("Next EMI missing");
 await actual.insert(schema.transaction).values({ id: next.id, accountId: "bank", userId: "owner", kind: "expense", amountMinor: 200000, currency: "INR", category: "Bills", occurredOn: "2026-02-28" });
 await closeBill(db, "owner", next.id); expect((await planningRepo.list(db, "owner")).length).toBe(2); expect((await planningRepo.list(db, "owner")).every(r => r.payload.paid)).toBe(true);
 await pg.close();
}, 30000);