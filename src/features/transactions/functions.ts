import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/core/auth/middleware";
import { toMinor } from "@/shared/money";
import { transactionTags } from "./tags";
import { validDate } from "../insights/service";

const filterSchema = z.object({
  from: z.string().nullish(),
  to: z.string().nullish(),
  kind: z.enum(["income", "expense", "transfer_in", "transfer_out"]).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
});

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator(filterSchema)
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { transactionsRepo } = await import("./repository");
    const { accountsRepo } = await import("../accounts/repository");
    const db = await getDb();
    const [rows, accounts] = await Promise.all([
      transactionsRepo.list(db, context.userId, data, 100001),
      accountsRepo.list(db, context.userId),
    ]);
    const names = new Map(accounts.map((a) => [a.id, a.name]));
    if (rows.length > 100000) throw new Error("Narrow the dates to view a complete transaction list.");
    return rows.filter(r => !data.tag || transactionTags(r.note).includes(data.tag.replace(/^#/, "").toLowerCase())).map((r) => ({
      id: r.id, kind: r.kind, amountMinor: r.amountMinor, currency: r.currency,
      category: r.category, note: r.note, occurredOn: String(r.occurredOn),
      accountName: names.get(r.accountId) ?? "", accountId: r.accountId,
      tags: transactionTags(r.note), transferId: r.transferId,
    }));
  });

export const importExistingTransactions = createServerFn({ method: "GET" }).middleware([requireUser]).handler(async ({ context }) => { const { getDb } = await import("@/core/db/client"), { transactionsRepo } = await import("./repository"); const rows = await transactionsRepo.list(await getDb(), context.userId, {}, 100001); if (rows.length > 100000) throw new Error("Duplicate review exceeds its safe entry limit. No incomplete duplicate check is claimed."); return rows.map(r => ({ accountId: r.accountId, kind: r.kind, amountMinor: r.amountMinor, currency: r.currency, note: r.note, occurredOn: r.occurredOn })); });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(
    z.object({
      accountId: z.string().min(1),
      clientId: z.string().uuid().optional(),
      kind: z.enum(["income", "expense", "transfer"]),
      destinationId: z.string().min(1).optional(),
      destinationAmount: z.number().positive().finite().optional(),
      sipBillId: z.string().uuid().optional(),
      units: z.number().nonnegative().finite().optional(),
      amount: z.number().positive().finite(),
      category: z.string().min(1).max(40),
      note: z.string().max(200).optional(),
      occurredOn: z.string().refine(validDate),
    }),
  )
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { transactionsRepo } = await import("./repository");
    const { accountsRepo } = await import("../accounts/repository");
    const db = await getDb();
    if (data.kind === "transfer") {
      if (!data.clientId || !data.destinationId) throw new Error("Choose a destination account before transferring.");
      const { saveTransfer } = await import("./transfers.repository");
      return saveTransfer(db, context.userId, { ...data, clientId: data.clientId, destinationId: data.destinationId });
    }
    if (data.sipBillId) {
      if (data.kind !== "expense" || data.clientId !== data.sipBillId) throw new Error("SIP needs a matching confirmed payment identifier.");
      const { saveSipPayment } = await import("../planning/sip.repository");
      return saveSipPayment(db, context.userId, { ...data, clientId: data.sipBillId, sipBillId: data.sipBillId });
    }
    const acc = (await accountsRepo.list(db, context.userId)).find((a) => a.id === data.accountId);
    if (!acc) throw new Error("Account not found");
    const row = {
      id: data.clientId ?? crypto.randomUUID(),
      userId: context.userId,
      accountId: acc.id,
      kind: data.kind,
      amountMinor: toMinor(data.amount, acc.currency),
      currency: acc.currency,
      category: data.category,
      note: data.note || null,
      occurredOn: data.occurredOn,
    };
    await transactionsRepo.create(db, row);
    const saved = await transactionsRepo.byId(db, context.userId, row.id);
    const { sameTransaction } = await import("./service");
    if (!saved || !sameTransaction(saved, row)) throw new Error("This entry could not be synced. Please review it before retrying.");
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { getDb } = await import("@/core/db/client");
    const { transactionsRepo } = await import("./repository");
    const db = await getDb(), row = await transactionsRepo.byId(db, context.userId, data.id);
    if (row?.transferId) {
      const { transaction } = await import("@/core/db/schema"), { and, eq } = await import("drizzle-orm");
      await db.delete(transaction).where(and(eq(transaction.userId, context.userId), eq(transaction.transferId, row.transferId)));
    } else await transactionsRepo.remove(db, context.userId, data.id);
    return { ok: true };
  });
