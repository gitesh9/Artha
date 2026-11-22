import { neon } from "@neondatabase/serverless";
import { migrateDatabase } from "./migrations.mjs";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("Set DATABASE_URL before running migrations.");
const sql = neon(url);
try {
  const applied = await migrateDatabase(
    (text, params) => sql.query(text, params),
    statements => sql.transaction(statements.map(s => sql.query(s.text, s.params))),
  );
  console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Database migrations are up to date.");
} catch {
  console.error("Migration failed; no changes were committed. Check database connectivity and schema/history compatibility. No credentials or row contents were logged.");
  process.exitCode = 1;
}