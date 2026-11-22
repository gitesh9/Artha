// @vitest-environment node
import { it, expect, vi, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/core/db/schema";
afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock("@/core/db/client"); vi.resetModules(); });
it("FX refresh persists its rate date and upstream failure uses the last snapshot with a stale label", async () => {
 const pg = new PGlite(), db = drizzle(pg, { schema }); await migrate(db, { migrationsFolder: "./drizzle" }); vi.doMock("@/core/db/client", () => ({ getDb: async () => db }));
 const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ base: "INR", date: "2026-11-20", rates: { USD: .012, EUR: .011 } })).mockRejectedValueOnce(new Error("Rate service offline")); vi.stubGlobal("fetch", fetcher);
 const { getRates } = await import("@/core/integrations/currency"); const fresh = await getRates("INR", undefined, true); expect(fresh.stale).toBe(false); const saved = (await db.select().from(schema.fxSnapshot))[0]; expect(saved?.rateDate).toBe("2026-11-20"); expect(saved?.rates["USD"]).toBe(.012);
 const fallback = await getRates("INR", undefined, true); expect(fallback).toMatchObject({ date: "2026-11-20", stale: true, rates: { USD: .012, INR: 1 } }); await pg.close();
}, 30000);