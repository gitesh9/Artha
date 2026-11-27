// Deletes throwaway e2e-*@artha.test accounts (and their data via cascades).
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) { console.log("No DATABASE_URL; in-memory preview data needs no cleanup."); process.exit(0); }
const sql = neon(process.env.DATABASE_URL);
const owned = await sql`SELECT id FROM "user" WHERE email LIKE 'e2e-%@artha.test'`;
const ids = owned.map(r => r.id);
if (ids.length) {
  await sql`DELETE FROM group_entry WHERE created_by = ANY(${ids})`;
  await sql`DELETE FROM "user" WHERE id = ANY(${ids})`;
}
console.log(`Removed ${ids.length} e2e account(s).`);
