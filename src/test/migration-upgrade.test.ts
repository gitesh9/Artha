// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { migrateDatabase } from "../../scripts/migrations.mjs";

type Statement = { text: string; params: unknown[] };
function adapters(pg: PGlite) {
  return [async (text: string, params: unknown[]) => (await pg.query(text, params)).rows,
    async (statements: Statement[]) => pg.transaction(async tx => { for (const s of statements) await tx.query(s.text, s.params); })] as const;
}
it("upgrades the original database without losing saved entries and creates tables for every reported unavailable page", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(await readFile("drizzle/0000_fast_famine.sql", "utf8"));
    await pg.query('insert into "user" (id,name,email) values ($1,$2,$3)', ["upgrade-owner", "Owner", "upgrade@example.com"]);
    await pg.query('insert into money_account (id,user_id,name,type,currency,opening_balance_minor) values ($1,$2,$3,$4,$5,$6)', ["saved-account", "upgrade-owner", "Cash", "cash", "INR", 12345]);
    expect(await migrateDatabase(...adapters(pg))).toEqual(["0000_fast_famine", "0001_safe_molly_hayes", "0002_medical_sphinx", "0003_illegal_kree"]);
    expect((await pg.query<{ column_name: string }>("select column_name from information_schema.columns where table_name='transaction' and column_name='transfer_id'")).rows[0]?.column_name).toBe("transfer_id");
    const result = await pg.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public'");
    expect(result.rows.map(r => r.table_name)).toEqual(expect.arrayContaining(["finance_record", "fx_snapshot", "push_subscription", "shared_group", "group_member", "group_invite", "group_entry"]));
    expect((await pg.query<{ balance: number }>("select opening_balance_minor::integer as balance from money_account where id='saved-account'")).rows[0]?.balance).toBe(12345);
    expect(await migrateDatabase(...adapters(pg))).toEqual([]);
  } finally { await pg.close(); }
}, 30000);
it("refuses a partial legacy schema without marking migrations complete", async () => {
  const pg = new PGlite();
  try {
    await pg.exec('create table "user" (id text primary key)');
    await expect(migrateDatabase(...adapters(pg))).rejects.toThrow("Partial initial schema");
    expect((await pg.query<{ journal: string | null }>("select to_regclass('drizzle.__drizzle_migrations')::text as journal")).rows[0]?.journal).toBeNull();
  } finally { await pg.close(); }
}, 30000);
it("rolls back schema changes and history when a migration batch fails", async () => {
  const pg = new PGlite();
  try {
    const [query, transaction] = adapters(pg);
    await expect(migrateDatabase(query, (statements: Statement[]) => transaction([...statements, { text: "select missing_migration_function()", params: [] }]))).rejects.toThrow();
    expect((await pg.query<{ journal: string | null }>("select to_regclass('drizzle.__drizzle_migrations')::text as journal")).rows[0]?.journal).toBeNull();
    expect((await pg.query<{ name: string | null }>("select to_regclass('public.finance_record')::text as name")).rows[0]?.name).toBeNull();
  } finally { await pg.close(); }
}, 30000);