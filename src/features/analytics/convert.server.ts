/** Server helper: loads a user's transactions in a range and converts them to their base currency. */
import type { Db } from "@/core/db/client";
import { transactionsRepo, type TxFilter } from "../transactions/repository";
import { settingsRepo } from "../settings/repository";
import { getRates, convertMinor } from "@/core/integrations/currency";
import { minorFactor } from "@/shared/money";
import type { BaseTx } from "./service";

export async function loadBaseTransactions(db: Db, userId: string, f: TxFilter) {
  const { baseCurrency } = await settingsRepo.get(db, userId);
  const [rows, rates] = await Promise.all([transactionsRepo.list(db, userId, f, 100001), getRates(baseCurrency)]);
  if (rows.length > 100000) throw new Error("This report exceeds its safe entry limit. Narrow the dates; no incomplete total is shown.");
  const txs: BaseTx[] = rows.map((r) => ({
    kind: r.kind,
    note: r.note,
    category: r.category,
    occurredOn: String(r.occurredOn),
    amountMinor: (() => { const converted = convertMinor(r.amountMinor, r.currency, baseCurrency, rates, minorFactor); if (converted === null) throw new Error(`No exchange rate for ${r.currency}. Original entries are safe; retry rates before viewing this report.`); return converted; })(),
  }));
  return { baseCurrency, txs, rateInfo: { date: rates.date, source: rates.source ?? "Frankfurter / ECB", stale: rates.stale ?? false } };
}
