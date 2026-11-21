/** Server helper: loads a user's transactions in a range and converts them to their base currency. */
import type { Db } from "@/core/db/client";
import { transactionsRepo, type TxFilter } from "../transactions/repository";
import { settingsRepo } from "../settings/repository";
import { getRates, convertMinor } from "@/core/integrations/currency";
import { minorFactor } from "@/shared/money";
import type { BaseTx } from "./service";

export async function loadBaseTransactions(db: Db, userId: string, f: TxFilter) {
  const { baseCurrency } = await settingsRepo.get(db, userId);
  const [rows, rates] = await Promise.all([transactionsRepo.list(db, userId, f, 100000), getRates(baseCurrency)]);
  const txs: BaseTx[] = rows.map((r) => ({
    kind: r.kind,
    category: r.category,
    occurredOn: String(r.occurredOn),
    amountMinor: convertMinor(r.amountMinor, r.currency, baseCurrency, rates, minorFactor) ?? 0,
  }));
  return { baseCurrency, txs };
}
