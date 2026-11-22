import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "./client";
/** Neon HTTP supports transactional batches, not interactive transactions. Build before executing. */
export async function atomicWrite(db: Db, build: (db: Db) => BatchItem<"pg">[]) {
  if (typeof db.batch === "function") { const queries = build(db), first = queries[0]; if (!first) return; await db.batch([first, ...queries.slice(1)]); return; }
  await db.transaction(async tx => { for (const query of build(tx as unknown as Db)) await (query as unknown as PromiseLike<unknown>); });
}