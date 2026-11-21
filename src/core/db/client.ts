/**
 * Database access point. Server-only: call getDb() inside server handlers.
 * - Production / when DATABASE_URL is set: Neon serverless Postgres over HTTP.
 * - Local dev without DATABASE_URL: embedded in-memory Postgres (PGlite),
 *   migrated automatically, so the app runs with zero setup.
 */
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzleNeon<typeof schema>>;

const g = globalThis as unknown as { __arthaDevDb?: Promise<Db> | undefined };

export async function getDb(): Promise<Db> {
  const url = process.env["DATABASE_URL"];
  if (url) return drizzleNeon(neon(url), { schema });

  if (import.meta.env.DEV) {
    g.__arthaDevDb ??= (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      // In-memory: preview data resets when the dev server restarts. Set DATABASE_URL for real storage.
      const client = new PGlite();
      const db = drizzle(client, { schema });
      await migrate(db, { migrationsFolder: "./drizzle" });
      return db as unknown as Db;
    })().catch((e) => {
      g.__arthaDevDb = undefined; // allow a retry after a failed boot
      throw e;
    });
    return g.__arthaDevDb;
  }
  throw new Error("DATABASE_URL is not set");
}
