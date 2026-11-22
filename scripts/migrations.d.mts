export interface MigrationStatement { text: string; params: unknown[] }
export function migrateDatabase(
  query: (text: string, params: unknown[]) => Promise<unknown[]>,
  transaction: (statements: MigrationStatement[]) => Promise<unknown>,
): Promise<string[]>;