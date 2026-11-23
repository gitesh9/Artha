import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/core/db/client";
import { transaction } from "@/core/db/schema";
import { atomicWrite } from "@/core/db/atomic.server";
import { accountsRepo } from "../accounts/repository";
import { transferAmounts, pairedId } from "./transfer-service";
export async function saveTransfer(db: Db, userId: string, data: { clientId: string; accountId: string; destinationId: string; amount: number; destinationAmount?: number | undefined; note?: string | undefined; occurredOn: string }) {
  const accounts = await accountsRepo.list(db, userId), source = accounts.find(a => a.id === data.accountId), target = accounts.find(a => a.id === data.destinationId);
  if (!source || !target) throw new Error("Transfer account unavailable.");
  const { outgoing, incoming } = transferAmounts(source, target, data.amount, data.destinationAmount);
  const secondId = await pairedId(data.clientId);
  const common = { userId, transferId: data.clientId, category: "Internal transfer", note: data.note || null, occurredOn: data.occurredOn };
  const rows = [{ ...common, id: data.clientId, accountId: source.id, currency: source.currency, kind: "transfer_out", amountMinor: outgoing }, { ...common, id: secondId, accountId: target.id, currency: target.currency, kind: "transfer_in", amountMinor: incoming }];
  const existing = await db.select().from(transaction).where(inArray(transaction.id, [data.clientId, secondId]));
  if (existing.some(s => !rows.some(r => s.id === r.id && s.userId === userId && s.transferId === r.transferId && s.accountId === r.accountId && s.kind === r.kind && s.amountMinor === r.amountMinor && s.currency === r.currency && s.occurredOn === r.occurredOn && s.note === r.note))) throw new Error("Transfer conflicts with an existing entry. Nothing was changed.");
  // A concurrent conflicting ID must abort the entire pair, not insert only the other side.
  await atomicWrite(db, tx => [tx.insert(transaction).values(rows).onConflictDoUpdate({ target: transaction.id, set: {
    amountMinor: sql`case when ${transaction.userId} = excluded.user_id and ${transaction.accountId} = excluded.account_id and ${transaction.kind} = excluded.kind and ${transaction.amountMinor} = excluded.amount_minor and ${transaction.currency} = excluded.currency and ${transaction.transferId} = excluded.transfer_id and ${transaction.occurredOn} = excluded.occurred_on and ${transaction.note} is not distinct from excluded.note then ${transaction.amountMinor} else null end`,
  } })]);
  const saved = await db.select().from(transaction).where(and(eq(transaction.userId, userId), inArray(transaction.id, [data.clientId, secondId])));
  if (saved.length !== 2 || rows.some(r => !saved.some(s => s.id === r.id && s.transferId === r.transferId && s.accountId === r.accountId && s.kind === r.kind && s.amountMinor === r.amountMinor && s.currency === r.currency && s.occurredOn === r.occurredOn && s.note === r.note))) throw new Error("Transfer conflicts with an existing entry. Review before retrying.");
  return { ok: true };
}