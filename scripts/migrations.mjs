import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const folder = new URL("../drizzle/", import.meta.url);
const journalTable = 'drizzle.__drizzle_migrations';

/** CLI-only: execute checked-in migrations atomically; never migrate from page loaders. */
export async function migrateDatabase(query, transaction) {
  const { entries } = JSON.parse(await readFile(new URL("meta/_journal.json", folder), "utf8"));
  const migrations = await Promise.all(entries.map(async entry => {
    const text = await readFile(new URL(`${entry.tag}.sql`, folder), "utf8");
    return { ...entry, text, hash: createHash("sha256").update(text).digest("hex") };
  }));
  const [{ journal }] = await query("select to_regclass($1)::text as journal", [journalTable]);
  const applied = journal ? await query(`select hash, created_at from ${journalTable} order by created_at`) : [];
  for (const row of applied) {
    if (!migrations.some(m => m.hash === row.hash && m.when === Number(row.created_at))) throw new Error("Unknown migration history; review the database before continuing.");
  }
  const columns = await query("select table_name, column_name, udt_name, is_nullable from information_schema.columns where table_schema = 'public'");
  const first = migrations[0];
  if (!first) throw new Error("Migration journal is empty.");
  const tables = [...first.text.matchAll(/CREATE TABLE "([^"]+)" \(([\s\S]*?)\n\);/g)];
  const corePresent = tables.filter(t => columns.some(c => c.table_name === t[1]));
  let baseline = false;
  if (!applied.length && corePresent.length) {
    if (corePresent.length !== tables.length) throw new Error("Partial initial schema; restore or review it before migration.");
    for (const table of tables) {
      for (const match of table[2].matchAll(/^\s*"([^"]+)" (text|timestamp|boolean|bigint|date)([^\n]*)/gm)) {
        const actual = columns.find(c => c.table_name === table[1] && c.column_name === match[1]);
        const type = { bigint: "int8", boolean: "bool" }[match[2]] ?? match[2];
        if (!actual || actual.udt_name !== type || (match[3].includes("NOT NULL") && actual.is_nullable !== "NO")) throw new Error("Existing initial schema differs; review it before migration.");
      }
    }
    const constraints = await query("select conname from pg_constraint where connamespace = 'public'::regnamespace");
    const expected = [...tables.map(t => `${t[1]}_pkey`), ...[...first.text.matchAll(/(?:ADD CONSTRAINT|CONSTRAINT) "([^"]+)"/g)].map(m => m[1])];
    if (expected.some(name => !constraints.some(c => c.conname === name))) throw new Error("Initial schema constraints are incomplete; review before migration.");
    for (const match of first.text.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)) {
      const [row] = await query("select to_regclass($1)::text as name", [`public.${match[1]}`]);
      if (!row?.name) throw new Error("Initial schema indexes are incomplete; review before migration.");
    }
    baseline = true;
  }
  const pending = migrations.filter(m => !applied.some(row => row.hash === m.hash));
  if (!pending.length) return [];
  const statements = [
    { text: "select pg_advisory_xact_lock(1795257113)", params: [] },
    { text: 'CREATE SCHEMA IF NOT EXISTS drizzle', params: [] },
    { text: `CREATE TABLE IF NOT EXISTS ${journalTable} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`, params: [] },
    // Reject a concurrent migration rather than rerun DDL from an outdated inspection.
    { text: `DO $$ BEGIN IF (SELECT count(*) FROM ${journalTable}) <> ${applied.length} THEN RAISE EXCEPTION 'Migration history changed; retry'; END IF; END $$`, params: [] },
  ];
  for (const migration of pending) {
    if (!(baseline && migration.idx === 0)) {
      for (const text of migration.text.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) statements.push({ text, params: [] });
    }
    statements.push({ text: `insert into ${journalTable} (hash, created_at) values ($1, $2)`, params: [migration.hash, migration.when] });
  }
  await transaction(statements);
  return pending.map(m => m.tag);
}