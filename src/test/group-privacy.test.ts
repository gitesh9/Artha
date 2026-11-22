// @vitest-environment node
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/core/db/schema";
import type { Db } from "@/core/db/client";
import { groupsRepo } from "@/features/groups/repository";
import { payloadSchema } from "@/features/planning/schema";
import { atomicWrite } from "@/core/db/atomic.server";
it("invitation requests reveal no shared money until approved and removed members cannot read or write", async () => {
 const pg = new PGlite(), actual = drizzle(pg, { schema }); await migrate(actual, { migrationsFolder: "./drizzle" }); const db = actual as unknown as Db;
 await actual.insert(schema.user).values([{ id: "a", name: "A", email: "a-group@example.com" }, { id: "b", name: "B", email: "b-group@example.com" }, { id: "c", name: "C", email: "c-group@example.com" }]);
 const group = await groupsRepo.create(db, "a", "Private trip", "INR"), invite = await groupsRepo.invite(db, "a", group.id);
 expect((await actual.select().from(schema.groupInvite))[0]?.tokenHash).not.toBe(invite.token);
 await groupsRepo.request(db, "b", invite.token); expect(await groupsRepo.list(db, "b")).toEqual([]); await expect(groupsRepo.detail(db, "b", group.id)).rejects.toThrow("unavailable"); await expect(groupsRepo.approve(db, "b", group.id, "b", true)).rejects.toThrow("unavailable");
 await groupsRepo.approve(db, "a", group.id, "b", true); expect((await groupsRepo.list(db, "b"))[0]?.name).toBe("Private trip");
 const input = { id: "11111111-1111-4111-8111-111111111111", groupId: group.id, kind: "split" as const, payload: payloadSchema.parse({ name: "Dinner", date: "2026-11-21", currency: "INR", amountMinor: 90000, participants: ["a", "b"], payer: "a" }) };
 await groupsRepo.save(db, "a", input); expect((await groupsRepo.detail(db, "b", group.id)).entries[0]?.payload.amountMinor).toBe(90000);
 await expect(groupsRepo.save(db, "c", { ...input, id: crypto.randomUUID() })).rejects.toThrow("unavailable");
 await expect(groupsRepo.save(db, "a", { ...input, id: crypto.randomUUID(), payload: { ...input.payload, participants: ["a", "c"] } })).rejects.toThrow("approved");
 await groupsRepo.approve(db, "a", group.id, "b", false); await expect(groupsRepo.detail(db, "b", group.id)).rejects.toThrow("unavailable"); await expect(groupsRepo.save(db, "b", { ...input, id: crypto.randomUUID() })).rejects.toThrow("unavailable");
 await pg.close();
}, 30000);
it("multi-record writes roll back the first record if the second cannot be saved", async () => {
 const pg = new PGlite(), actual = drizzle(pg, { schema }); await migrate(actual, { migrationsFolder: "./drizzle" }); const db = actual as unknown as Db;
 await actual.insert(schema.user).values({ id: "rollback", name: "Rollback", email: "rollback-group@example.com" });
 await expect(atomicWrite(db, tx => [tx.insert(schema.sharedGroup).values({ id: "group", ownerId: "rollback", name: "Not committed", currency: "INR" }), tx.insert(schema.groupMember).values({ id: "member", groupId: "group", userId: "missing-user", approved: true })])).rejects.toThrow();
 expect(await actual.select().from(schema.sharedGroup)).toEqual([]); await pg.close();
}, 30000);